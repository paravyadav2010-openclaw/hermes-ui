import { useEffect } from 'react'

/**
 * Mobile layout metrics for smooth keyboard behavior and composer clearance.
 *
 * Publishes two CSS vars on <html>:
 * - `--keyboard-inset`: height of the on-screen keyboard, px.
 * - `--composer-stack-height`: measured height of the composer ROOT (surface +
 *   floating pills), px. The thread clearance vars only cover the surface, so
 *   the jump-to-bottom arrow anchored by them lands BEHIND the pills.
 *
 * Keyboard strategy (Capacitor wrapper):
 * - WKWebView's `resize: "native"` delays fixed-element reflow until the
 *   keyboard animation finishes → composer hides behind the keyboard then pops.
 * - With `resize: "none"` (capacitor.config.json) the webview does NOT resize;
 *   the Keyboard plugin's `keyboardWillShow` event fires BEFORE the animation
 *   with the exact keyboardHeight → we set the var immediately, and the
 *   composer's `bottom` transition (320ms bezier) glides it up in sync.
 * - Fallback for non-Capacitor contexts (plain Safari / desktop):
 *   visualViewport delta = innerHeight - visualViewport.height.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const root = document.documentElement

    const setInset = (px: number) => root.style.setProperty('--keyboard-inset', `${px}px`)
    const clearInset = () => root.style.removeProperty('--keyboard-inset')

    // 1) Capacitor Keyboard plugin (primary — deterministic, pre-animation)
    interface CapKeyboard {
      addListener?: (event: string, cb: (info: { keyboardHeight?: number }) => void) => Promise<{ remove?: () => void }>
      removeAllListeners?: () => Promise<void>
    }
    const cap = (window as unknown as { Capacitor?: { Plugins?: { Keyboard?: CapKeyboard } } })
      .Capacitor?.Plugins?.Keyboard

    if (cap?.addListener) {
      void cap.addListener('keyboardWillShow', info => {
        setInset(Math.max(0, info.keyboardHeight ?? 0))
      })
      void cap.addListener('keyboardWillHide', () => clearInset())
    }

    // 2) visualViewport fallback (non-Capacitor)
    const vv = window.visualViewport
    function updateVisual() {
      if (!vv) return
      setInset(Math.max(0, window.innerHeight - vv.height))
    }

    // 3) Composer stack height — measured, so the jump arrow clears the pills.
    function measureComposer() {
      const el = document.querySelector<HTMLElement>('[data-slot="composer-root"]')
      if (el) root.style.setProperty('--composer-stack-height', `${el.offsetHeight}px`)
    }
    measureComposer()
    const mo = new ResizeObserver(measureComposer)
    const composerEl = document.querySelector<HTMLElement>('[data-slot="composer-root"]')
    if (composerEl) mo.observe(composerEl)
    // The composer may mount after this effect (lazy routes) — poll briefly.
    const mountTimer = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>('[data-slot="composer-root"]')
      if (el) {
        mo.observe(el)
        measureComposer()
        window.clearInterval(mountTimer)
      }
    }, 500)
    window.setTimeout(() => window.clearInterval(mountTimer), 5000)

    if (vv) {
      updateVisual()
      vv.addEventListener('resize', updateVisual)
      vv.addEventListener('scroll', updateVisual)
      window.addEventListener('resize', updateVisual)
    }

    return () => {
      mo.disconnect()
      window.clearInterval(mountTimer)
      if (vv) {
        vv.removeEventListener('resize', updateVisual)
        vv.removeEventListener('scroll', updateVisual)
        window.removeEventListener('resize', updateVisual)
      }
      void cap?.removeAllListeners?.()
      clearInset()
      root.style.removeProperty('--composer-stack-height')
    }
  }, [])
}
