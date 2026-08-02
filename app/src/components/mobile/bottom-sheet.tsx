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

export function BottomSheet({ id, title, children, maxHeight = '85vh' }: BottomSheetProps) {
  const open = useStore($mobileSheetOpen) === id

  useEffect(() => {
    if (open) {
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
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[140] bg-black/60 backdrop-blur-xs transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMobileSheet}
      />

      {/* Sheet Container */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-[150] flex flex-col rounded-t-3xl bg-(--dt-background) border-t border-white/10 shadow-2xl transition-transform duration-300 ease-out overflow-hidden',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ maxHeight }}
      >
        {/* Grab Handle Bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <h2 className="text-sm font-bold text-foreground truncate">{title}</h2>
          <Button
            aria-label="Close"
            className="size-8 cursor-pointer rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
            onClick={closeMobileSheet}
            size="icon"
            variant="ghost"
          >
            <Codicon name="close" size="0.875rem" />
          </Button>
        </header>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </div>
      </div>
    </>
  )
}
