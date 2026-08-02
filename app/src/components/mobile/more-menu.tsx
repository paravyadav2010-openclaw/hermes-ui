import { useStore } from '@nanostores/react'
import { $paneOpen } from '@/store/panes'
import { $reviewOpen } from '@/store/review'
import { $terminalTakeover } from '@/app/right-sidebar/store'
import { PREVIEW_PANE_ID, FILE_BROWSER_PANE_ID } from '@/store/layout'
import { REVIEW_PANE_ID } from '@/store/review'
import { toggleMobileSheet, openMobileDrawer, closeMobileSheet } from '@/store/mobile'
import { setModelPickerOpen } from '@/store/session'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

interface MoreMenuContentProps {
  onOpenSettings?: () => void
}

export function MoreMenuContent({ onOpenSettings }: MoreMenuContentProps) {
  const previewOpen = useStore($paneOpen(PREVIEW_PANE_ID))
  const fileBrowserOpen = useStore($paneOpen(FILE_BROWSER_PANE_ID))
  const reviewOpen = useStore($reviewOpen)
  const terminalActive = useStore($terminalTakeover)

  const actions = [
    { id: 'model', label: 'Model', icon: 'gear', action: () => { triggerHaptic('selection'); setModelPickerOpen(true) } },
    { id: 'files', label: 'Files', icon: 'file', action: () => { triggerHaptic('open'); closeMobileSheet(); openMobileDrawer(FILE_BROWSER_PANE_ID) }, active: fileBrowserOpen },
    { id: 'terminal', label: 'Terminal', icon: 'terminal', action: () => { triggerHaptic('open'); toggleMobileSheet('terminal-sidebar') }, active: terminalActive },
    { id: 'preview', label: 'Preview', icon: 'eye', action: () => { triggerHaptic('open'); toggleMobileSheet(PREVIEW_PANE_ID) }, active: previewOpen },
    { id: 'review', label: 'Review', icon: 'wand', action: () => { triggerHaptic('open'); toggleMobileSheet(REVIEW_PANE_ID) }, active: reviewOpen },
    { id: 'settings', label: 'Settings', icon: 'settings-gear', action: () => { triggerHaptic('selection'); onOpenSettings?.() } },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 py-4">
      {actions.map(action => (
        <button
          key={action.id}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl p-4 transition-colors tap-highlight-transparent',
            action.active ? 'bg-(--dt-primary)/10 text-(--dt-primary)' : 'text-(--ui-text-secondary) hover:bg-(--ui-control-active-background)'
          )}
          onClick={action.action}
          type="button"
        >
          <span className={`codicon codicon-${action.icon} text-2xl`} />
          <span className="text-xs font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  )
}
