import { BadgeCheck, ShieldAlert, CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"
import { verificationLabel, type VerificationStatus } from "@/lib/verification"

const STYLES: Record<VerificationStatus, { icon: typeof BadgeCheck; classes: string }> = {
  verified: { icon: BadgeCheck, classes: "bg-brand-soft text-brand" },
  formerly_verified: { icon: ShieldAlert, classes: "bg-amber-500/10 text-amber-600" },
  unverified: { icon: CircleHelp, classes: "bg-muted text-muted-foreground" },
}

export function VerificationBadge({
  status,
  className,
  showTooltip = true,
}: {
  status: VerificationStatus
  className?: string
  showTooltip?: boolean
}) {
  const { icon: Icon, classes } = STYLES[status]
  const { label, detail } = verificationLabel(status)

  return (
    <span
      title={showTooltip ? detail : undefined}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", classes, className)}
    >
      <Icon className="size-3.5" /> {label}
    </span>
  )
}
