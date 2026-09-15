import { Check, FileText } from "lucide-react"

const FOUND = ["Product identified", "Serial number found", "Purchase date found", "Warranty found", "Passport ready"]

export function Documents() {
  return (
    <section className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your documents. Now understood.</h2>
          <p className="mt-3 max-w-md text-white/60">
            Ownx reads your invoices and receipts, then extracts everything that matters into a structured record.
          </p>
          <ul className="mt-8 space-y-3">
            {FOUND.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm">
                <span className="grid size-6 place-items-center rounded-full bg-brand text-brand-foreground">
                  <Check className="size-3.5" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-white/40">Analyzing document</p>
            <div className="mt-4 space-y-3">
              {[
                "invoice_apple_store.pdf",
                "warranty_certificate.pdf",
                "purchase_receipt.jpg",
              ].map((doc) => (
                <div key={doc} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-white/70">
                    <FileText className="size-4" />
                  </span>
                  <span className="truncate text-sm text-white/80">{doc}</span>
                  <span className="ml-auto text-xs text-brand">Parsed</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
