import { type ReactNode, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $mobileDrawerOpen, closeMobileDrawer } from '@/store/mobile'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'

interface SessionsPanelProps {
  children: ReactNode
  fab?: ReactNode
}

/**
 * Full-screen sessions screen that pushes in from the LEFT (drawer-style push).
 * Slides in over the chat; the chat layer shifts right simultaneously (see
 * MobileLayout) so the gesture reads as a real push, not a slide-over.
 */
export function SessionsPanel({ children, fab }: SessionsPanelProps) {
  const open = useStore($mobileDrawerOpen) === 'chat-sidebar'

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMobileDrawer() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMobileDrawer}
      />
      <div
        style={{
          bottom: 'env(safe-area-inset-bottom, 0px)',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          transitionDuration: '320ms',
        }}
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-full flex-col bg-(--dt-background) shadow-2xl transition-transform will-change-transform',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) px-3">
          <Button
            aria-label="Back"
            className="size-8 cursor-pointer rounded-md text-(--ui-text-tertiary) hover:bg-(--ui-control-active-background) hover:text-foreground"
            onClick={() => { triggerHaptic('close'); closeMobileDrawer() }}
            size="icon"
            variant="ghost"
          >
            <Codicon name="arrow-left" size="1rem" />
          </Button>
          <h2 className="text-sm font-semibold truncate">Sessions</h2>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-0 py-4 relative [touch-action:pan-y]">
          {children}
          {fab && (
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] right-4 z-[51]">
              {fab}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
