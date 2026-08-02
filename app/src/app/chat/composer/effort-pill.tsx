import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  dropdownMenuRow,
  dropdownMenuSectionLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $currentReasoningEffort, setCurrentReasoningEffort } from '@/store/session'

const EFFORT_OPTIONS = [
  { value: 'minimal', labelKey: 'minimal' },
  { value: 'low', labelKey: 'low' },
  { value: 'medium', labelKey: 'medium' },
  { value: 'high', labelKey: 'high' },
  { value: 'xhigh', labelKey: 'max' }
] as const

const PILL = cn(
  'h-(--composer-control-size) max-w-40 shrink-0 gap-1 rounded-full border border-border/65 px-2 text-xs font-normal',
  'backdrop-blur-[0.75rem] bg-(--chrome-action-hover)/70 text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
)

function isThinkingEnabled(effort: string): boolean {
  return (effort || 'medium').trim().toLowerCase() !== 'none'
}

function normalizeEffort(effort: string): string {
  const value = (effort || 'medium').trim().toLowerCase()
  if (value === 'none') return ''
  return EFFORT_OPTIONS.some(o => o.value === value) ? value : 'medium'
}

export function EffortPill({ disabled }: { disabled: boolean }) {
  const { t } = useI18n()
  const copy = t.shell.modelOptions
  const reasoningEffort = useStore($currentReasoningEffort)
  const [open, setOpen] = useState(false)

  const thinkingOn = isThinkingEnabled(reasoningEffort)
  const effortValue = normalizeEffort(reasoningEffort)
  const displayLabel = reasoningEffort && reasoningEffort !== 'none' ? reasoningEffort : 'off'

  const patchEffort = (next: string) => {
    setCurrentReasoningEffort(next)
  }

  const toggleThinking = (on: boolean) => {
    setCurrentReasoningEffort(on ? 'medium' : 'none')
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <Tip label={copy.effort} side="top">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={copy.effort}
            className={PILL}
            disabled={disabled}
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
