import NextAuth, { type NextAuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import { readFile } from "fs/promises"
import { join } from "path"

const signInTenantId = process.env.ENTRA_TENANT_ID || process.env.ENTRA_SIGNIN_TENANT_ID || "organizations"
const STORAGE_FILE = join(process.cwd(), ".data", "storage.json")
const BOOTSTRAP_ADMIN_EMAILS = ["ha.jeong@dexconsulting.net"]

type ManagedUser = {
  id?: string
  displayName?: string
  email?: string
  role?: string
}

let usersCache: { users: ManagedUser[]; loadedAt: number } | null = null

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

async function loadManagedUsers() {
  const now = Date.now()
  if (usersCache && now - usersCache.loadedAt < 5_000) {
    return usersCache.users
  }

  try {
    const raw = await readFile(STORAGE_FILE, "utf-8")
    const parsed = JSON.parse(raw) as { users?: ManagedUser[] } | null
    const users = Array.isArray(parsed?.users) ? parsed.users : []
    usersCache = { users, loadedAt: now }
    return users
  } catch {
    usersCache = { users: [], loadedAt: now }
    return []
  }
}

async function resolveManagedUser(email?: string | null, name?: string | null) {
  const managedUsers = await loadManagedUsers()
  const normalizedEmail = normalizeText(email)
  const normalizedName = normalizeText(name)

  return (
    managedUsers.find((managedUser) => {
      const userEmail = normalizeText(managedUser.email)
      const userName = normalizeText(managedUser.displayName)

      if (normalizedEmail && userEmail && normalizedEmail === userEmail) return true
      if (normalizedName && userName && normalizedName === userName) return true
      return false
    }) ?? null
  )
}

async function hasManagedUsers() {
  const managedUsers = await loadManagedUsers()
  return managedUsers.length > 0
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    AzureADProvider({
      id: "azuread",
      clientId: process.env.ENTRA_CLIENT_ID || "",
      clientSecret: process.env.ENTRA_CLIENT_SECRET || "",
      tenantId: signInTenantId,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = normalizeText(user.email)
      const managedUser = await resolveManagedUser(user.email, user.name)
      if (managedUser && (managedUser.role === "admin" || managedUser.role === "user")) {
        return true
      }

      // 초기 세팅에서 관리자가 아직 사용자 관리 화면을 구성하지 않은 경우 진입 허용
      if (!(await hasManagedUsers()) && email && BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
        return true
      }

      return false
    },
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

      const email = (token.email as string | undefined) ?? (profile as { email?: string } | undefined)?.email
      const name = (token.name as string | undefined) ?? (profile as { name?: string } | undefined)?.name
      const managedUser = await resolveManagedUser(email, name)

      if (managedUser && (managedUser.role === "admin" || managedUser.role === "user")) {
        token.role = managedUser.role
        if (managedUser.id) token.managedUserId = managedUser.id
      } else if (!(await hasManagedUsers()) && email && BOOTSTRAP_ADMIN_EMAILS.includes(normalizeText(email))) {
        token.role = "admin"
      } else {
        token.role = "unauthorized"
        token.managedUserId = undefined
      }

      return token
    },
    async session({ session, token }) {
      // session.accessToken = token.accessToken as string
      if (session.user) {
        session.user.id = (token.managedUserId as string | undefined) || token.sub || ""
        session.user.entraId = (token.oid as string | undefined) || token.sub || ""
        session.user.role = (token.role as string) ?? "user"
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
