import Link from "next/link"
import { Upload, ScanLine } from "lucide-react"
import { FlowShell } from "@/components/flow/flow-shell"

export default function Page() {
  return (
    <FlowShell currentStep={0} backHref="/dashboard">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">What would you like to add?</h1>
        <p className="mt-2 text-sm text-muted-foreground">Start with one asset. You can add more anytime.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/create/upload"
          className="group flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center transition-colors hover:border-brand/50"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
            <Upload className="size-6" />
          </span>
          <h2 className="mt-4 font-semibold text-ink">Upload Invoice</h2>
          <p className="mt-1 text-sm text-muted-foreground">Let Ownx extract your product details automatically.</p>
          <span className="mt-4 w-full rounded-full bg-brand py-2.5 text-sm font-medium text-brand-foreground transition-transform group-hover:-translate-y-0.5">
            Upload Invoice
          </span>
        </Link>

        <Link
          href="/create/upload?capture=1"
          className="group flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center transition-colors hover:border-brand/50"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
            <ScanLine className="size-6" />
          </span>
          <h2 className="mt-4 font-semibold text-ink">Scan Product</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your camera to photograph the invoice directly.</p>
          <span className="mt-4 w-full rounded-full border border-border py-2.5 text-sm font-medium text-ink transition-colors group-hover:bg-muted">
            Scan Product
          </span>
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">Supported: PDF, JPG, PNG</p>
    </FlowShell>
  )
}
