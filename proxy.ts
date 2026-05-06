import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const adminRoutePrefixes = ["/admin-dashboard", "/solutions", "/users"]

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/api/auth/signin", request.url)
  signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname)
  return NextResponse.redirect(signInUrl)
}

function getRoleFromToken(token: Awaited<ReturnType<typeof getToken>>) {
  if (!token) return ""
  if (typeof token === "string") return ""

  const directRole =
    typeof token.role === "string"
      ? token.role
      : Array.isArray(token.roles)
        ? token.roles.find((value): value is string => typeof value === "string")
        : undefined

  if (directRole) return directRole.toLowerCase()
  return ""
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (API authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - and metadata file requests
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: useSecureCookies,
    cookieName: `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`,
  })

  // Protect app routes at the edge before page render.
  if (!token) {
    return redirectToSignIn(request)
  }

  const role = getRoleFromToken(token)
  const isAdmin = role === "admin"
  const isUser = role === "user"

  if (!isAdmin && !isUser) {
    return redirectToSignIn(request)
  }

  const isAdminRoute = adminRoutePrefixes.some((route) => pathname.startsWith(route))
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/customers", request.url))
  }

  return NextResponse.next()
}

// Note: middleware config is now in middleware.ts only
