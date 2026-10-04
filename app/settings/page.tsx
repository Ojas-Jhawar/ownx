import { redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { SettingsForm } from "@/components/settings/settings-form"
import { SignOutButton } from "@/components/settings/sign-out-button"

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single()

  return (
    <AppShell active="Settings" userName={profile?.full_name || undefined} userEmail={user.email}>
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account.</p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <SettingsForm fullName={profile?.full_name || ""} email={profile?.email || user.email || ""} />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-ink">Sign out</h2>
          <p className="mt-1 text-sm text-muted-foreground">You&apos;ll need to log in again to access your passports.</p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
