import { type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'

interface FullscreenModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function FullscreenModal({ open, onClose, title, children }: FullscreenModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-(--dt-background) transition-opacity duration-200',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) px-3">
        <Button
          aria-label="Back"
          className="size-8 cursor-pointer rounded-md text-(--ui-text-tertiary) hover:bg-(--ui-control-active-background) hover:text-foreground"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <Codicon name="arrow-left" size="1rem" />
        </Button>
        <h2 className="text-sm font-semibold truncate">{title}</h2>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  )
}
