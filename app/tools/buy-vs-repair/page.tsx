import { redirect } from "next/navigation"

// Superseded — merged into the unified device advisor. Kept as a redirect
// so any bookmarked/shared /tools/buy-vs-repair links still work.
export default function Page() {
  redirect("/tools/device-advisor")
}
