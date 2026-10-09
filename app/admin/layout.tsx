import type { ReactNode } from "react"
import { requireAdminPage } from "@/lib/auth/admin"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage()
  return children
}
