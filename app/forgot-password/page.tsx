"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { requestPasswordReset, type AuthState } from "@/app/actions/auth"

const initialState: AuthState = { error: null }

export default function Page() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-5">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">We'll email you a link to set a new one.</p>

          <form action={action} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="block w-full rounded-full bg-brand py-2.5 text-center text-sm font-medium text-brand-foreground disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-brand hover:underline">Back to log in</Link>
          </p>
        </section>
      </main>
    </div>
  )
}
