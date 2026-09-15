export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function warrantyRemaining(purchaseDate: string | null, warrantyMonths: number | null): {
  label: string
  active: boolean
} {
  if (!purchaseDate || !warrantyMonths) return { label: "Unknown", active: false }
  const start = new Date(purchaseDate)
  const end = new Date(start)
  end.setMonth(end.getMonth() + warrantyMonths)
  const now = new Date()
  if (end < now) return { label: "Out of warranty", active: false }
  const monthsLeft = Math.max(
    0,
    (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()),
  )
  return { label: `${monthsLeft} month${monthsLeft === 1 ? "" : "s"} left`, active: true }
}

// Shows just enough of a serial number to feel verified without handing out
// the whole thing on a link anyone can open.
export function maskSerial(serial: string | null | undefined): string {
  if (!serial) return "—"
  const s = serial.trim()
  if (s.length <= 6) return s
  return `${s.slice(0, 2)}••••${s.slice(-4)}`
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || name.slice(0, 2).toUpperCase()
}
