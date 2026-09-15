"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, ShieldCheck, Wrench, Store, Settings, Plus, ArrowRightLeft } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"

const NAV = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid },
  { label: "Warranty", href: "/dashboard?filter=warranty", icon: ShieldCheck },
  { label: "Service", href: "/service", icon: Wrench },
  { label: "Transfers", href: "/transfers", icon: ArrowRightLeft },
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Settings", href: "/settings", icon: Settings },
] as const

export function AppShell({
  children,
  active,
  userName,
  userEmail,
}: {
  children: ReactNode
  active?: string
  userName?: string
  userEmail?: string
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
        <div className="px-2 py-2">
          <Logo href="/" />
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const isActive = active ? item.label === active : pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-muted",
                )}
              >
                <item.icon className="size-4.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <Link
          href="/settings"
          className="mt-auto flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white">
            {initials(userName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{userName || "Your account"}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail || ""}</p>
          </div>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/80 px-5 py-3 backdrop-blur lg:hidden">
          <Logo href="/" />
          <Link href="/create" className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
            <Plus className="size-4" /> New
          </Link>
        </header>

        <main className="flex-1 p-5 pb-24 sm:p-8 lg:pb-8">{children}</main>

        {/* Mobile bottom nav — the sidebar above is lg:flex only, so this is
            the sole way to reach Warranty/Service/Marketplace/Settings on a
            phone. Without it those sections would be unreachable on mobile. */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur lg:hidden">
          {NAV.map((item) => {
            const isActive = active ? item.label === active : pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  isActive ? "text-brand" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
