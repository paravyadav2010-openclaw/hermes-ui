import { type ReactNode, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useMobile } from '@/hooks/use-mobile'
import { PREVIEW_PANE_ID, FILE_BROWSER_PANE_ID } from '@/store/layout'
import { REVIEW_PANE_ID } from '@/store/review'
import { TabBar } from './tab-bar'
import { MobileDrawer } from './mobile-drawer'
import { BottomSheet } from './bottom-sheet'
import { openMobileDrawer, closeMobileDrawer, $mobileDrawerOpen } from '@/store/mobile'
import { PANE_TOGGLE_REVEAL_EVENT } from '@/components/pane-shell'
import { NEW_CHAT_ROUTE } from '@/app/routes'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'

interface MobileLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  fileBrowser: ReactNode
  review?: ReactNode
  terminal?: ReactNode
  preview?: ReactNode
  moreMenu?: ReactNode
}

export function MobileLayout({ children, sidebar, fileBrowser, review, terminal, preview, moreMenu }: MobileLayoutProps) {
  const isMobile = useMobile()
  const navigate = useNavigate()
  if (!isMobile) return <>{children}</>

  // Bridge swipe gestures (hermes:pane-toggle-reveal) to mobile drawer state.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail
      if (!detail?.id) return
      if ($mobileDrawerOpen.get() === detail.id) {
        closeMobileDrawer()
      } else {
        openMobileDrawer(detail.id)
      }
    }
    window.addEventListener(PANE_TOGGLE_REVEAL_EVENT, handler)
    return () => window.removeEventListener(PANE_TOGGLE_REVEAL_EVENT, handler)
  }, [])

  const newChatFab = (
    <Button
      aria-label="New chat"
      className="size-12 cursor-pointer rounded-full bg-(--ui-control-active-background) text-(--ui-text-primary) shadow-lg hover:bg-(--ui-control-active-background)/80 active:scale-95 transition-transform"
      onClick={() => { navigate(NEW_CHAT_ROUTE); closeMobileDrawer() }}
      size="icon"
      variant="ghost"
    >
      <Codicon name="add" size="1.25rem" />
    </Button>
  )

  return (
    <div className="flex h-dvh flex-col bg-(--dt-background)">
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      <TabBar />

      <MobileDrawer id="chat-sidebar" title="Sessions" fullWidth fab={newChatFab}>
        <SidebarProvider className="flex min-h-0 flex-1 flex-col" style={{ '--sidebar-width': '100%' } as React.CSSProperties}>{sidebar}</SidebarProvider>
      </MobileDrawer>
      <MobileDrawer id={FILE_BROWSER_PANE_ID} title="Files">{fileBrowser}</MobileDrawer>
      {preview && <BottomSheet id={PREVIEW_PANE_ID} title="Preview" maxHeight="75vh">{preview}</BottomSheet>}
      {review && <BottomSheet id={REVIEW_PANE_ID} title="Review" maxHeight="60vh">{review}</BottomSheet>}
      {terminal && <BottomSheet id="terminal-sidebar" title="Terminal" maxHeight="50vh">{terminal}</BottomSheet>}
      {moreMenu && <BottomSheet id="more-menu" title="More" maxHeight="60vh">{moreMenu}</BottomSheet>}
    </div>
  )
}
