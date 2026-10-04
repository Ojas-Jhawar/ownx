import { FileX2, ShieldOff, HelpCircle } from "lucide-react"

const PROBLEMS = [
  {
    icon: FileX2,
    title: "Lost warranties",
    copy: "Important documents disappear into inboxes, drawers and WhatsApp chats.",
  },
  {
    icon: ShieldOff,
    title: "Broken trust",
    copy: "Buyers can't really verify what they're actually buying.",
  },
  {
    icon: HelpCircle,
    title: "Forgotten history",
    copy: "Repairs, warranties and ownership records disappear with every transaction.",
  },
]

export function Problem() {
  return (
    <section className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20 lg:py-24">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Physical ownership is still stuck in the past.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-white">
                <p.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{p.copy}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-lg font-medium text-white/90">
          Ownx turns all of it into one persistent record.
        </p>
      </div>
    </section>
  )
}
