import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { $activeGatewayProfile, $profiles, ensureGatewayProfile } from '@/store/profile'

const PILL = cn(
  'h-(--composer-control-size) max-w-28 shrink-0 gap-1 rounded-full border border-(--ui-stroke-secondary)/70 px-2 text-xs font-medium',
  'bg-(--ui-bg-elevated) text-foreground shadow-sm hover:bg-(--ui-bg-elevated) hover:text-white'
)

export function ProfilePill({ disabled }: { disabled: boolean }) {
  const activeProfile = useStore($activeGatewayProfile)
  const profiles = useStore($profiles)
  const [open, setOpen] = useState(false)

  if (profiles.length < 2) return null

  const label = activeProfile === 'default' ? 'default' : activeProfile

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <Tip label={`Profile: ${label}`} side="top">
        <DropdownMenuTrigger asChild>
          <Button aria-label={`Profile: ${label}`} className={PILL} disabled={disabled} type="button" variant="ghost">
            <span className="truncate">{label}</span>
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="start" className="w-40 p-1" side="top" sideOffset={8}>
        {profiles.map(profile => (
          <DropdownMenuItem
            key={profile.name}
            className={cn('cursor-pointer text-xs', profile.name === activeProfile && 'font-semibold')}
            onClick={() => { void ensureGatewayProfile(profile.name); setOpen(false) }}
          >
            {profile.is_default ? 'default' : profile.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
