import { type ReactNode } from 'react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useMobile } from '@/hooks/use-mobile'
import { PREVIEW_PANE_ID, FILE_BROWSER_PANE_ID } from '@/store/layout'
import { REVIEW_PANE_ID } from '@/store/review'
import { TabBar } from './tab-bar'
import { MobileDrawer } from './mobile-drawer'
import { BottomSheet } from './bottom-sheet'

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
  if (!isMobile) return <>{children}</>

  return (
    <div className="flex h-dvh flex-col bg-(--dt-background)">
      <div className="flex-1 min-h-0 overflow-hidden" >{children}</div>
      <TabBar />
      <MobileDrawer id="chat-sidebar" title="Sessions">
        <SidebarProvider className="flex min-h-0 flex-1 flex-col">{sidebar}</SidebarProvider>
      </MobileDrawer>
      <MobileDrawer id={FILE_BROWSER_PANE_ID} title="Files">{fileBrowser}</MobileDrawer>
      {preview && <BottomSheet id={PREVIEW_PANE_ID} title="Preview" maxHeight="75vh">{preview}</BottomSheet>}
      {review && <BottomSheet id={REVIEW_PANE_ID} title="Review" maxHeight="60vh">{review}</BottomSheet>}
      {terminal && <BottomSheet id="terminal-sidebar" title="Terminal" maxHeight="50vh">{terminal}</BottomSheet>}
      {moreMenu && <BottomSheet id="more-menu" title="More" maxHeight="60vh">{moreMenu}</BottomSheet>}
    </div>
  )
}
