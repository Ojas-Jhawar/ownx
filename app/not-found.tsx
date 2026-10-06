import Link from "next/link"

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be wrong, or a share link may have been revoked by its owner.
        </p>
        <Link href="/" className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground">
          Back to home
        </Link>
      </div>
    </main>
  )
}
