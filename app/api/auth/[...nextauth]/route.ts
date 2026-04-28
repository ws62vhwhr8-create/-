import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"

const handler = NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.ENTRA_CLIENT_ID || "",
      clientSecret: process.env.ENTRA_CLIENT_SECRET || "",
      tenantId: process.env.ENTRA_TENANT_ID || "common",
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.id_token = account.id_token
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      if (session.user) {
        session.user.id = token.sub || ""
      }
      return session
    },
  },
})

export { handler as GET, handler as POST }
