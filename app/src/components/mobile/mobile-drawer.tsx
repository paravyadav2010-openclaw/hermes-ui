import { type ReactNode, useEffect, useRef } from 'react'
import { useStore } from '@nanostores/react'
import { $mobileDrawerOpen, closeMobileDrawer } from '@/store/mobile'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'

interface MobileDrawerProps {
  id: string
  title: string
  children: ReactNode
  fullWidth?: boolean
  fab?: ReactNode
}

export function MobileDrawer({ id, title, children, fullWidth = false, fab }: MobileDrawerProps) {
  const open = useStore($mobileDrawerOpen) === id
  const overlayRef = useRef<HTMLDivElement>(null)

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
        ref={overlayRef}
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        className={cn(
          `fixed top-0 left-0 z-50 flex w-full ${fullWidth ? '' : 'max-w-sm'} flex-col bg-(--dt-background) shadow-2xl transition-transform duration-300 ease-out`,
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) px-3">
          <Button
            aria-label="Back"
            className="size-8 cursor-pointer rounded-md text-(--ui-text-tertiary) hover:bg-(--ui-control-active-background) hover:text-foreground"
            onClick={closeMobileDrawer}
            size="icon"
            variant="ghost"
          >
            <Codicon name="arrow-left" size="1rem" />
          </Button>
          <h2 className="text-sm font-semibold truncate">{title}</h2>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-0 py-20 relative">
          {children}
          {fab && (
            <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] right-4 z-[51]">
              {fab}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
