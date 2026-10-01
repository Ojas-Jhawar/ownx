import { randomInt } from "crypto"

// Permanent, human-readable device identifier. Excludes visually-ambiguous
// characters (0/O, 1/I) so it's easy to key in at a repair counter.
//
// FIX: this previously used `Math.floor(Math.random() * chars.length)`.
// Math.random() is not a cryptographically secure RNG and its output can be
// predicted after observing a handful of samples. An Ownx ID is used to
// look up and claim a specific device (lookupDeviceByOwnxId, seller "record
// sale" flow), so predictability matters — someone who could guess IDs in
// advance could pre-emptively look up devices before they're claimed.
// crypto.randomInt() is a CSPRNG and is available in the Node runtime this
// server action already runs in.
export function generateOwnxId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let id = "OWNX-"
  for (let i = 0; i < 8; i++) id += chars[randomInt(0, chars.length)]
  return id
}
