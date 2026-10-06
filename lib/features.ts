// Single source of truth for feature flags. Resale is paused (see roadmap §0).
// Flip NEXT_PUBLIC_RESALE_ENABLED=true to bring it back.
export const RESALE_ENABLED = process.env.NEXT_PUBLIC_RESALE_ENABLED === "true"
