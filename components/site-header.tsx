"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

const NAV = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Features", href: "/features" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "About", href: "/about" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm text-muted-foreground transition-colors hover:text-ink",
                pathname === item.href && "text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Log In
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-sm transition-transform hover:-translate-y-0.5"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid size-9 place-items-center rounded-lg border border-border text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-ink-soft hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-4 py-2.5 text-center text-sm font-medium text-ink"
              >
                Log In
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-full bg-brand px-4 py-2.5 text-center text-sm font-medium text-brand-foreground"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
