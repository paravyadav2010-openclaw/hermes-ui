import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { $mobileSheetOpen, closeMobileSheet } from '@/store/mobile'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'

interface BottomSheetProps {
  id: string
  title: string
  children: ReactNode
  maxHeight?: string
}

export function BottomSheet({ id, title, children, maxHeight = '70vh' }: BottomSheetProps) {
  const open = useStore($mobileSheetOpen) === id
  const [height, setHeight] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setHeight(0)
      requestAnimationFrame(() => setHeight(1))
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMobileSheet() }
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
        onClick={closeMobileSheet}
      />
      <div
        ref={contentRef}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-(--dt-background) shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ maxHeight }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-(--ui-text-quaternary)" />
        </div>
        <header className="flex h-10 shrink-0 items-center gap-2 px-4">
          <h2 className="flex-1 text-sm font-semibold truncate">{title}</h2>
          <Button
            aria-label="Close"
            className="size-7 cursor-pointer rounded-md text-(--ui-text-tertiary) hover:bg-(--ui-control-active-background) hover:text-foreground"
            onClick={closeMobileSheet}
            size="icon"
            variant="ghost"
          >
            <Codicon name="close" size="0.875rem" />
          </Button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </div>
      </div>
    </>
  )
}
