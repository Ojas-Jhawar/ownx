import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Shared by listings.ts — turns "MacBook Pro 14" into something like
// "macbook-pro-14-x7f2q", short and URL-safe. Fine for listings: they're
// meant to be found/shared/indexed, so guessability isn't a security concern
// — the worst case is someone stumbles onto a listing that's already public
// by design.
export function randomSlug(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  )
}

// SECURITY: passport_shares.slug is different from a listing slug — it's a
// bearer capability token. Anyone who has the URL can read the asset's
// verified details and full service history (see app/share/[slug]/page.tsx),
// so it needs to be unguessable, not just unique. `randomSlug`'s ~5-char
// Math.random() suffix (~25 bits of entropy) is fine for a discoverable
// listing but too weak for something gating private-ish data behind
// "nobody will find this link" — treat it as a real secret.
//
// crypto.randomUUID() gives 122 bits of entropy and is available in the
// Node runtime Next.js server actions run in.
export function randomShareToken(input: string) {
  const prefix = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30)
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24)
  return prefix ? `${prefix}-${token}` : token
}
