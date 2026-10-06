"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page failed to load. Try again, and if it keeps happening, go back to your dashboard.
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground">
            Try again
          </button>
          <Link href="/dashboard" className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink hover:bg-muted">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
