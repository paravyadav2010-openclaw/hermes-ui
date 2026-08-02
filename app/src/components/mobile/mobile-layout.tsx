import { type ReactNode, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { useNavigate } from 'react-router-dom'
import { MobileDrawer } from './mobile-drawer'
import { SessionsPanel } from './sessions-panel'
import { BottomSheet } from './bottom-sheet'
import { PREVIEW_PANE_ID, FILE_BROWSER_PANE_ID } from '@/store/layout'
import { REVIEW_PANE_ID } from '@/store/review'
import { PANE_TOGGLE_REVEAL_EVENT } from '@/components/pane-shell'
import { $mobileDrawerOpen, closeMobileDrawer, openMobileDrawer } from '@/store/mobile'
import { NEW_CHAT_ROUTE } from '@/app/routes'
import { useSessionsSwipe } from '@/hooks/use-sessions-swipe'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import { SidebarProvider } from '@/components/ui/sidebar'

interface MobileLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  fileBrowser: ReactNode
  preview?: ReactNode
  review?: ReactNode
  terminal?: ReactNode
  moreMenu?: ReactNode
}

export function MobileLayout({
  children,
  sidebar,
  fileBrowser,
  preview,
  review,
  terminal,
  moreMenu,
}: MobileLayoutProps) {
  const navigate = useNavigate()
  const sessionsOpen = useStore($mobileDrawerOpen) === 'chat-sidebar'

  useEffect(() => {
    const handler = () => {
      // Best effort pane reveal hook
    }
    window.addEventListener(PANE_TOGGLE_REVEAL_EVENT, handler)
    return () => window.removeEventListener(PANE_TOGGLE_REVEAL_EVENT, handler)
  }, [])

  // Swipe right (finger left→right) on chat → push Sessions in from the left;
  // swipe left on Sessions → pop back to chat.
  useSessionsSwipe(
    sessionsOpen,
    () => openMobileDrawer('chat-sidebar'),
    () => closeMobileDrawer(),
  )

  const newChatFab = (
    <Button
      aria-label="New chat"
      className="size-12 cursor-pointer rounded-full bg-indigo-500 text-white shadow-xl hover:bg-indigo-400 active:scale-95 transition-transform flex items-center justify-center"
      onClick={() => { navigate(NEW_CHAT_ROUTE); closeMobileDrawer() }}
      size="icon"
      variant="ghost"
    >
      <Codicon name="add" size="1.25rem" />
    </Button>
  )

  return (
    <div className="flex h-dvh flex-col bg-(--dt-background) overflow-hidden">
      {/* Chat layer — shifts right while Sessions pushes in from the left */}
      <div
        style={{
          transitionProperty: 'translate',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          transitionDuration: '320ms',
        }}
        className={cn(
          'flex-1 min-h-0 overflow-hidden [touch-action:pan-y]',
          sessionsOpen ? '[translate:25%_0]' : '[translate:0_0]'
        )}
      >
        {children}
      </div>

      <SessionsPanel fab={newChatFab}>
        <SidebarProvider className="flex min-h-0 flex-1 flex-col" style={{ '--sidebar-width': '100%' } as React.CSSProperties}>{sidebar}</SidebarProvider>
      </SessionsPanel>
      <MobileDrawer id={FILE_BROWSER_PANE_ID} title="Files">{fileBrowser}</MobileDrawer>
      {preview && <BottomSheet id={PREVIEW_PANE_ID} title="Preview" maxHeight="85vh">{preview}</BottomSheet>}
      {review && <BottomSheet id={REVIEW_PANE_ID} title="Review" maxHeight="85vh">{review}</BottomSheet>}
      {terminal && <BottomSheet id="terminal-sidebar" title="Terminal" maxHeight="85vh">{terminal}</BottomSheet>}
      {moreMenu && <BottomSheet id="more-menu" title="More Menu" maxHeight="70vh">{moreMenu}</BottomSheet>}
    </div>
  )
}
