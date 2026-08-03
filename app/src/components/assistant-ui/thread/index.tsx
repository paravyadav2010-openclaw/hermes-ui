import { type FC, useCallback, useMemo, useState } from 'react'

import { AssistantMessage } from '@/components/assistant-ui/thread/assistant-message'
import { ThreadMessageList } from '@/components/assistant-ui/thread/list'
import {
  BackgroundResumeNotice,
  CenteredThreadSpinner,
  ResponseLoadingIndicator
} from '@/components/assistant-ui/thread/status'
import { SystemMessage } from '@/components/assistant-ui/thread/system-message'
import { ThreadTimeline } from '@/components/assistant-ui/thread/timeline'
import { type RestoreMessageTarget } from '@/components/assistant-ui/thread/types'
import { UserEditComposer } from '@/components/assistant-ui/thread/user-edit-composer'
import { UserMessage } from '@/components/assistant-ui/thread/user-message'
import { Intro, type IntroProps } from '@/components/chat/intro'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { HermesGateway } from '@/hermes'
import { useCopyFeedback } from '@/hooks/use-copy-feedback'
import { useI18n } from '@/i18n'
import { notifyError } from '@/store/notifications'

type ThreadLoadingState = 'response' | 'session'

export const Thread: FC<{
  clampToComposer?: boolean
  cwd?: string | null
  gateway?: HermesGateway | null
  intro?: IntroProps
  loading?: ThreadLoadingState
  onBranchInNewChat?: (messageId: string) => void
  onCancel?: () => Promise<void> | void
  onDismissError?: (messageId: string) => void
  onRestoreToMessage?: (messageId: string, target?: RestoreMessageTarget) => Promise<void> | void
  sessionId?: string | null
  sessionKey?: string | null
}> = ({
  clampToComposer = false,
  cwd = null,
  gateway = null,
  intro,
  loading,
  onBranchInNewChat,
  onCancel,
  onDismissError,
  onRestoreToMessage,
  sessionId = null,
  sessionKey
}) => {
  const { t } = useI18n()
  const copy = t.assistant.thread

  const [restoreConfirmTarget, setRestoreConfirmTarget] = useState<
    (RestoreMessageTarget & { messageId: string }) | null
  >(null)

  const closeRestoreConfirm = useCallback(() => setRestoreConfirmTarget(null), [])

  // Double-click-to-copy (PWA 9400 parity, 2026-08-03): double-clicking any
  // rendered message text copies the closest copyable unit — the message text
  // itself, or the inline code / fenced block when the pointer is inside one.
  // The user bubble handles its own double-click (edit-disambiguation) and
  // stops propagation so this delegated handler never fires for it.
  const { copied, copy: copyText } = useCopyFeedback()

  const handleThreadDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null

      if (!target) {
        return
      }

      // Never hijack interactive elements (buttons, links, inputs, the edit
      // composer, code-copy buttons, restore/stop actions).
      if (target.closest('button, a, input, textarea, [contenteditable="true"]')) {
        return
      }

      // The user bubble is an edit button — it resolves click-vs-double-click
      // itself and stops propagation on copy; skip it here.
      if (target.closest('[data-slot="aui_user-message-root"]')) {
        return
      }

      const inlineCode = target.closest('code')
      const fencedBlock = target.closest('pre')

      if (inlineCode) {
        void copyText(inlineCode.textContent ?? '')
        return
      }

      if (fencedBlock) {
        void copyText(fencedBlock.textContent ?? '')
        return
      }

      const messageRoot = target.closest(
        '[data-slot="aui_assistant-message-root"], [data-slot="aui_system-message-root"]'
      )

      if (!messageRoot) {
        return
      }

      // Copy the message's rendered text (skip chrome: meta bars, action
      // clusters, timestamps). The content slot holds the markdown output.
      const contentSlot = messageRoot.querySelector('[data-slot="aui_assistant-message-content"]')
      const text = (contentSlot ?? messageRoot).textContent ?? ''

      void copyText(text)
    },
    [copyText]
  )

  const confirmRestore = useCallback(() => {
    if (!restoreConfirmTarget || !onRestoreToMessage) {
      throw new Error('Restore is unavailable for this message.')
    }

    const { messageId, text, userOrdinal } = restoreConfirmTarget

    closeRestoreConfirm()
    void Promise.resolve(onRestoreToMessage(messageId, { text, userOrdinal })).catch((error: unknown) => {
      notifyError(error, 'Restore failed')
    })
  }, [closeRestoreConfirm, onRestoreToMessage, restoreConfirmTarget])

  const requestRestoreConfirm = useCallback((messageId: string, target: RestoreMessageTarget) => {
    setRestoreConfirmTarget({ messageId, ...target })
  }, [])

  const messageComponents = useMemo(
    () => ({
      AssistantMessage: () => (
        <AssistantMessage onBranchInNewChat={onBranchInNewChat} onDismissError={onDismissError} />
      ),
      SystemMessage,
      UserEditComposer: () => <UserEditComposer cwd={cwd} gateway={gateway} sessionId={sessionId} />,
      UserMessage: () => (
        <UserMessage
          onCancel={onCancel}
          onRequestRestoreConfirm={onRestoreToMessage ? requestRestoreConfirm : undefined}
        />
      )
    }),
    [cwd, gateway, onBranchInNewChat, onCancel, onDismissError, onRestoreToMessage, requestRestoreConfirm, sessionId]
  )

  const emptyPlaceholder = intro ? (
    <div className="flex min-h-0 w-full flex-col items-center justify-center">
      <Intro {...intro} />
    </div>
  ) : undefined

  return (
    <div
      className="relative grid h-full min-h-0 max-w-full grid-rows-[minmax(0,1fr)] overflow-hidden bg-transparent contain-[layout_paint]"
      onDoubleClick={handleThreadDoubleClick}
    >
      <ThreadMessageList
        clampToComposer={clampToComposer}
        components={messageComponents}
        emptyPlaceholder={emptyPlaceholder}
        loadingIndicator={loading === 'response' ? <ResponseLoadingIndicator /> : <BackgroundResumeNotice />}
        sessionKey={sessionKey}
      />
      {loading === 'session' && <CenteredThreadSpinner />}
      <ThreadTimeline />
      {/* Double-click-copy feedback pill (PWA 9400 parity): appears briefly
          above the composer when any message text was copied. */}
      {copied && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-(--ui-stroke-secondary) bg-(--dt-card) px-3 py-1 text-[0.6875rem] font-medium text-[color:var(--ui-text-primary)] shadow-lg"
          role="status"
        >
          {t.common.copied}
        </div>
      )}
      <ConfirmDialog
        confirmLabel={copy.restoreConfirm}
        description={copy.restoreBody}
        destructive
        onClose={closeRestoreConfirm}
        onConfirm={confirmRestore}
        open={Boolean(restoreConfirmTarget)}
        title={copy.restoreTitle}
      />
    </div>
  )
}
