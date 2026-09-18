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
]