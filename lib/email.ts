import "server-only"

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

// Resend over plain fetch (no new dependency). Returns false instead of throwing so
// a mail outage never blocks a transfer or a cron run.
export async function sendEmail(p: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set, skipping:", p.subject)
    return false
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "Ownx <onboarding@resend.dev>", ...p }),
    })
    if (!res.ok) console.error("[email] send failed", res.status, await res.text())
    return res.ok
  } catch (e) {
    console.error("[email] send error", e)
    return false
  }
}
