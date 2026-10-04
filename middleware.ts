import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon, images, and other static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

// NOTE: route protection itself lives in lib/supabase/middleware.ts
// (PROTECTED_PREFIXES there). A duplicate, unused list used to be declared
// here — it wasn't wired to anything and was missing the newer
// /organization, /manufacturer, /seller, /repair, /device routes, which
// made it actively misleading. Removed; see lib/supabase/middleware.ts for
// the real, now-updated list.
