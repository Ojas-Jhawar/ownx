#!/usr/bin/env python3
"""Run from the repo root:  python3 /path/to/ownx-patch/apply.py
Copies new/replaced files, then makes targeted edits. Every edit reports OK / SKIP / FAIL.
Review with `git diff` before committing."""
import json, re, shutil, sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = Path.cwd()
if not (ROOT / "package.json").exists():
    sys.exit("Run this from the Ownx repo root (package.json not found).")

shutil.copytree(HERE / "files", ROOT, dirs_exist_ok=True)
print("copied files/ over repo")

fails = 0
def edit(path, old, new, regex=False, flags=0, marker=None):
    global fails
    p = ROOT / path
    if not p.exists():
        print(f"FAIL  {path}: file not found"); fails += 1; return
    s = p.read_text()
    if (marker or new) in s and not regex:
        print(f"SKIP  {path}: already applied"); return
    if regex:
        t, n = re.subn(old, new, s, count=1, flags=flags)
    else:
        n = 1 if old in s else 0
        t = s.replace(old, new, 1)
    if n == 0:
        print(f"FAIL  {path}: pattern not found -> {old[:60]!r}"); fails += 1; return
    p.write_text(t); print(f"OK    {path}")

# --- Build-breaking fixes ---
edit("app/passport/[id]/page.tsx",
     r"(\{ data: pastTransfersRaw \},\s*)\] = await Promise\.all",
     r"\1{ data: openReport },\n  ] = await Promise.all", regex=True)
edit("app/passport/[id]/page.tsx",
     '<ReportLostCard assetId={asset.id} openReport={openReport} />',
     '''<ReportLostCard assetId={asset.id} openReport={openReport} />

            <div className="mt-4 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-semibold text-ink">What is it worth as scrap?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Estimate its recycling value from its materials, prefilled from this passport.</p>
              <Link
                href={`/tools/scrap-value?${new URLSearchParams({ cat: asset.category || "", date: asset.purchase_date || "", price: String(asset.purchase_price ?? ""), condition: String(asset.condition_score ?? "") }).toString()}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink hover:bg-muted"
              >
                Check scrap value <ArrowRight className="size-4" />
              </Link>
            </div>''', marker="What is it worth as scrap?")

# Dashboard: AttentionCard was inside the heading row
edit("app/dashboard/page.tsx",
     r'\s*\{filter !== "warranty" && <AttentionCard assets=\{assets\} />\}', "", regex=True)
edit("app/dashboard/page.tsx",
     '<div className="mt-6 flex items-center justify-between">',
     '{filter !== "warranty" && <AttentionCard assets={assets} />}\n\n        <div className="mt-6 flex items-center justify-between">',
     marker='{filter !== "warranty" && <AttentionCard assets={assets} />}\n\n        <div className="mt-6')

# --- Dark mode bug (text-ink on dark background) ---
edit("app/globals.css", r"\n\.dark \{.*?\n\}\n", "\n", regex=True, flags=re.S)
edit("app/globals.css", r"\n@media \(prefers-color-scheme: dark\) \{.*?\n  \}\n\}\n", "\n", regex=True, flags=re.S)

# --- Correctness / trust copy ---
edit("app/transfers/page.tsx", '.ilike("to_email", user.email || "")', '.eq("to_email", (user.email || "").toLowerCase())')
edit("app/transfers/page.tsx", 'import { acceptDeviceTransfer, declineDeviceTransfer } from "@/app/actions/devices"\n', "", marker="__never__")
edit("app/create/review/page.tsx", "asset.condition_score ?? 90", "asset.condition_score")
edit("app/create/review/page.tsx", 'label="Condition score (0–100)"', 'label="Condition score (0–100, your estimate)"')
edit("components/service/ai-diagnose.tsx", 'label: "Sell it"', 'label: "Consider selling later"')
edit("app/p/[slug]/page.tsx", 'import { getAssetVerification } from "@/lib/verification"', 'import { getPublicAssetVerification } from "@/lib/verification"')
edit("app/p/[slug]/page.tsx", "await getAssetVerification(supabase, listing.asset_id)", "await getPublicAssetVerification(supabase, listing.asset_id)")
edit("app/p/[slug]/page.tsx",
     '<ShieldCheck className="size-4 text-brand" /> This is a verified listing powered by Ownx.',
     '<ShieldCheck className="size-4 text-brand" />{" "}{verification === "verified" ? "Registered by a manufacturer or approved seller." : "Entered by the owner. Ownx has not verified this item."}')

# --- Model id (both places) ---
p = ROOT / "lib/anthropic.ts"
s = p.read_text()
if '"claude-sonnet-5"' in s:
    p.write_text(s.replace('"claude-sonnet-5"', '"claude-sonnet-5-5"')); print("OK    lib/anthropic.ts model id")
else:
    print("SKIP  lib/anthropic.ts model id")

# --- Blog AI draft function appended to lib/anthropic.ts ---
s = p.read_text()
if "generateBlogDraft" not in s:
    s += '''

// ----------------------------------------------------------------------------
// Blog drafting (admin only, saved as a draft for a human to review)
// ----------------------------------------------------------------------------
export interface BlogDraft {
  title: string
  excerpt: string
  content: string
  category: "guide" | "maintenance" | "sustainability" | "news"
  tags: string[]
}

const BLOG_TOOL = {
  name: "record_blog_draft",
  description: "Record a draft blog post.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" },
      excerpt: { type: "string", description: "Max 180 characters." },
      content: { type: "string", description: "Markdown. Use ## headings, short paragraphs, lists. 500 to 800 words." },
      category: { type: "string", enum: ["guide", "maintenance", "sustainability", "news"] },
      tags: { type: "array", items: { type: "string" }, description: "2 to 5 lowercase tags." },
    },
    required: ["title", "excerpt", "content", "category", "tags"],
  },
}

export async function generateBlogDraft(topic: string): Promise<BlogDraft> {
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    max_tokens: 3000,
    system:
      "You write helpful, plain-language blog posts for Ownx, an ownership-passport app for physical products, for readers in India. " +
      "Be practical and specific. Never invent statistics, laws, prices or quotes. If you are unsure of a fact, leave it out or say " +
      "\\"check current rules\\". Add a one-line 'not legal or financial advice' note when touching on law or money. " +
      "End with a short call to action to create an Ownx passport. Do not use hype.",
    messages: [{ role: "user", content: `Write a blog post about: ${topic}` }],
    tools: [BLOG_TOOL],
    tool_choice: { type: "tool", name: "record_blog_draft" },
  })
  const toolUse = response.content.find((b) => b.type === "tool_use")
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("No draft returned")
  const d = toolUse.input as BlogDraft
  return { ...d, tags: (d.tags || []).slice(0, 5) }
}
'''
    p.write_text(s); print("OK    lib/anthropic.ts blog draft fn")
else:
    print("SKIP  lib/anthropic.ts blog draft fn")

# Admin blog edit page must load tags
edit("app/admin/blog/[id]/page.tsx", '"id, slug, title, excerpt, cover_image_url, content, category, status"', '"id, slug, title, excerpt, cover_image_url, content, category, status, tags"')

# --- Navigation ---
edit("components/site-header.tsx", 'import { Logo } from "@/components/logo"', 'import { Logo } from "@/components/logo"\nimport { RESALE_ENABLED } from "@/lib/features"')
edit("components/site-header.tsx", "const NAV = [", "const ALL_NAV = [")
edit("components/site-header.tsx", '  { label: "Blog", href: "/blog" },', '  { label: "Blog", href: "/blog" },\n  { label: "Check an Item", href: "/check" },')
edit("components/site-header.tsx", "export function SiteHeader() {",
     'const NAV = ALL_NAV.filter((i) => RESALE_ENABLED || i.href !== "/marketplace")\n\nexport function SiteHeader() {')

edit("components/app/app-shell.tsx", 'import { Logo } from "@/components/logo"', 'import { Logo } from "@/components/logo"\nimport { RESALE_ENABLED } from "@/lib/features"')
edit("components/app/app-shell.tsx", "const BASE_NAV: NavItem[] = [", "const ALL_BASE_NAV: NavItem[] = [")
edit("components/app/app-shell.tsx", "const BUSINESS_ITEM: NavItem",
     'const BASE_NAV = ALL_BASE_NAV.filter((i) => RESALE_ENABLED || i.label !== "Marketplace")\nconst BUSINESS_ITEM: NavItem')
edit("components/app/app-shell.tsx", "  UserCog,\n} from", "  UserCog,\n  PenLine,\n} from")
edit("components/app/app-shell.tsx", "const SETTINGS_ITEM: NavItem",
     'const ADMIN_BLOG_ITEM: NavItem = { label: "Blog", href: "/admin/blog", icon: PenLine }\nconst ADMIN_SCRAP_ITEM: NavItem = { label: "Scrap rates", href: "/admin/scrap-rates", icon: Wrench }\nconst SETTINGS_ITEM: NavItem')
edit("components/app/app-shell.tsx", "...(isAdmin ? [ADMIN_ITEM] : []),", "...(isAdmin ? [ADMIN_ITEM, ADMIN_BLOG_ITEM, ADMIN_SCRAP_ITEM] : []),")

edit("components/site-footer.tsx", '{ label: "Privacy", href: "#" }', '{ label: "Privacy", href: "/privacy" }')
edit("components/site-footer.tsx", '{ label: "Terms", href: "#" }', '{ label: "Terms", href: "/terms" }')
edit("components/site-footer.tsx", '      { label: "Device Advisor", href: "/tools/device-advisor" },',
     '      { label: "Device Advisor", href: "/tools/device-advisor" },\n      { label: "Scrap Value", href: "/tools/scrap-value" },\n      { label: "Check an Item", href: "/check" },')
edit("app/sitemap.ts", '"/marketplace", "/privacy", "/terms"]', '"/marketplace", "/privacy", "/terms", "/check", "/tools/scrap-value"]')

# --- Marketing copy: drop resale as a headline ---
edit("app/features/page.tsx", '{ icon: BadgeCheck, title: "Verified Resale", copy: "Share history instead of making claims." }',
     '{ icon: BadgeCheck, title: "Verified Sharing", copy: "Show proof instead of making claims." }')
edit("app/how-it-works/page.tsx", '{ icon: RefreshCw, title: "Resell", copy: "Share verified history." }',
     '{ icon: RefreshCw, title: "Share", copy: "Send a read-only proof link." }')
edit("app/how-it-works/page.tsx", "From receipt to resale — all in one place.", "From receipt to repair — all in one place.")
edit("components/home/lifecycle.tsx", '{ icon: RefreshCw, title: "Resell", copy: "Verified ownership" }',
     '{ icon: RefreshCw, title: "Share", copy: "Proof on demand" }')

# --- package.json scripts ---
pj = ROOT / "package.json"
d = json.loads(pj.read_text())
d.setdefault("scripts", {}).update({"test": "vitest run", "typecheck": "tsc --noEmit"})
pj.write_text(json.dumps(d, indent=2) + "\n"); print("OK    package.json scripts")

# --- Env example ---
env = ROOT / ".env.example"
if env.exists() and "ADMIN_EMAIL" not in env.read_text():
    env.write_text(env.read_text().rstrip() + "\n\n# Optional: receives a reminder when scrap rates go stale\nADMIN_EMAIL=\n"); print("OK    .env.example")

# --- Cleanup ---
shutil.rmtree(ROOT / "check_once", ignore_errors=True)
for junk in ROOT.glob("app/actions/#*#"):
    junk.unlink(); print("removed", junk)
print("removed check_once/")

print(f"\nDone. {fails} edit(s) failed." + (" Fix those by hand (see PATCH_NOTES.md)." if fails else " Now run: pnpm typecheck && pnpm test"))
