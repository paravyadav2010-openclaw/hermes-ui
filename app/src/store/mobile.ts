import { atom } from 'nanostores'

export type MobileTab = 'chat' | 'sessions' | 'files' | 'more'

export const $mobileTab = atom<MobileTab>('chat')
export const $mobileDrawerOpen = atom<string | null>(null)
export const $mobileSheetOpen = atom<string | null>(null)

export function setMobileTab(tab: MobileTab) { $mobileTab.set(tab) }
export function openMobileDrawer(paneId: string) { $mobileDrawerOpen.set(paneId) }
export function closeMobileDrawer() { $mobileDrawerOpen.set(null) }
export function toggleMobileSheet(sheetId: string) {
  const current = $mobileSheetOpen.get()
  $mobileSheetOpen.set(current === sheetId ? null : sheetId)
}
export function closeMobileSheet() { $mobileSheetOpen.set(null) }
export function closeAllMobile() {
  $mobileDrawerOpen.set(null)
  $mobileSheetOpen.set(null)
}
