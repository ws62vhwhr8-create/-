import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const adminRoutePrefixes = ["/solutions", "/users"]

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminRoute = adminRoutePrefixes.some((route) => pathname.startsWith(route))
  if (!isAdminRoute) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token || !isAdminFromToken(token)) {
    return NextResponse.redirect(new URL("/customers", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/solutions/:path*", "/users/:path*"],
}
