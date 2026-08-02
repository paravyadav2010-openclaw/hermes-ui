import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { triggerHaptic } from '@/lib/haptics'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { $gatewayState, $yoloActive, setYoloActive } from '@/store/session'
import { $activeGatewayProfile } from '@/store/profile'

/**
 * Gateway status ring — left edge of the composer pill row, mirror of the
 * context ring on the right. Same visual language (faint track + colored arc):
 * - open        → green, full arc
 * - connecting / reconnecting → amber, ¾ arc
 * - closed / idle / error → red, ½ arc
 * Tap → popover with the same info the old bottom status bar showed: gateway
 * state, active profile, YOLO status (toggle). SVG wrapped in a
 * pointer-events:none span so taps reach the button on iOS.
 */
const RING_R = 12
const RING_CIRC = 2 * Math.PI * RING_R
const RING_SIZE = 32

function stateArc(state: string): { color: string; pct: number } {
  if (state === 'open') return { color: '#22c55e', pct: 100 }
  if (state === 'connecting' || state === 'reconnecting') return { color: '#f59e0b', pct: 75 }
  return { color: '#ef4444', pct: 50 }
}

function stateLabel(state: string, copy: { ready: string; connecting: string; offline: string }): string {
  if (state === 'open') return copy.ready
  if (state === 'connecting' || state === 'reconnecting') return copy.connecting
  return copy.offline
}

export function GatewayStatusRing() {
  const { t } = useI18n()
  const copy = t.shell.statusbar
  const gatewayState = useStore($gatewayState)
  const yoloActive = useStore($yoloActive)
  const activeProfile = useStore($activeGatewayProfile)
  const [open, setOpen] = useState(false)

  const { color, pct } = stateArc(gatewayState)
  const fillOffset = RING_CIRC * (1 - pct / 100)

  return (
    <span className="relative inline-flex">
      <button
        aria-label="Gateway status"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full p-0 tap-highlight-transparent"
        onClick={() => setOpen(o => !o)}
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
        <span className="pointer-events-none absolute text-[8px] font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {gatewayState === 'open' ? <Codicon className="text-white" name="plug" size="0.875rem" /> : null}
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
            className="fixed left-3 z-[96] w-56 rounded-xl border border-(--ui-stroke-tertiary) bg-(--dt-background) p-3 shadow-2xl"
            style={{ bottom: 'calc(var(--composer-stack-height, 0px) + var(--keyboard-inset, 0px) + 1.5rem)' }}
          >
            <div className="flex items-center justify-between gap-2 text-[0.7rem]">
              <span className="text-(--ui-text-tertiary)">Gateway</span>
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span className="size-2 rounded-full" style={{ background: color }} />
                {stateLabel(gatewayState, { ready: copy.gatewayReady, connecting: copy.gatewayConnecting, offline: copy.gatewayOffline })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[0.7rem]">
              <span className="text-(--ui-text-tertiary)">Profile</span>
              <span className="truncate font-medium text-foreground">{activeProfile || 'default'}</span>
            </div>
            <div className="my-1.5 h-px bg-(--ui-stroke-tertiary)/50" />
            <button
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-[0.7rem] tap-highlight-transparent active:bg-(--chrome-action-hover)/50"
              onClick={() => {
                triggerHaptic('selection')
                setYoloActive(!yoloActive)
              }}
              type="button"
            >
              <span className="flex items-center gap-1.5 text-(--ui-text-tertiary)">
                <Codicon name="zap" size="0.75rem" />
                YOLO
              </span>
              <span className={yoloActive ? 'font-semibold text-amber-400' : 'text-muted-foreground'}>
                {yoloActive ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </>,
        document.body
      )}
    </span>
  )
}
