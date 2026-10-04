import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/create",
  "/passport",
  "/service",
  "/resale",
  "/onboarding",
  "/settings",
  "/transfers",
  "/organization",
  "/manufacturer",
  "/seller",
  "/repair",
  "/device",
  // Added: /admin/organizations is a real, admin-only page now — it already
  // redirects non-admins itself, but it was missing from this list, so edge-
  // level protection silently didn't cover it (unauthenticated requests
  // would hit the page's own supabase.auth.getUser() check instead of being
  // redirected at the middleware layer like every other app route).
  "/admin",
]
// Note: /share/[slug] and /p/[slug] are deliberately NOT in this list — they
// are the public, no-login read-only passport/listing pages.

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // IMPORTANT: this call must not be removed — it refreshes the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("next", path)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}
