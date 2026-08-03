import { useStore } from '@nanostores/react'
import { useRef, useState } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  dropdownMenuRow,
  dropdownMenuSectionLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import { $activeSessionId, $currentReasoningEffort, setCurrentReasoningEffort } from '@/store/session'

const EFFORT_OPTIONS = [
  { value: 'minimal', labelKey: 'minimal' },
  { value: 'low', labelKey: 'low' },
  { value: 'medium', labelKey: 'medium' },
  { value: 'high', labelKey: 'high' },
  { value: 'xhigh', labelKey: 'max' }
] as const

const PILL = cn(
  'h-(--composer-control-size) max-w-40 shrink-0 gap-1 rounded-full border border-(--ui-stroke-secondary)/70 px-2 text-xs font-medium',
  'bg-(--ui-bg-elevated) text-foreground shadow-sm hover:bg-(--ui-bg-elevated) hover:text-white'
)

function isThinkingEnabled(effort: string): boolean {
  return (effort || 'medium').trim().toLowerCase() !== 'none'
}

function normalizeEffort(effort: string): string {
  const value = (effort || 'medium').trim().toLowerCase()

  if (value === 'none') {
    return ''
  }

  return EFFORT_OPTIONS.some(o => o.value === value) ? value : 'medium'
}

export function EffortPill({ disabled }: { disabled: boolean }) {
  const { t } = useI18n()
  const copy = t.shell.modelOptions
  const reasoningEffort = useStore($currentReasoningEffort)
  const activeSessionId = useStore($activeSessionId)
  const { requestGateway } = useGatewayRequest()
  const [open, setOpen] = useState(false)
  const effortRequestRef = useRef(0)

  const thinkingOn = isThinkingEnabled(reasoningEffort)
  const effortValue = normalizeEffort(reasoningEffort)
  const displayLabel = reasoningEffort && reasoningEffort !== 'none' ? reasoningEffort : 'off'

  const patchEffort = (next: string) => {
    triggerHaptic('selection')
    const previous = reasoningEffort
    const requestId = ++effortRequestRef.current
    setCurrentReasoningEffort(next)

    // A session owns its own model and thinking configuration. Persist this
    // choice on that active session, rather than letting the next status event
    // restore the effort it had when it was first created. With no session, the
    // local choice is intentionally staged for session.create.
    if (!activeSessionId) {
      return
    }

    void requestGateway('config.set', { key: 'reasoning', session_id: activeSessionId, value: next }).catch(err => {
      // Do not let a slower failed request undo a newer user choice.
      if (requestId === effortRequestRef.current) {
        setCurrentReasoningEffort(previous)
        notifyError(err, copy.updateFailed)
      }
    })
  }

  const toggleThinking = (on: boolean) => {
    patchEffort(on ? 'medium' : 'none')
  }

  return (
    <DropdownMenu
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          triggerHaptic('close')
        }

        setOpen(nextOpen)
      }}
      open={open}
    >
      <Tip label={copy.effort} side="top">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={copy.effort}
            className={PILL}
            disabled={disabled}
            onPointerDown={() => triggerHaptic('open')}
            type="button"
            variant="ghost"
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="size-2.5 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="w-52 p-0" side="top" sideOffset={8}>
        <DropdownMenuLabel className={dropdownMenuSectionLabel}>{copy.options}</DropdownMenuLabel>
        <div className={dropdownMenuRow} onSelect={e => e.preventDefault()}>
          {copy.thinking}
          <Switch
            checked={thinkingOn}
            className="ml-auto"
            onCheckedChange={toggleThinking}
            size="xs"
          />
        </div>
        <DropdownMenuSeparator className="mx-0" />
        <DropdownMenuLabel className={dropdownMenuSectionLabel}>{copy.effort}</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={patchEffort} value={effortValue}>
          {EFFORT_OPTIONS.map(option => (
            <DropdownMenuRadioItem
              className={dropdownMenuRow}
              key={option.value}
              onSelect={e => e.preventDefault()}
              value={option.value}
            >
              {copy[option.labelKey]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
