import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useI18n } from '@/i18n'
import { requestModelOptions } from '@/lib/model-options'
import { currentPickerSelection } from '@/lib/model-status-label'
import { normalize } from '@/lib/text'
import type { ModelOptionProvider, ModelPricing } from '@/types/hermes'

import type { HermesGateway } from '../hermes'
import { cn } from '../lib/utils'
import { startManualOnboarding } from '../store/onboarding'

import { InlineNotice } from './notifications'
import { Button } from './ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { useMobile } from '@/hooks/use-mobile'
import { X, Check, Search } from '@/lib/icons'

interface ModelPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gw?: HermesGateway
  sessionId?: string | null
  currentModel: string
  currentProvider: string
  onSelect: (selection: { provider: string; model: string }) => void
  contentClassName?: string
}

export function ModelPickerDialog({
  open,
  onOpenChange,
  gw,
  sessionId,
  currentModel,
  currentProvider,
  onSelect,
  contentClassName
}: ModelPickerDialogProps) {
  const { t } = useI18n()
  const copy = t.modelPicker
  const isMobile = useMobile()
  const [search, setSearch] = useState('')

  const modelOptions = useQuery({
    queryKey: ['model-options', sessionId || 'global'],
    queryFn: () => requestModelOptions({ gateway: gw, sessionId }),
    enabled: open
  })

  const providers = modelOptions.data?.providers ?? []

  const { model: optionsModel, provider: optionsProvider } = currentPickerSelection(
    !!sessionId,
    { model: currentModel, provider: currentProvider },
    modelOptions.data
  )

  const loading = modelOptions.isPending && !modelOptions.data
  const error = modelOptions.error
    ? modelOptions.error instanceof Error
      ? modelOptions.error.message
      : String(modelOptions.error)
    : null

  const selectModel = (provider: ModelOptionProvider, model: string) => {
    onSelect({ provider: provider.slug, model })
    onOpenChange(false)
  }

  const addProvider = () => {
    startManualOnboarding()
    onOpenChange(false)
  }

  if (!open) return null

  // Native Mobile Bottom Sheet using the app's native theme tokens
  if (isMobile) {
    const q = normalize(search)
    const matches = (provider: ModelOptionProvider, model: string) =>
      !q ||
      model.toLowerCase().includes(q) ||
      provider.name.toLowerCase().includes(q) ||
      provider.slug.toLowerCase().includes(q)

    const configured = providers.filter(p => (p.models ?? []).length > 0)

    return (
      <div className="fixed inset-0 z-[150] flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-200">
        <div 
          className="fixed inset-0" 
          onClick={() => onOpenChange(false)} 
        />

        <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-(--dt-background) border-t border-(--ui-stroke-tertiary) shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
          {/* Grab Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-(--ui-text-quaternary)" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-(--ui-stroke-tertiary)">
            <div>
              <h2 className="text-sm font-bold text-foreground">{copy.title || 'Select Model'}</h2>
              <p className="text-xs text-(--ui-text-tertiary) truncate">
                Active: {optionsModel || currentModel || copy.unknown}
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-(--ui-text-tertiary) hover:bg-(--ui-control-active-background) hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="px-4 py-2 border-b border-(--ui-stroke-tertiary)/60">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-(--ui-text-tertiary)" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={copy.search || 'Search models...'}
                className="w-full rounded-xl bg-(--dt-card) border border-(--ui-stroke-tertiary) pl-9 pr-3 py-2 text-xs text-foreground placeholder-(--ui-text-tertiary) focus:outline-none focus:border-(--dt-primary)"
              />
            </div>
          </div>

          {/* Model List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 no-scrollbar">
            {loading ? (
              <div className="py-8 text-center text-xs text-(--ui-text-tertiary) animate-pulse">Loading model catalog...</div>
            ) : error ? (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">{error}</div>
            ) : configured.length === 0 ? (
              <div className="py-8 text-center text-xs text-(--ui-text-tertiary)">No models found</div>
            ) : (
              configured.map(provider => {
                const models = (provider.models ?? []).filter(m => matches(provider, m))
                if (models.length === 0) return null

                return (
                  <div key={provider.slug} className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-(--dt-primary) px-1">
                      {provider.name}
                    </div>
                    <div className="space-y-1">
                      {models.map(model => {
                        const isCurrent = model === (optionsModel || currentModel) && provider.slug === (optionsProvider || currentProvider)
                        const price = provider.pricing?.[model]

                        return (
                          <button
                            key={`${provider.slug}:${model}`}
                            onClick={() => selectModel(provider, model)}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all border text-xs min-h-[44px]',
                              isCurrent
                                ? 'bg-(--dt-primary)/15 border-(--dt-primary) text-(--dt-primary) font-semibold'
                                : 'bg-(--dt-card)/50 border-(--ui-stroke-tertiary)/40 text-foreground hover:bg-(--ui-control-active-background)'
                            )}
                          >
                            <span className="truncate pr-2">{model}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {price && (price.input || price.output) && (
                                <span className="text-[10px] text-(--ui-text-tertiary) tabular-nums font-mono">
                                  ${price.input || '?'}/${price.output || '?'}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="w-4 h-4 rounded-full bg-(--dt-primary) text-(--dt-primary-foreground) flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-4 py-2.5 border-t border-(--ui-stroke-tertiary) flex items-center justify-between gap-3 bg-(--dt-background)">
            <Button onClick={addProvider} variant="ghost" className="text-xs text-(--ui-text-secondary) hover:text-foreground">
              {copy.addProvider || '+ Add Provider'}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="text-xs px-4">
              {t.common.cancel || 'Cancel'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Desktop / Tablet Layout
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={cn('w-full max-w-lg max-h-[85vh] gap-0 overflow-hidden p-0', contentClassName)}>
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="font-mono text-xs leading-relaxed">
            {copy.current} {optionsModel || currentModel || copy.unknown}
            {optionsProvider || currentProvider ? ` · ${optionsProvider || currentProvider}` : ''}
          </DialogDescription>
        </DialogHeader>

        <Command className="rounded-none bg-card" shouldFilter={false}>
          <CommandInput autoFocus onValueChange={setSearch} placeholder={copy.search} value={search} />
          <CommandList className="max-h-96">
            {!loading && !error && <CommandEmpty>{copy.noModels}</CommandEmpty>}
            <ModelResults
              currentModel={optionsModel || currentModel}
              currentProvider={optionsProvider || currentProvider}
              error={error}
              loading={loading}
              onSelectModel={selectModel}
              providers={providers}
              search={search}
            />
          </CommandList>
        </Command>

        <DialogFooter className="flex-row items-center justify-end gap-2 bg-card p-3">
          <Button onClick={addProvider} variant="ghost">
            {copy.addProvider}
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {t.common.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModelResults({
  loading,
  error,
  providers,
  currentModel,
  currentProvider,
  onSelectModel,
  search
}: {
  loading: boolean
  error: string | null
  providers: ModelOptionProvider[]
  currentModel: string
  currentProvider: string
  onSelectModel: (provider: ModelOptionProvider, model: string) => void
  search: string
}) {
  const { t } = useI18n()
  const copy = t.modelPicker

  if (loading) return null
  if (error) return null
  if (providers.length === 0) return null

  const q = normalize(search)
  const matches = (provider: ModelOptionProvider, model: string) =>
    !q ||
    model.toLowerCase().includes(q) ||
    provider.name.toLowerCase().includes(q) ||
    provider.slug.toLowerCase().includes(q)

  const configured = providers.filter(p => (p.models ?? []).length > 0)

  return (
    <>
      {configured.map(provider => {
        const models = (provider.models ?? []).filter(m => matches(provider, m))
        if (models.length === 0) return null
        const unavailable = new Set(provider.unavailable_models ?? [])

        return (
          <CommandGroup heading={provider.name} key={provider.slug}>
            {models.map(model => {
              const isCurrent = model === currentModel && provider.slug === currentProvider
              const price = provider.pricing?.[model]
              const locked = unavailable.has(model)

              return (
                <CommandItem
                  className={cn(
                    'flex items-center gap-2 pl-6 font-mono',
                    isCurrent && 'bg-primary text-primary-foreground',
                    locked && 'cursor-not-allowed opacity-45'
                  )}
                  disabled={locked}
                  key={`${provider.slug}:${model}`}
                  onSelect={() => {
                    if (!locked) onSelectModel(provider, model)
                  }}
                  value={`${provider.slug}:${model}`}
                >
                  <span className="min-w-0 flex-1 truncate">{model}</span>
                  {price && (price.input || price.output) && (
                    <span className="shrink-0 text-[0.66rem] tabular-nums text-muted-foreground">
                      ${price.input || '?'}/${price.output || '?'}
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )
      })}
    </>
  )
}
