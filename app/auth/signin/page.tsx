"use client"

import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"

const ERROR_MESSAGE_MAP: Record<string, string> = {
  AccessDenied: "Your account is not authorized for this workspace.",
  Configuration: "Authentication is not configured correctly.",
  Verification: "Verification failed. Please try signing in again.",
  "azure-ad": "Microsoft sign-in requires additional verification. Approve the request in Authenticator and try again.",
  Default: "Sign in failed. Please try again.",
}

function SignInContent() {
  const searchParams = useSearchParams()
  const [isSigningIn, setIsSigningIn] = useState(false)

  const rawCallbackUrl = searchParams.get("callbackUrl") || "/customers"
  const callbackUrl = useMemo(() => {
    const lowered = rawCallbackUrl.toLowerCase()
    if (lowered.includes("/api/auth/signin") || lowered.includes("/auth/signin")) {
      return "/customers"
    }
    return rawCallbackUrl
  }, [rawCallbackUrl])
  const errorCode = searchParams.get("error")

  const errorMessage = useMemo(() => {
    if (!errorCode) return null
    return ERROR_MESSAGE_MAP[errorCode] || ERROR_MESSAGE_MAP.Default
  }, [errorCode])

  const onSignIn = async () => {
    setIsSigningIn(true)
    await signIn("azure-ad", { callbackUrl })
    setIsSigningIn(false)
  }

  return (
    <main className="relative flex min-h-screen w-full flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,rgba(79,70,229,0.18)_0%,rgba(244,114,182,0.09)_38%,rgba(255,255,255,1)_100%)] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 dark:bg-[radial-gradient(110%_100%_at_50%_0%,rgba(99,102,241,0.16)_0%,rgba(20,20,28,1)_52%,rgba(19,19,19,1)_100%)]">
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.24)_0%,rgba(79,70,229,0)_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(99,102,241,0.20)_0%,rgba(99,102,241,0)_72%)]" />

      <div className="relative z-10 mx-auto w-full max-w-md">
        <Card className="w-full border border-[#dcd7ff] bg-white/90 shadow-[0_24px_90px_-44px_rgba(67,56,202,0.6)] backdrop-blur dark:border-[#333333] dark:bg-[#1c1b1b]/92 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_18px_50px_-30px_rgba(0,0,0,0.7)]">
          <CardHeader className="space-y-3 px-5 pb-1 pt-6 sm:px-7 sm:pt-7">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4338ca] dark:bg-[#2b2b3f] dark:text-[#c0c1ff]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6366f1] dark:text-[#c7c4d7]">Management Portal</p>
              <CardTitle className="text-xl font-semibold text-[#1f1b4d] sm:text-2xl dark:text-[#e5e2e1]">Sign in to Sales Roadmap</CardTitle>
              <CardDescription className="text-sm text-[#5b5785] dark:text-[#908fa0]">
                Use your Entra ID account to continue.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-5 pb-6 pt-4 sm:px-7 sm:pb-7">
            <Button
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn}
              className="h-11 w-full justify-between rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white hover:bg-[#4338ca] dark:bg-[#6366f1] dark:text-[#0f1030] dark:hover:bg-[#7c7fff]"
            >
              <span className="inline-flex items-center gap-2">
                <LockKeyhole className="h-4 w-4" />
                {isSigningIn ? "Redirecting..." : "Continue with Entra ID"}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            {errorMessage ? (
              <p className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#991b1b] dark:border-[#ffb4ab]/40 dark:bg-[#3a1f1d] dark:text-[#ffb4ab]">
                {errorMessage}
              </p>
            ) : null}

            <div className="rounded-lg border border-[#e4e0ff] bg-[#f8f7ff] px-3 py-2 text-xs leading-relaxed text-[#4b4b71] dark:border-[#464554]/50 dark:bg-[#232230] dark:text-[#b6b5c8]">
              Your access is controlled by workspace permissions. Contact an administrator if you cannot sign in.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function SignInFallback() {
  return (
    <main className="relative flex min-h-screen w-full flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,rgba(79,70,229,0.18)_0%,rgba(244,114,182,0.09)_38%,rgba(255,255,255,1)_100%)] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 dark:bg-[radial-gradient(110%_100%_at_50%_0%,rgba(99,102,241,0.16)_0%,rgba(20,20,28,1)_52%,rgba(19,19,19,1)_100%)]">
      <div className="relative z-10 mx-auto w-full max-w-md">
        <Card className="w-full border border-[#dcd7ff] bg-white/90 dark:border-[#333333] dark:bg-[#1c1b1b]/92">
          <CardHeader className="space-y-3 px-5 pb-1 pt-6 sm:px-7 sm:pt-7">
            <div className="h-6 w-40 animate-pulse rounded bg-[#eef0ff] dark:bg-[#2b2b3f]" />
            <div className="h-8 w-64 animate-pulse rounded bg-[#eef0ff] dark:bg-[#2b2b3f]" />
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-6 pt-4 sm:px-7 sm:pb-7">
            <div className="h-11 w-full animate-pulse rounded-xl bg-[#eef0ff] dark:bg-[#2b2b3f]" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-[#eef0ff] dark:bg-[#2b2b3f]" />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInContent />
    </Suspense>
  )
}
