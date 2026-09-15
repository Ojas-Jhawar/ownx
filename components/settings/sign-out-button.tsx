"use client"

import { useTransition } from "react"
import { signOut } from "@/app/actions/auth"

export function SignOutButton() {
  const [pending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(() => signOut())}
      disabled={pending}
      className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  )
}
