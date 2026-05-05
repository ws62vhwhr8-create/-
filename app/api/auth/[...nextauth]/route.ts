import NextAuth, { type NextAuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"

const signInTenantId = process.env.ENTRA_TENANT_ID || process.env.ENTRA_SIGNIN_TENANT_ID || "organizations"

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  providers: [
    AzureADProvider({
      clientId: process.env.ENTRA_CLIENT_ID || "",
      clientSecret: process.env.ENTRA_CLIENT_SECRET || "",
      tenantId: signInTenantId,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        // Do not store large tokens in the session cookie
        // token.accessToken = account.access_token
        // token.id_token = account.id_token
      }
      if (profile) {
        // Azure AD profile.oid is the actual Entra Object ID (GUID)
        const oid = (profile as { oid?: string }).oid
        if (oid) token.oid = oid
      }
      // 이메일 기반 admin 권한 부여
      const ADMIN_EMAILS = ["ha.jeong@dexconsulting.net"]
      const email =
        (token.email as string | undefined) ??
        (profile as { email?: string } | undefined)?.email
      if (email && ADMIN_EMAILS.includes(email.toLowerCase())) {
        token.role = "admin"
      } else if (token.role === undefined) {
        token.role = "user"
      }
      return token
    },
    async session({ session, token }) {
      // session.accessToken = token.accessToken as string
      if (session.user) {
        session.user.id = token.sub || ""
        session.user.entraId = (token.oid as string | undefined) || token.sub || ""
        session.user.role = (token.role as string) ?? "user"
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
