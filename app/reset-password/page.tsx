"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/client"

export default function Page() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    setPending(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (updateError) {
      setError(
        updateError.message.toLowerCase().includes("session")
          ? "Your reset link has expired. Please request a new one."
          : updateError.message,
      )
      return
    }
    router.push("/login?message=" + encodeURIComponent("Password updated — please log in."))
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-5">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Set a new password</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-soft">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="block w-full rounded-full bg-brand py-2.5 text-center text-sm font-medium text-brand-foreground disabled:opacity-60"
            >
              {pending ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
