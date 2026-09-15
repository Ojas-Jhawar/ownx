import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ShoppingBag, ShieldCheck, IdCard, Wrench, RefreshCw, Send } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Eyebrow } from "@/components/ui-kit"

const STEPS = [
  { icon: ShoppingBag, title: "Purchase", copy: "Buy your asset and get the invoice." },
  { icon: ShieldCheck, title: "Verify", copy: "Confirm invoice and serial number." },
  { icon: IdCard, title: "Passport", copy: "Ownx builds your Ownership Passport." },
  { icon: Wrench, title: "Maintain", copy: "Add service and condition updates." },
  { icon: RefreshCw, title: "Resell", copy: "Share verified history." },
  { icon: Send, title: "Transfer", copy: "Pass the passport to the next owner." },
]

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Your asset gets a history from day one.
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Ownx turns purchase documents into a living record that stays with the asset.
          </p>

          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand text-brand-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="grid items-stretch gap-4 overflow-hidden rounded-3xl border border-border md:grid-cols-2">
            <div className="relative min-h-64 bg-muted">
              <Image src="/images/workspace.png" alt="A laptop, phone and headphones on a desk" fill className="object-cover" />
            </div>
            <div className="flex flex-col justify-center bg-brand-soft/60 p-8 sm:p-10">
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                From receipt to resale — all in one place.
              </h2>
              <p className="mt-3 text-muted-foreground">
                No lost documents. No broken trust. Just a complete history.
              </p>
              <Link
                href="/create"
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5"
              >
                Create Your Passport <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
