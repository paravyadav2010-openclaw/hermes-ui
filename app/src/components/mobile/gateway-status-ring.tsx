import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { GatewayMenuPanel } from '@/app/shell/gateway-menu-panel'
import { useStatusSnapshot } from '@/app/shell/hooks/use-status-snapshot'
import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { triggerHaptic } from '@/lib/haptics'
import { LiveDuration } from '@/lib/statusbar'
import { setSessionYolo } from '@/lib/yolo-session'
import {
  $activeSessionId,
  $busy,
  $gatewayState,
  $sessionStartedAt,
  $turnStartedAt,
  $yoloActive,
  setYoloActive
} from '@/store/session'
import { cn } from '@/lib/utils'
import { ZapFilled } from '@/lib/icons'

/**
 * Gateway status ring — left edge of the composer pill row, mirror of the
 * context ring on the right. Same visual language (faint track + colored arc):
 * - open        → green, full arc
 * - connecting / reconnecting → amber, ¾ arc
 * - closed / idle / error → red, ½ arc
 * Tap → THE SAME GatewayMenuPanel the desktop gateway indicator opens
 * (Connected / Inference ready / recent activity log tail / messaging
 * platforms), portaled above the composer. SVG wrapped in a
 * pointer-events:none span so taps reach the button on iOS.
 */
const RING_R = 16
const RING_CIRC = 2 * Math.PI * RING_R
const RING_SIZE = 42

function stateArc(state: string, inferenceReady: boolean): { color: string; pct: number } {
  // Fully healthy: green full arc + "OK". Any warning (connecting, closed,
  // error, or inference not ready) → "!" with amber/red per severity.
  if (state === 'open' && inferenceReady) return { color: '#22c55e', pct: 100 }
  if (state === 'open' || state === 'connecting' || state === 'reconnecting') return { color: '#f59e0b', pct: 75 }
  return { color: '#ef4444', pct: 50 }
}

export function GatewayStatusRing() {
  const gatewayState = useStore($gatewayState)
  const { requestGateway } = useGatewayRequest()
  const { inferenceStatus, statusSnapshot } = useStatusSnapshot(gatewayState, requestGateway)
  const [open, setOpen] = useState(false)

  const yoloActive = useStore($yoloActive)
  const busy = useStore($busy)
  const sessionStartedAt = useStore($sessionStartedAt)
  const turnStartedAt = useStore($turnStartedAt)

  const toggleYolo = async () => {
    const next = !yoloActive
    setYoloActive(next)
    triggerHaptic('selection')

    const sid = $activeSessionId.get()

    try {
      if (sid) {
        await setSessionYolo(requestGateway, sid, next)
      } else if (next) {
        // No runtime session yet (fresh draft) — arm locally; the session-create
        // path applies it once the backend session exists.
      }
    } catch {
      setYoloActive(!next)
    }
  }

  const inferenceReady = gatewayState === 'open' && inferenceStatus?.ready !== false
  const { color, pct } = stateArc(gatewayState, inferenceReady)
  const fillOffset = RING_CIRC * (1 - pct / 100)
  const healthy = gatewayState === 'open' && inferenceReady
  const label = healthy ? 'OK' : '!'

  return (
    <span className="relative inline-flex">
      <button
        aria-label="Gateway status"
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full p-0 tap-highlight-transparent"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--ui-bg-elevated) 55%, transparent) 0%, transparent 72%)'
        }}
        onClick={() => {
          triggerHaptic(open ? 'close' : 'open')
          setOpen(o => !o)
        }}
        type="button"
      >
        <span className="pointer-events-none inline-flex">
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            {/* Empty-tube track, same language as the context ring */}
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
        <span className="pointer-events-none absolute text-[11px] font-bold leading-none text-(--ui-text-primary) drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
          {label}
        </span>
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
          <div
            className="fixed left-3 z-[96] max-h-[70dvh] w-[19rem] overflow-y-auto rounded-xl border border-(--ui-stroke-tertiary) bg-(--dt-background) pb-1 shadow-2xl"
            style={{ bottom: 'calc(var(--composer-stack-height, 0px) + var(--keyboard-inset, 0px) + 1.5rem)' }}
          >
            {/* Status-bar leftovers that don't live in the desktop panel:
                YOLO bypass toggle + turn/session elapsed timers. */}
            <div className="flex items-center justify-between gap-2 border-b border-(--ui-stroke-tertiary)/40 px-3 py-2 text-[0.6875rem] text-(--ui-text-secondary) tabular-nums">
              <button
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors tap-highlight-transparent',
                  yoloActive
                    ? 'bg-(--chrome-action-hover) text-amber-400'
                    : 'text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)'
                )}
                onClick={() => void toggleYolo()}
                type="button"
              >
                <ZapFilled className="size-3.5" />
                <span>{yoloActive ? 'YOLO on' : 'YOLO'}</span>
              </button>
              <span className="flex items-center gap-2">
                {busy && turnStartedAt ? (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
                    <LiveDuration since={turnStartedAt} />
                  </span>
                ) : null}
                {sessionStartedAt ? <LiveDuration since={sessionStartedAt} /> : null}
              </span>
            </div>
            {/* Same popover as the desktop gateway indicator — same info, same
                live data (log tail polls while open, platforms from the
                status snapshot, inference readiness). */}
            <GatewayMenuPanel
              gatewayState={gatewayState}
              inferenceStatus={inferenceStatus}
              onClose={() => setOpen(false)}
              onOpenSystem={() => setOpen(false)}
              statusSnapshot={statusSnapshot}
            />
          </div>
        </>,
        document.body
      )}
    </span>
  )
}
