"use client"

import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { signIn, signUp, type AuthState } from "@/app/actions/auth"

function Field({
  label,
  type,
  placeholder,
  id,
  name,
  required = true,
}: {
  label: string
  type: string
  placeholder: string
  id: string
  name: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  )
}

const initialState: AuthState = { error: null }

export default function Page() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/dashboard"
  const message = searchParams.get("message")

  const [loginState, loginAction, loginPending] = useActionState(signIn, initialState)
  const [signupState, signupAction, signupPending] = useActionState(signUp, initialState)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-5">
        <Logo href="/" />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
          {/* Login */}
          <section className="rounded-3xl border border-border bg-card p-7 shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to access your asset passport.</p>

            <form action={loginAction} className="mt-6 space-y-4">
              <input type="hidden" name="next" value={next} />
              <Field id="login-email" name="email" label="Email address" type="email" placeholder="you@example.com" />
              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Password
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {message && !loginState.error && <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-ink-soft">{message}</p>}
              {loginState.error && <p className="text-sm text-destructive">{loginState.error}</p>}

              <button
                type="submit"
                disabled={loginPending}
                className="block w-full rounded-full bg-brand py-2.5 text-center text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loginPending ? "Signing in…" : "Log in"}
              </button>
            </form>
          </section>

          {/* Sign up */}
          <section className="rounded-3xl border border-border bg-card p-7 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Create your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your assets deserve a history that stays with them.</p>

            <form action={signupAction} className="mt-6 space-y-4">
              <Field id="signup-name" name="fullName" label="Full name" type="text" placeholder="John Doe" />
              <Field id="signup-email" name="email" label="Email address" type="email" placeholder="you@example.com" />
              <Field
                id="signup-password"
                name="password"
                label="Password"
                type="password"
                placeholder="At least 8 characters"
              />

              {signupState.error && <p className="text-sm text-destructive">{signupState.error}</p>}

              <button
                type="submit"
                disabled={signupPending}
                className="block w-full rounded-full bg-brand py-2.5 text-center text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {signupPending ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you agree this is a student competition prototype —{" "}
              <Link href="/about" className="underline">
                learn more
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
