import { registerSW } from 'virtual:pwa-register'

// autoUpdate: Workbox skips waiting and claims clients, so the newest app shell
// takes over as soon as it is precached. onNeedRefresh never fires under this
// registerType, so no prompt UI is needed here.
export function registerPwa(): void {
  // In the Capacitor wrapper the app is loaded from the HTTPS proxy (9445)
  // and the WKWebView starts a fresh session per launch — a stale service
  // worker precache is pure liability: it served the OLD bundle for hours
  // after a rebuild (the mic/dictation regression, 2026-08-03). Unregister
  // any previously installed SW and skip registration on native so every
  // launch fetches the current bundle. Regular browsers keep the SW.
  const inCapacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  )

  if (inCapacitor) {
    void navigator.serviceWorker?.getRegistrations?.().then(registrations => {
      for (const registration of registrations) {
        void registration.unregister()
      }
    })

    return
  }

  registerSW({ immediate: true })
}
