"use client"

import { useActionState } from "react"
import { updateProfile } from "@/app/actions/profile"

export function SettingsForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, { error: null })

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="text-sm font-medium text-ink-soft">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink-soft">Email</label>
        <input
          disabled
          value={email}
          className="mt-1.5 w-full rounded-xl border border-input bg-muted px-3.5 py-2.5 text-sm text-muted-foreground outline-none"
        />
        <p className="mt-1 text-xs text-muted-foreground">Email changes aren&apos;t supported yet.</p>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  )
}
