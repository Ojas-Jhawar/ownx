import { redirect } from "next/navigation"

// Superseded — merged into the unified device advisor so people don't have
// to fill out two separate forms for what's really one decision. Kept as a
// redirect so any bookmarked/shared /tools/scrap-value links still work.
export default function Page() {
  redirect("/tools/device-advisor")
}
