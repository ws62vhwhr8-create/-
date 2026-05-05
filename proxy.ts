import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const adminRoutePrefixes = ["/solutions", "/users"]

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/api/auth/signin", request.url)
  signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname)
  return NextResponse.redirect(signInUrl)
}

function isAdminFromToken(token: Awaited<ReturnType<typeof getToken>>) {
  if (!token) return false
  if (typeof token === "string") return false

  const directRole =
    typeof token.role === "string"
      ? token.role
      : Array.isArray(token.roles)
        ? token.roles.find((value): value is string => typeof value === "string")
        : undefined

  if (directRole === "admin") return true

  if (Array.isArray(token.roles) && token.roles.some((role) => String(role).toLowerCase() === "admin")) {
    return true
  }

  if (typeof token.sub === "string" && token.sub === "admin") {
    return true
  }

  return false
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (API authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - and the root path (/)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|$).*)",
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

  const isAdminRoute = adminRoutePrefixes.some((route) => pathname.startsWith(route))
  if (isAdminRoute && !isAdminFromToken(token)) {
    return NextResponse.redirect(new URL("/customers", request.url))
  }

  return NextResponse.next()
}

// Note: middleware config is now in middleware.ts only
