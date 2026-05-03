import NextAuth, { type NextAuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.ENTRA_CLIENT_ID || "",
      clientSecret: process.env.ENTRA_CLIENT_SECRET || "",
      tenantId: process.env.ENTRA_TENANT_ID || "common",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
        token.id_token = account.id_token
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
      session.accessToken = token.accessToken as string
      if (session.user) {
        session.user.id = token.sub || ""
        session.user.role = (token.role as string) ?? "user"
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
