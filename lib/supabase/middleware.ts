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
  // Added: these business-dashboard routes each already self-redirect to
  // /login when there's no session, but they were missing from this list,
  // so edge-level protection silently didn't cover them. Keeping this list
  // in sync matters more now that it's the *only* copy — see middleware.ts.
  "/organization",
  "/manufacturer",
  "/seller",
  "/repair",
  "/device",
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
