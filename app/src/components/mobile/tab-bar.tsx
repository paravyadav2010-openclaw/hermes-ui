import { useStore } from '@nanostores/react'
import { $mobileTab, type MobileTab, setMobileTab, openMobileDrawer, toggleMobileSheet, closeAllMobile, closeMobileDrawer, $mobileDrawerOpen } from '@/store/mobile'
import { $sidebarOpen, $fileBrowserOpen, FILE_BROWSER_PANE_ID } from '@/store/layout'
import { $sessionStartedAt, $currentUsage, $busy, $turnStartedAt, $gatewayState, $yoloActive, setYoloActive, $currentModel, setModelPickerOpen } from '@/store/session'
import { triggerHaptic } from '@/lib/haptics'
import { contextBarLabel, usageContextLabel, LiveDuration } from '@/lib/statusbar'
import { modelBaseId } from '@/lib/model-status-label'
import { cn } from '@/lib/utils'
import { Loader2, Activity, AlertCircle, ChevronDown, ZapFilled } from '@/lib/icons'

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
  const sessionStartedAt = useStore($sessionStartedAt)
  const currentUsage = useStore($currentUsage)
  const busy = useStore($busy)
  const turnStartedAt = useStore($turnStartedAt)
  const gatewayState = useStore($gatewayState)
  const yoloActive = useStore($yoloActive)
  const unreadCount = 0

  const contextUsage = usageContextLabel(currentUsage)
  const contextBar = contextBarLabel(currentUsage)
  const gatewayOk = gatewayState === 'open'
  const currentModel = useStore($currentModel)

  return (
    <nav
      data-mobile-tabbar
      className="flex h-20 shrink-0 flex-col border-t border-(--ui-stroke-tertiary) bg-(--dt-background)"
    >
      <div className="flex flex-1 items-center justify-around px-2 pb-0 pt-1">
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
      </div>
      {/* Status bar — at the bottom of the tab bar */}
      <div className="flex h-5 shrink-0 items-center justify-between border-t border-(--ui-stroke-tertiary)/30 px-2.5 text-[10px] text-(--ui-text-tertiary) tabular-nums">
        {/* Left: gateway state + model name */}
        <span className="flex items-center gap-2 min-w-0 overflow-hidden">
          {gatewayOk ? (
            <Activity className="size-2.5 shrink-0 text-green-500" />
          ) : (
            <AlertCircle className="size-2.5 shrink-0 text-amber-500" />
          )}
          <button
              onClick={() => setModelPickerOpen(true)}
              className="flex items-center gap-1 truncate max-w-28 text-[0.65rem] text-foreground/85 hover:text-foreground cursor-pointer font-medium"
              type="button"
            >
              <span className="truncate">{modelBaseId(currentModel) || 'Model'}</span>
              <ChevronDown className="size-2.5 shrink-0 opacity-70" />
            </button>
          {yoloActive && (
            <button onClick={() => setYoloActive(false)} className="flex items-center gap-0.5 shrink-0 hover:text-foreground" type="button">
              <ZapFilled className="size-2.5" />
            </button>
          )}
        </span>
        {/* Right: running timer · session timer · token usage */}
        <span className="flex items-center gap-2">
          {busy && turnStartedAt && (
            <span className="flex items-center gap-1">
              <Loader2 className="size-2.5 animate-spin" />
              <LiveDuration since={turnStartedAt} />
            </span>
          )}
          {sessionStartedAt ? (
            <span><LiveDuration since={sessionStartedAt} /></span>
          ) : null}
          {contextUsage ? (
            <span>{contextUsage}{contextBar ? ` · ${contextBar}` : ''}</span>
          ) : null}
        </span>
      </div>
    </nav>
  )
}
