import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { compactNumber } from '@/lib/format'
import { modelBaseId } from '@/lib/model-status-label'
import { $currentModel, $currentUsage } from '@/store/session'

/**
 * The PWA-style context ring — circular SVG showing context-window usage %.
 * Replaces the bottom status bar; sits in the floating pills row, right of
 * the effort pill, just below the composer's centre button. Compact: 26px
 * visual (matches the 24px pill height), 30px hit area for touch.
 *
 * Tap → detail popover with the SAME information the bar showed (model, used,
 * limit, usage %). Color tiers: blue <70%, orange 70–90%, red >90%. SVG is
 * wrapped in a pointer-events:none span so taps reach the button on iOS.
 */
const RING_R = 9.5
const RING_CIRC = 2 * Math.PI * RING_R
const RING_SIZE = 26

function ringColor(pct: number): string {
  // Continuous gradient: green (hue 120) → yellow (60) → red (0) as the
  // context window fills. Smooth interpolation, not discrete tiers.
  const hue = Math.max(0, 120 - pct * 1.2)
  return `hsl(${hue} 70% 50%)`
}

function fmtTokens(n: number): string {
  return compactNumber(Math.max(0, Math.round(n)))
}

export function ContextRing() {
  const currentModel = useStore($currentModel)
  const usage = useStore($currentUsage)
  const [open, setOpen] = useState(false)

  const used = usage.context_used ?? usage.total ?? 0
  const limit = usage.context_max ?? 0
  const pct = limit > 0 ? Math.min(100, Math.max(0, Math.round((used / limit) * 100))) : 0
  const color = ringColor(pct)
  const fillOffset = RING_CIRC * (1 - pct / 100)

  return (
    <span className="relative inline-flex">
      <button
        aria-label="Context usage"
        className={cn(
          'flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border border-border/65 p-0 backdrop-blur-[0.75rem] bg-(--chrome-action-hover)/70 tap-highlight-transparent'
        )}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <span className="pointer-events-none inline-flex">
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="none"
              r={RING_R}
              stroke="var(--ui-stroke-tertiary)"
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
        <span className="pointer-events-none absolute text-[7px] font-bold leading-none text-white">{pct}</span>
      </button>

      {open && (
        <>
          <button
            aria-hidden="true"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div className="absolute bottom-full right-0 z-20 mb-2 w-52 rounded-xl border border-(--ui-stroke-tertiary) bg-(--dt-background) p-3 shadow-2xl">
            <div className="flex items-center justify-between gap-2 text-[0.7rem]">
              <span className="text-(--ui-text-tertiary)">Model</span>
              <span className="truncate font-medium text-foreground">{modelBaseId(currentModel) || '—'}</span>
            </div>
            <div className="my-1.5 h-px bg-(--ui-stroke-tertiary)/50" />
            <div className="flex items-center justify-between gap-2 text-[0.7rem]">
              <span className="text-(--ui-text-tertiary)">Used</span>
              <span className="font-medium text-foreground">{fmtTokens(used)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[0.7rem]">
              <span className="text-(--ui-text-tertiary)">Limit</span>
              <span className="font-medium text-foreground">{limit > 0 ? fmtTokens(limit) : '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[0.7rem]">
              <span className="text-(--ui-text-tertiary)">Usage</span>
              <span className="font-medium" style={{ color: ringColor(pct) }}>{pct}%</span>
            </div>
          </div>
        </>
      )}
    </span>
  )
}
