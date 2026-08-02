import { useEffect, useRef } from 'react'

import { triggerHaptic } from '@/lib/haptics'

/**
 * Document-level horizontal swipe detection for the mobile sessions push.
 * Swipe RIGHT (finger left→right) on chat opens Sessions from the LEFT;
 * swipe LEFT on Sessions pops back to chat.
 *
 * iOS-safe rules (see pwa-mobile-gestures skill):
 * - document-level listeners, NOT element refs (element handlers silently
 *   fail on iOS inside scrollable/lazy React trees)
 * - `passive: false` on touchstart/touchmove guarantees synchronous delivery
 * - 20px deadzone before deciding direction; vertical movement aborts
 * - 60px horizontal threshold to fire
 * - callbacks held in a ref so the effect never re-subscribes
 * - fires a haptic on commit (user-requested 2026-08-03)
 */
export function useSessionsSwipe(
  open: boolean,
  onOpen: () => void,
  onClose: () => void,
  enabled = true,
): void {
  const stateRef = useRef({ open, onOpen, onClose })
  stateRef.current = { open, onOpen, onClose }

  useEffect(() => {
    if (!enabled) return

    let start: { x: number; y: number } | null = null
    let fired = false

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      if (!t) return
      start = { x: t.clientX, y: t.clientY }
      fired = false
    }

    function onTouchMove(e: TouchEvent) {
      if (fired || !start) return
      const t = e.touches[0]
      if (!t) return

      const dx = t.clientX - start.x
      const dy = t.clientY - start.y

      // Deadzone — wait for meaningful movement
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return

      // Abort on vertical swipes (scrolling)
      if (Math.abs(dy) > Math.abs(dx)) {
        start = null
        return
      }

      const s = stateRef.current
      if (dx > 60 && !s.open) {
        // Swipe right (finger left→right) on chat → push Sessions in from the LEFT
        fired = true
        start = null
        triggerHaptic('selection')
        s.onOpen()
      } else if (dx < -60 && s.open) {
        // Swipe left on Sessions → pop back to chat
        fired = true
        start = null
        triggerHaptic('selection')
        s.onClose()
      }
    }

    function reset() {
      start = null
      fired = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: false })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', reset, { passive: true })
    document.addEventListener('touchcancel', reset, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', reset)
      document.removeEventListener('touchcancel', reset)
    }
  }, [enabled])
}
