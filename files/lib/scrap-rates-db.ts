import type { SupabaseClient } from "@supabase/supabase-js"
import { SCRAP_PROFILES, type CategoryProfile, type ScrapCategory } from "./scrap-rates"

export interface LoadedRates {
  profiles: Record<ScrapCategory, CategoryProfile>
  /** Most recent edit across all rate rows, ISO string. null = using built-in defaults. */
  updatedAt: string | null
  fromDb: boolean
}

// Starts from the built-in defaults and overlays whatever the admin has set in
// public.scrap_rates. If the table is missing or empty the defaults are used,
// so the page never breaks.
export async function loadScrapProfiles(supabase: SupabaseClient): Promise<LoadedRates> {
  const profiles = structuredClone(SCRAP_PROFILES)
  const { data, error } = await supabase
    .from("scrap_rates")
    .select("category, name, kind, pct_of_weight, rate_per_kg, grams, rate_per_gram, updated_at")
  if (error || !data || data.length === 0) return { profiles, updatedAt: null, fromDb: false }

  let latest: string | null = null
  for (const row of data) {
    const profile = profiles[row.category as ScrapCategory]
    if (!profile) continue
    const m = profile.materials.find((x) => x.name === row.name && x.kind === row.kind)
    if (!m) continue
    if (m.kind === "weight") {
      if (row.pct_of_weight !== null) m.pctOfWeight = Number(row.pct_of_weight)
      if (row.rate_per_kg !== null) m.ratePerKgINR = Number(row.rate_per_kg)
    } else {
      if (row.grams !== null) m.grams = Number(row.grams)
      if (row.rate_per_gram !== null) m.ratePerGramINR = Number(row.rate_per_gram)
    }
    if (!latest || row.updated_at > latest) latest = row.updated_at
  }
  return { profiles, updatedAt: latest, fromDb: true }
}
