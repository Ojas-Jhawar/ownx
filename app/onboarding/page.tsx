import Link from "next/link"
import { redirect } from "next/navigation"
import { Check } from "lucide-react"
import { Logo } from "@/components/logo"
import { PassportCard } from "@/components/passport-card"
import { createClient } from "@/lib/supabase/server"

const KEEPS = [
  "Original purchase invoice",
  "Serial number",
  "Warranty",
  "Service history",
  "Condition",
  "Ownership history",
]

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()
  const firstName = (profile?.full_name || user.email || "there").split(" ")[0]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-5">
        <Logo href="/" />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-10">
        <div className="grid w-full items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink text-balance">
              Welcome to Ownx, {firstName}!
            </h1>
            <p className="mt-2 text-muted-foreground">
              Let&apos;s create your first Ownership Passport. Start with one asset — you can add more anytime.
            </p>

            <div className="mt-8">
              <p className="text-sm font-semibold text-ink">What Ownx keeps together</p>
              <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {KEEPS.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                      <Check className="size-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/create"
                className="rounded-full bg-brand px-6 py-3 text-center text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5"
              >
                Add My First Asset
              </Link>
              <Link href="/dashboard" className="text-center text-sm font-medium text-muted-foreground hover:text-ink">
                I&apos;ll do it later
              </Link>
            </div>
          </div>

          <div className="flex justify-center">
            <PassportCard className="rotate-1" />
          </div>
        </div>
      </main>
    </div>
  )
}
