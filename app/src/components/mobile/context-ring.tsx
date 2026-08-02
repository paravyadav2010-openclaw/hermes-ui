import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { ContextUsageBar } from '@/app/shell/context-usage-panel'
import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { compactNumber } from '@/lib/format'
import { Codicon } from '@/components/ui/codicon'
import { $currentUsage } from '@/store/session'
import type { ContextBreakdown } from '@/types/hermes'

/**
 * The PWA-style context ring — circular SVG showing context-window usage %.
 * Replaces the bottom context bar; floats at the RIGHT edge of the composer's
 * pill row, beside the effort pill. The ring itself has NO background —
 * just the bare stroke circle floating over the UI.
 *
 * Tap → the same information the bottom context bar showed: Context Usage,
 * used/limit tokens, % full, the segmented usage bar and the full category
 * breakdown (system prompt, tool definitions, rules, skills, subagent
 * definitions, memory, conversation…), fetched live from the gateway via
 * `session.context_breakdown`.
 *
 * Color: continuous gradient green→yellow→red (HSL hue 120→0) as the context
 * window fills. SVG is wrapped in a pointer-events:none span so taps reach
 * the button on iOS.
 */
const RING_R = 12
const RING_CIRC = 2 * Math.PI * RING_R
const RING_SIZE = 32

function ringColor(pct: number): string {
  // Continuous gradient: green (hue 120) → yellow (60) → red (0) as the
  // context window fills. Smooth interpolation, not discrete tiers.
  const hue = Math.max(0, 120 - pct * 1.2)
  return `hsl(${hue} 70% 50%)`
}

export function ContextRing({ sessionId, onCompress }: { sessionId: string | null; onCompress?: () => void }) {
  const { t } = useI18n()
  const copy = t.shell.statusbar.contextUsagePanel
  const usage = useStore($currentUsage)
  const { requestGateway } = useGatewayRequest()
  const [open, setOpen] = useState(false)
  const [breakdown, setBreakdown] = useState<ContextBreakdown | null>(null)
  const [loading, setLoading] = useState(false)

  const used = breakdown?.context_used ?? usage.context_used ?? usage.total ?? 0
  const limit = breakdown?.context_max ?? usage.context_max ?? 0
  const pct = limit > 0 ? Math.min(100, Math.max(0, Math.round(breakdown?.context_percent ?? ((used / limit) * 100)))) : 0
  const color = ringColor(pct)
  const fillOffset = RING_CIRC * (1 - pct / 100)

  const toggle = () => {
    const next = !open
    setOpen(next)

    if (next && !breakdown && !loading && sessionId) {
      setLoading(true)
      void requestGateway<ContextBreakdown>('session.context_breakdown', { session_id: sessionId })
        .then(data => setBreakdown(data))
        .catch(() => setBreakdown(null))
        .finally(() => setLoading(false))
    }
  }

  const categories = (breakdown?.categories ?? []).map(category => ({
    ...category,
    label: copy.categories[category.id as keyof typeof copy.categories] ?? category.label
  }))
  const segmentTotal = categories.reduce((sum, category) => sum + category.tokens, 0) || used || 1

  return (
    <span className="relative inline-flex">
      <button
        aria-label="Context usage"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full p-0 tap-highlight-transparent"
        onClick={toggle}
        type="button"
      >
        <span className="pointer-events-none inline-flex">
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            {/* Empty-tube track: faint full circle so the remaining space is
                visible when usage is low (a bare quarter arc reads as broken).
                Deliberately muted — the colored arc is the star. */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="none"
              r={RING_R}
              stroke="var(--ui-stroke-tertiary)"
              strokeOpacity={0.75}
              strokeWidth={2.5}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="none"
              r={RING_R}
              stroke={color}
              strokeDasharray={RING_CIRC}
              strokeDashoffset={fillOffset}
              strokeLinecap="round"
              strokeWidth={2.5}
              style={{ transition: 'stroke-dashoffset 0.3s, stroke 0.3s' }}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </svg>
        </span>
        <span className="pointer-events-none absolute text-[8px] font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{pct}</span>
      </button>

      {open && createPortal(
        <>
          <button
            aria-hidden="true"
            className="fixed inset-0 z-[95] cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div className="fixed right-3 z-[96] w-72 rounded-xl border border-(--ui-stroke-tertiary) bg-(--dt-background) p-3 shadow-2xl"
            style={{ bottom: 'calc(var(--composer-stack-height, 0px) + var(--keyboard-inset, 0px) + 1.5rem)' }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium text-foreground">{copy.title}</p>
              <span className="text-[0.6875rem] text-muted-foreground">
                {copy.tokenSummary(`~${compactNumber(used)}`, compactNumber(limit))}
              </span>
            </div>
            <p className="mt-0.5 text-[0.6875rem] text-foreground">{copy.percentFull(pct)}</p>

            <div className="mt-2">
              <ContextUsageBar categories={categories} segmentTotal={segmentTotal} />
            </div>

            <ul className="mt-2.5 flex flex-col gap-1.5">
              {categories.map(category => (
                <li className="flex items-center justify-between gap-2" key={category.id}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-[2px]" style={{ background: category.color }} />
                    <span className="truncate text-muted-foreground">{category.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground">{compactNumber(category.tokens)}</span>
                </li>
              ))}
            </ul>

            {loading && <p className="mt-2 text-[0.6875rem] text-muted-foreground">{copy.loading}</p>}
            {!loading && !categories.length && (
              <p className="mt-2 text-[0.6875rem] text-muted-foreground">{copy.empty}</p>
            )}

            {onCompress && (
              <button
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/65 bg-(--chrome-action-hover)/60 py-2 text-xs font-medium text-foreground tap-highlight-transparent active:scale-[0.98] transition-transform"
                onClick={() => {
                  triggerHaptic('submit')
                  setOpen(false)
                  onCompress()
                }}
                type="button"
              >
                <Codicon name="fold" size="0.875rem" />
                Compress context
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </span>
  )
}
