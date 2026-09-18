// Permanent, human-readable device identifier. Excludes visually-ambiguous
// characters (0/O, 1/I) so it's easy to key in at a repair counter.
export function generateOwnxId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let id = "OWNX-"
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}