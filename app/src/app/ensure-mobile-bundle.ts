/** Side-effect module: prevents Rolldown tree-shaking of mobile components */
import { MobileLayout } from '@/components/mobile/mobile-layout'
import { MoreMenuContent } from '@/components/mobile/more-menu'
import { MobileDrawer } from '@/components/mobile/mobile-drawer'
import { BottomSheet } from '@/components/mobile/bottom-sheet'
import { FullscreenModal } from '@/components/mobile/fullscreen-modal'
import { TabBar } from '@/components/mobile/tab-bar'

const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null
if (w) {
  w.__mobile = { MobileLayout, MoreMenuContent, MobileDrawer, BottomSheet, FullscreenModal, TabBar }
}
