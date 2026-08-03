import { type ComponentProps, type ReactNode, useMemo } from 'react'

import { useCopyFeedback } from '@/hooks/use-copy-feedback'
import { cn } from '@/lib/utils'

// Double-click-to-copy inline code (ported from the PWA 9400 `hm-copyable`
// inline code). The <code> element keeps its exact prose styling — only the
// interaction is added — and a transient "Copied" badge floats above it so
// the copy state is visible without touching the surrounding text layout.

function childrenToPlainText(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }

  if (Array.isArray(children)) {
    return children.map(childrenToPlainText).join('')
  }

  if (children && typeof children === 'object' && 'props' in children) {
    const props = (children as { props?: { children?: ReactNode } }).props

    return props?.children ? childrenToPlainText(props.children) : ''
  }

  return ''
}

export function CopyableInlineCode({ children, className, ...props }: ComponentProps<'code'>) {
  const { copied, copy } = useCopyFeedback()
  const text = useMemo(() => childrenToPlainText(children), [children])

  return (
    <span className="relative inline">
      <code
        className={className}
        dir="ltr"
        {...props}
        onDoubleClick={event => {
          event.preventDefault()
          event.stopPropagation()
          void copy(text)
        }}
        title={copied ? 'Copied' : 'Double-click to copy'}
      >
        {children}
      </code>
      {copied && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-(--ui-stroke-tertiary) bg-(--dt-card) px-1.5 py-px text-[0.5625rem] leading-4 text-[color:var(--ui-text-primary)] shadow-sm"
        >
          Copied
        </span>
      )}
    </span>
  )
}
