import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { compactNumber } from '@/lib/format'
import { modelBaseId } from '@/lib/model-status-label'
import { LiveDuration } from '@/lib/statusbar'
import {
  $busy,
  $currentModel,
  $currentUsage,
  $gatewayState,
  $sessionStartedAt,
  $turnStartedAt,
  $yoloActive,
  setModelPickerOpen,
  setYoloActive,
} from '@/store/session'
import { Activity, AlertCircle, ChevronDown, Loader2, ZapFilled } from '@/lib/icons'

/**
 * Lower status bar for the phone — the PWA's context ring replaces the old
 * "pixel bar" (█░ text). Same information, new UI:
 * - LEFT: gateway dot · model name (tap → model picker) · yolo
 * - RIGHT: turn timer (when busy) · session timer · context ring
 *
 * The ring is a circular SVG showing context-window usage % with color tiers
 * (blue <70%, orange 70–90%, red >90%). Tap → detail popover (model, used,
 * limit, usage). SVG is wrapped in a pointer-events:none span so taps reach
 * the button on iOS (pwa-mobile-gestures rule).
 */
const RING_R = 11.5
const RING_CIRC = 2 * Math.PI * RING_R
const RING_SIZE = 30

function ringColor(pct: number): string {
  if (pct >= 90) return '#dc4b46'
  if (pct >= 70) return '#c2790f'
  return '#2540ff'
}

function fmtTokens(n: number): string {
  return compactNumber(Math.max(0, Math.round(n)))
}

export function StatusRingBar() {
  const gatewayState = useStore($gatewayState)
  const currentModel = useStore($currentModel)
  const yoloActive = useStore($yoloActive)
  const busy = useStore($busy)
  const turnStartedAt = useStore($turnStartedAt)
  const sessionStartedAt = useStore($sessionStartedAt)
  const usage = useStore($currentUsage)
  const [ringOpen, setRingOpen] = useState(false)

  const gatewayOk = gatewayState === 'open'

  const used = usage.context_used ?? usage.total ?? 0
  const limit = usage.context_max ?? 0
  const pct = limit > 0 ? Math.min(100, Math.max(0, Math.round((used / limit) * 100))) : 0
  const color = ringColor(pct)
  const fillOffset = RING_CIRC * (1 - pct / 100)

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-(--ui-stroke-tertiary)/30 bg-(--dt-background)/85 backdrop-blur-[0.75rem]">
      <div className="flex h-8 items-center justify-between px-3 text-[10px] text-(--ui-text-tertiary) tabular-nums pb-[env(safe-area-inset-bottom,0px)]">
        {/* Left: gateway state + model name */}
        <span className="flex min-w-0 items-center gap-2 overflow-hidden">
          {gatewayOk ? (
            <Activity className="size-2.5 shrink-0 text-green-500" />
          ) : (
            <AlertCircle className="size-2.5 shrink-0 text-amber-500" />
          )}
          <button
            onClick={() => setModelPickerOpen(true)}
            className="flex max-w-28 cursor-pointer items-center gap-1 truncate text-[0.65rem] font-medium text-foreground/85 hover:text-foreground"
            type="button"
          >
            <span className="truncate">{modelBaseId(currentModel) || 'Model'}</span>
            <ChevronDown className="size-2.5 shrink-0 opacity-70" />
          </button>
          {yoloActive && (
            <button onClick={() => setYoloActive(false)} className="flex shrink-0 items-center gap-0.5 hover:text-foreground" type="button">
              <ZapFilled className="size-2.5" />
            </button>
          )}
        </span>

        {/* Right: turn timer · session timer · context ring */}
        <span className="flex items-center gap-2">
          {busy && turnStartedAt && (
            <span className="flex items-center gap-1">
              <Loader2 className="size-2.5 animate-spin" />
              <LiveDuration since={turnStartedAt} />
            </span>
          )}
          {sessionStartedAt ? (
            <span><LiveDuration since={sessionStartedAt} /></span>
          ) : null}

          {/* Context ring — replaces the pixel bar. Tap → details popover. */}
          <span className="relative inline-flex">
            <button
              aria-label="Context usage"
              className="hm-context-ring flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full p-0"
              onClick={() => setRingOpen(o => !o)}
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
                    strokeWidth={3}
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
                    strokeWidth={3}
                    style={{ transition: 'stroke-dashoffset 0.3s, stroke 0.3s' }}
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  />
                </svg>
              </span>
              <span className="pointer-events-none absolute text-[8px] font-bold leading-none text-white">{pct}</span>
            </button>

            {ringOpen && (
              <>
                <button
                  aria-hidden="true"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setRingOpen(false)}
                  tabIndex={-1}
                  type="button"
                />
                <div className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom,0px)+0.5rem)] right-0 z-20 w-52 rounded-xl border border-(--ui-stroke-tertiary) bg-(--dt-background) p-3 shadow-2xl">
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
                    <span className="font-medium" style={{ color }}>{pct}%</span>
                  </div>
                </div>
              </>
            )}
          </span>
        </span>
      </div>
    </div>
  )
}
