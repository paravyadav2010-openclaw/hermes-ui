import { useCallback, useEffect, useRef, useState } from 'react'

import { writeClipboardText } from '@/components/ui/copy-button'
import { triggerHaptic } from '@/lib/haptics'

const DEFAULT_RESET_MS = 1_600

/**
 * Copy text with a transient "Copied" feedback state.
 *
 * Used by double-click-to-copy surfaces (thread messages, user bubble, inline
 * code). Single source of truth for the copied → idle reset timer so every
 * surface behaves identically (PWA 9400 parity, 2026-08-03).
 */
export function useCopyFeedback(resetMs: number = DEFAULT_RESET_MS) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const value = text.trim()

      if (!value) {
        return false
      }

      try {
        await writeClipboardText(value)
      } catch {
        return false
      }

      triggerHaptic('selection')

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }

      setCopied(true)
      timerRef.current = window.setTimeout(() => setCopied(false), resetMs)

      return true
    },
    [resetMs]
  )

  return { copied, copy }
}
