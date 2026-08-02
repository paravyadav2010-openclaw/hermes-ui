import { useEffect } from 'react'

/**
 * Tracks the on-screen keyboard via the VisualViewport API and publishes its
 * height as `--keyboard-inset` on <html>, so the mobile composer / thread /
 * jump-to-bottom button can transition smoothly instead of being covered and
 * then popping when WKWebView's delayed layout resize finally lands.
 *
 * Why visualViewport and not Capacitor's Keyboard plugin: this SPA also runs
 * in plain Safari (PWA) where the plugin doesn't exist; visualViewport fires
 * during the keyboard animation in both environments, so one mechanism covers
 * every surface. The CSS uses `transition: bottom …` on the composer root, so
 * each resize tick animates rather than jumps.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const root = document.documentElement

    if (!('visualViewport' in window) || !window.visualViewport) {
      return
    }

    function update() {
      const vv = window.visualViewport!
      const inset = Math.max(0, window.innerHeight - vv.height)
      root.style.setProperty('--keyboard-inset', `${inset}px`)
    }

    const vv = window.visualViewport
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}
