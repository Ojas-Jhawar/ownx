"use client"

import { useMemo, useState } from "react"
import {
  Sparkles,
  Loader2,
  ShoppingBag,
  ArrowUpCircle,
  Wrench,
  Store,
  Recycle,
  CheckCircle2,
  AlertTriangle,
  Terminal,
} from "lucide-react"
import { runAiDiagnosis } from "@/app/actions/diagnose"
import { getDiagnoseQuestions, getDeviceCommands, needsDeviceCheck, normalizeCategory } from "@/lib/diagnose-questions"
import type { AiDiagnosis, RecommendationAction } from "@/lib/types"

const ACTION_META: Record<RecommendationAction, { label: string; icon: typeof ShoppingBag; tone: string }> = {
  buy_accessory: { label: "Buy an accessory", icon: ShoppingBag, tone: "text-brand" },
  upgrade: { label: "Upgrade", icon: ArrowUpCircle, tone: "text-brand" },
  repair: { label: "Repair", icon: Wrench, tone: "text-amber-600" },
  sell: { label: "Sell it", icon: Store, tone: "text-brand" },
  recycle: { label: "Recycle", icon: Recycle, tone: "text-muted-foreground" },
  keep_using: { label: "Keep using", icon: CheckCircle2, tone: "text-emerald-600" },
}

export function AiDiagnose({
  assetId,
  category,
  onDone,
}: {
  assetId: string
  category: string | null
  onDone?: () => void
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/90"
      >
        <Sparkles className="size-4 text-brand" /> Run AI Diagnose
      </button>
    )
  }

  return (
    <DiagnoseWizard
      assetId={assetId}
      category={category}
      onClose={() => {
        setOpen(false)
        onDone?.()
      }}
    />
  )
}

function DiagnoseWizard({
  assetId,
  category,
  onClose,
}: {
  assetId: string
  category: string | null
  onClose: () => void
}) {
  const questions = useMemo(() => getDiagnoseQuestions(category), [category])
  const deviceCommands = useMemo(() => getDeviceCommands(category), [category])
  const showDeviceCheck = needsDeviceCheck(category)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [deviceOS, setDeviceOS] = useState(deviceCommands[0]?.os ?? "")
  const [deviceOutput, setDeviceOutput] = useState("")
  const [skippedDeviceCheck, setSkippedDeviceCheck] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiDiagnosis | null>(null)

  const allAnswered = questions.every((q) => answers[q.id])
  const deviceStepOk = !showDeviceCheck || skippedDeviceCheck || deviceOutput.trim().length > 0
  const canSubmit = allAnswered && deviceStepOk

  async function handleSubmit() {
    setError(null)
    setPending(true)
    try {
      const labelled: Record<string, string> = {}
      for (const q of questions) {
        const opt = q.options.find((o) => o.value === answers[q.id])
        labelled[q.label] = opt?.label ?? answers[q.id]
      }
      const activeCommand = deviceCommands.find((c) => c.os === deviceOS)
      const deviceCheck =
        showDeviceCheck && !skippedDeviceCheck && deviceOutput.trim() && activeCommand
          ? { os: activeCommand.os, command: activeCommand.command, output: deviceOutput.trim() }
          : null

      const diagnosis = await runAiDiagnosis({
        assetId,
        category: normalizeCategory(category),
        surveyAnswers: labelled,
        deviceCheck,
      })
      setResult(diagnosis as AiDiagnosis)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't run the diagnosis. Try again.")
    } finally {
      setPending(false)
    }
  }

  if (result) return <DiagnoseResult result={result} onClose={onClose} />

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand" />
        <h2 className="font-semibold text-ink">AI Diagnose</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Answer a few questions about its current condition — the more accurate, the better the AI Score and
        recommendation.
      </p>

      <div className="mt-4 space-y-5">
        {questions.map((q) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-ink">{q.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map((o) => {
                const selected = answers[q.id] === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
                    className={
                      selected
                        ? "rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground"
                        : "rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-muted"
                    }
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {showDeviceCheck && (
          <div className="rounded-xl border border-dashed border-border bg-background p-4">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-brand" />
              <p className="text-sm font-medium text-ink">Real battery check (optional but recommended)</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Run this on the device itself, then paste the output below — the AI reads the real numbers instead of
              guessing.
            </p>

            {deviceCommands.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {deviceCommands.map((c) => (
                  <button
                    key={c.os}
                    type="button"
                    onClick={() => setDeviceOS(c.os)}
                    className={
                      deviceOS === c.os
                        ? "rounded-full bg-ink px-3 py-1 text-xs font-medium text-white"
                        : "rounded-full border border-border px-3 py-1 text-xs font-medium text-ink hover:bg-muted"
                    }
                  >
                    {c.os}
                  </button>
                ))}
              </div>
            )}

            {deviceCommands
              .filter((c) => c.os === deviceOS)
              .map((c) => (
                <div key={c.os} className="mt-3">
                  <code className="block overflow-x-auto rounded-lg bg-ink px-3 py-2 text-xs text-white">
                    {c.command}
                  </code>
                  <p className="mt-1.5 text-xs text-muted-foreground">{c.help}</p>
                  <textarea
                    value={deviceOutput}
                    onChange={(e) => setDeviceOutput(e.target.value)}
                    rows={4}
                    placeholder="Paste the command output here…"
                    className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              ))}

            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={skippedDeviceCheck}
                onChange={(e) => setSkippedDeviceCheck(e.target.checked)}
                className="size-3.5 rounded border-input"
              />
              I can't run this right now — score battery from my answers above instead
            </label>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5" /> {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Analysing…
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" /> Generate AI Score
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function DiagnoseResult({ result, onClose }: { result: AiDiagnosis; onClose: () => void }) {
  const meta = ACTION_META[result.recommendation_action]
  const Icon = meta.icon
  const bars = [
    { label: "Battery", value: result.score_breakdown.battery },
    { label: "Performance", value: result.score_breakdown.performance },
    { label: "Cosmetic", value: result.score_breakdown.cosmetic },
    { label: "Functionality", value: result.score_breakdown.functionality },
  ].filter((b) => b.value !== null) as { label: string; value: number }[]

  const costRange =
    result.estimated_cost_min !== null && result.estimated_cost_max !== null
      ? `${result.estimated_cost_currency} ${result.estimated_cost_min.toLocaleString()}–${result.estimated_cost_max.toLocaleString()}`
      : null

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-600" />
        <p className="text-sm font-medium text-ink">Saved to product history</p>
      </div>

      <div className="mt-4 grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-brand-soft px-8 py-6 text-center">
          <div className="text-4xl font-semibold text-brand">{result.ai_score}</div>
          <div className="text-xs text-brand/70">AI Score /100</div>
        </div>

        {bars.length > 0 && (
          <div className="space-y-3">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-soft">{b.label}</span>
                  <span className="font-medium text-ink">{b.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${b.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-ink-soft">{result.condition_summary}</p>

      {result.key_findings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {result.key_findings.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
              {f}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 ${meta.tone}`} />
          <p className="text-sm font-semibold text-ink">{result.recommendation_title}</p>
          {result.urgency !== "low" && (
            <span
              className={
                result.urgency === "high"
                  ? "rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase text-destructive"
                  : "rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-600"
              }
            >
              {result.urgency} priority
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{result.recommendation_detail}</p>
        {costRange && (
          <p className="mt-2 text-sm font-medium text-ink">
            Expected cost: <span className="text-brand">{costRange}</span>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted"
      >
        Done
      </button>
    </div>
  )
}
