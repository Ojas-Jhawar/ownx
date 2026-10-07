export function warrantyEndDate(purchaseDate: string | null, months: number | null): Date | null {
  if (!purchaseDate || !months) return null
  const d = new Date(purchaseDate)
  if (Number.isNaN(d.getTime())) return null
  d.setMonth(d.getMonth() + months)
  return d
}

/** Whole days until warranty ends. Negative = already expired. null = unknown. */
export function warrantyDaysLeft(purchaseDate: string | null, months: number | null, now = new Date()): number | null {
  const end = warrantyEndDate(purchaseDate, months)
  return end ? Math.ceil((end.getTime() - now.getTime()) / 86_400_000) : null
}
