// lib/auth-types.ts
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    user?: {
      id?: string
      email?: string | null
      name?: string | null
      image?: string | null
      role?: string
    } & DefaultSession["user"]
    accessToken?: string
  }

  interface JWT {
    sub?: string
    accessToken?: string
    id_token?: string
    role?: string
  }
}
