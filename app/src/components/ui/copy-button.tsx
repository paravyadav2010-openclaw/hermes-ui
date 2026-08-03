import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Check, Copy, X } from '@/lib/icons'
import { cn } from '@/lib/utils'

type CopyPayload = string | (() => Promise<string> | string)
type CopyButtonAppearance = 'button' | 'icon' | 'inline' | 'menu-item' | 'context-menu-item' | 'tool-row'
type CopyStatus = 'copied' | 'error' | 'idle'
const COPIED_RESET_MS = 1_500

/**
 * execCommand('copy') fallback — the PWA 9400-proven path for iOS WKWebView
 * over HTTP (insecure context). navigator.clipboard.writeText can RESOLVE
 * without writing there (feedback fires, pasteboard unchanged), while
 * execCommand runs synchronously inside the user gesture and needs no secure
 * context. Runs on every fallback, not just touch, so desktop is unchanged
 * (its writeText path succeeds first).
 */
function copyViaExecCommand(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  let ok = false

  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }

  document.body.removeChild(textarea)

  return ok
}

export async function writeClipboardText(text: string) {
  if (!text) {
    return
  }

  if (window.hermesDesktop?.writeClipboard) {
    try {
      await window.hermesDesktop.writeClipboard(text)

      return
    } catch {
      // Electron IPC failed — fall through to the web paths.
    }
  }

  // Insecure context (phone app over HTTP tailnet IP): the async Clipboard
  // API is unreliable on iOS WKWebView — it can resolve without writing.
  // execCommand is the only path that reliably lands the copy, so take it
  // FIRST here instead of pretending writeText succeeded.
  if (!window.isSecureContext) {
    if (!copyViaExecCommand(text)) {
      throw new Error('Clipboard API is unavailable')
    }

    return
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)

    return
  }

  if (!copyViaExecCommand(text)) {
    throw new Error('Clipboard API is unavailable')
  }
}

export interface CopyButtonProps {
  appearance?: CopyButtonAppearance
  buttonSize?: React.ComponentProps<typeof Button>['size']
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  errorMessage?: string
  haptic?: boolean
  iconClassName?: string
  label?: string
  onCopied?: () => void
  onCopyError?: (error: unknown) => void
  preventDefault?: boolean
  showLabel?: boolean
  side?: React.ComponentProps<typeof Tip>['side']
  stopPropagation?: boolean
  text: CopyPayload
  title?: string
}

export function CopyButton({
  appearance = 'button',
  buttonSize,
  buttonVariant = 'ghost',
  children,
  className,
  disabled = false,
  errorMessage,
  haptic = true,
  iconClassName,
  label,
  onCopied,
  onCopyError,
  preventDefault = false,
  showLabel,
  side,
  stopPropagation = false,
  text,
  title
}: CopyButtonProps) {
  const { t } = useI18n()
  const resolvedErrorMessage = errorMessage ?? t.common.copyFailed
  const resolvedLabel = label ?? t.common.copy
  const [status, setStatus] = React.useState<CopyStatus>('idle')
  const resetRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (resetRef.current !== null) {
        window.clearTimeout(resetRef.current)
      }
    }
  }, [])

  const copy = React.useCallback(
    async (event?: Event | React.MouseEvent<HTMLElement>) => {
      if (preventDefault) {
        event?.preventDefault()
      }

      if (stopPropagation) {
        event?.stopPropagation()
      }

      try {
        const value = typeof text === 'function' ? await text() : text

        if (!value) {
          return
        }

        await writeClipboardText(value)

        if (haptic) {
          triggerHaptic('selection')
        }

        if (resetRef.current !== null) {
          window.clearTimeout(resetRef.current)
        }

        setStatus('copied')
        resetRef.current = window.setTimeout(() => {
          setStatus('idle')
          resetRef.current = null
        }, COPIED_RESET_MS)
        onCopied?.()
      } catch (error) {
        onCopyError?.(error)

        if (resetRef.current !== null) {
          window.clearTimeout(resetRef.current)
        }

        setStatus('error')
        resetRef.current = window.setTimeout(() => {
          setStatus('idle')
          resetRef.current = null
        }, COPIED_RESET_MS)
      }
    },
    [haptic, onCopied, onCopyError, preventDefault, stopPropagation, text]
  )

  const Icon = status === 'copied' ? Check : status === 'error' ? X : Copy
  const icon = <Icon className={cn('size-3.5', iconClassName)} />

  const visibleChildren =
    (showLabel ?? (appearance !== 'icon' && appearance !== 'tool-row'))
      ? status === 'copied'
        ? t.common.copied
        : status === 'error'
          ? t.common.failed
          : (children ?? resolvedLabel)
      : null

  const content = (
    <>
      {icon}
      {visibleChildren}
    </>
  )

  const feedbackLabel =
    status === 'copied' ? t.common.copied : status === 'error' ? resolvedErrorMessage : (title ?? resolvedLabel)

  const ariaLabel = status === 'idle' ? resolvedLabel : feedbackLabel

  if (appearance === 'menu-item' || appearance === 'context-menu-item') {
    const MenuItem = appearance === 'menu-item' ? DropdownMenuItem : ContextMenuItem

    return (
      <MenuItem
        className={className}
        disabled={disabled}
        onSelect={event => {
          event.preventDefault()
          void copy(event)
        }}
      >
        {content}
      </MenuItem>
    )
  }

  if (appearance === 'inline') {
    return (
      <Tip label={feedbackLabel} side={side}>
        <button
          aria-label={ariaLabel}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.75rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40',
            className
          )}
          disabled={disabled}
          onClick={event => void copy(event)}
          type="button"
        >
          {content}
        </button>
      </Tip>
    )
  }

  if (appearance === 'tool-row') {
    return (
      <Tip label={feedbackLabel}>
        <button
          aria-label={ariaLabel}
          className={cn(
            'grid size-6 place-items-center rounded-md text-muted-foreground/70 opacity-0 transition-opacity hover:bg-accent/55 hover:text-foreground focus-visible:opacity-100 group-hover/tool-row:opacity-100 disabled:opacity-40',
            className
          )}
          disabled={disabled}
          onClick={event => void copy(event)}
          type="button"
        >
          {icon}
        </button>
      </Tip>
    )
  }

  const button = (
    <Button
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      onClick={event => void copy(event)}
      size={buttonSize ?? (appearance === 'icon' ? 'icon' : 'default')}
      type="button"
      variant={buttonVariant}
    >
      {content}
    </Button>
  )

  // Only icon-only buttons need a tooltip; the text variant already shows its label.
  return appearance === 'icon' ? (
    <Tip label={feedbackLabel} side={side ?? 'bottom'}>
      {button}
    </Tip>
  ) : (
    button
  )
}
