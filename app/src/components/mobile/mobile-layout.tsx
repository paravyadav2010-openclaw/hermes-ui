import { type ReactNode, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { useNavigate } from 'react-router-dom'
import { TabBar } from './tab-bar'
import { MobileDrawer } from './mobile-drawer'
import { BottomSheet } from './bottom-sheet'
import { PREVIEW_PANE_ID, FILE_BROWSER_PANE_ID } from '@/store/layout'
import { REVIEW_PANE_ID } from '@/store/review'
import { PANE_TOGGLE_REVEAL_EVENT } from '@/components/pane-shell'
import { closeMobileDrawer } from '@/store/mobile'
import { NEW_CHAT_ROUTE } from '@/app/routes'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
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

  useEffect(() => {
    const handler = () => {
      // Best effort pane reveal hook
    }
    window.addEventListener(PANE_TOGGLE_REVEAL_EVENT, handler)
    return () => window.removeEventListener(PANE_TOGGLE_REVEAL_EVENT, handler)
  }, [])

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
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      <TabBar />

      <MobileDrawer id="chat-sidebar" title="Sessions" fullWidth fab={newChatFab}>
        <SidebarProvider className="flex min-h-0 flex-1 flex-col" style={{ '--sidebar-width': '100%' } as React.CSSProperties}>{sidebar}</SidebarProvider>
      </MobileDrawer>
      <MobileDrawer id={FILE_BROWSER_PANE_ID} title="Files">{fileBrowser}</MobileDrawer>
      {preview && <BottomSheet id={PREVIEW_PANE_ID} title="Preview" maxHeight="85vh">{preview}</BottomSheet>}
      {review && <BottomSheet id={REVIEW_PANE_ID} title="Review" maxHeight="85vh">{review}</BottomSheet>}
      {terminal && <BottomSheet id="terminal-sidebar" title="Terminal" maxHeight="85vh">{terminal}</BottomSheet>}
      {moreMenu && <BottomSheet id="more-menu" title="More Menu" maxHeight="70vh">{moreMenu}</BottomSheet>}
    </div>
  )
}
