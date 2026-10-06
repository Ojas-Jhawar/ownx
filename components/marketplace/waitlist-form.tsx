"use client"

import { useActionState } from "react"
import { CheckCircle2 } from "lucide-react"
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist"

const initial: WaitlistState = { error: null }

export function WaitlistForm({ source = "marketplace" }: { source?: "marketplace" | "newsletter" }) {
  const [state, action, pending] = useActionState(joinWaitlist, initial)

  if (state.ok) {
    return (
      <p className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
        <CheckCircle2 className="size-4" /> You&apos;re on the list. We&apos;ll email you once.
      </p>
    )
  }

  return (
    <form action={action} className="mx-auto mt-8 max-w-md">
      <input type="hidden" name="source" value={source} />
      {/* Honeypot */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {pending ? "Joining…" : "Notify me"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
