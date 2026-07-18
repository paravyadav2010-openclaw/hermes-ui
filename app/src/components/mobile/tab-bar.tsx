import { useStore } from '@nanostores/react'
import { $mobileTab, type MobileTab, setMobileTab, openMobileDrawer, toggleMobileSheet, closeAllMobile, closeMobileDrawer, $mobileDrawerOpen } from '@/store/mobile'
import { $sidebarOpen, $fileBrowserOpen, FILE_BROWSER_PANE_ID } from '@/store/layout'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

const TABS: { id: MobileTab; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: 'comment-discussion' },
  { id: 'sessions', label: 'Sessions', icon: 'history' },
  { id: 'files', label: 'Files', icon: 'file' },
  { id: 'more', label: 'More', icon: 'kebab-vertical' },
]

const BADGE_CLASS = 'absolute -right-1.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-(--dt-primary) px-1 text-[9px] font-semibold text-(--dt-primary-foreground) leading-none'

export function TabBar() {
  const activeTab = useStore($mobileTab)
  const mobileDrawerOpen = useStore($mobileDrawerOpen)
  const sidebarOpen = useStore($sidebarOpen)
  const fileBrowserOpen = useStore($fileBrowserOpen)
  const unreadCount = 0

  return (
    <nav
      data-mobile-tabbar
      className="flex h-12 shrink-0 items-center justify-around border-t border-(--ui-stroke-tertiary) bg-(--dt-background) px-2 pb-[env(safe-area-inset-bottom,0px)]"
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        const hasBadge = tab.id === 'sessions' && (sidebarOpen || unreadCount > 0)
        const hasFileBadge = tab.id === 'files' && fileBrowserOpen
        return (
          <button
            key={tab.id}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 tap-highlight-transparent',
              isActive
                ? 'text-(--dt-primary)'
                : 'text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)'
            )}
            onClick={() => {
              try { triggerHaptic('selection'); } catch(e) {}
              switch (tab.id) {
                case 'chat':
                  closeAllMobile()
                  break
                case 'sessions':
                  if (mobileDrawerOpen === 'chat-sidebar') closeMobileDrawer()
                  else openMobileDrawer('chat-sidebar')
                  break
                case 'files':
                  if (mobileDrawerOpen === FILE_BROWSER_PANE_ID) closeMobileDrawer()
                  else openMobileDrawer(FILE_BROWSER_PANE_ID)
                  break
                case 'more':
                  toggleMobileSheet('more-menu')
                  break
              }
              setMobileTab(tab.id)
            }}
            type="button"
          >
            <span className={`codicon codicon-${tab.icon} text-lg`} />
            <span className="text-[10px] font-medium">{tab.label}</span>
            {tab.id === 'sessions' && hasBadge && (
              <span className={BADGE_CLASS}>{unreadCount || '•'}</span>
            )}
            {tab.id === 'files' && hasFileBadge && (
              <span className={BADGE_CLASS}>•</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
