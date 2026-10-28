import { useState } from 'react'
import { ChevronDown, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { NativeChatAccountSwitchView } from '../use-native-chat-account-switch'

export function BrzaContinueInOtherAccount({
  view,
  onContinue
}: {
  view: NativeChatAccountSwitchView
  onContinue: () => void
}): React.JSX.Element | null {
  const [pending, setPending] = useState(false)
  const otherAccounts = view.choices.filter((choice) => choice.id !== view.current.id)
  if (!otherAccounts.some((choice) => choice.id !== null)) {
    return null
  }
  const label = translate(
    'components.native-chat.continueInOtherAccount.continue',
    'Continue in another account'
  )
  const choose = async (accountId: string | null): Promise<void> => {
    if (pending || view.switching) {
      return
    }
    setPending(true)
    try {
      if (await view.switchTo(accountId)) {
        onContinue()
      }
    } finally {
      setPending(false)
    }
  }
  return (
    <DropdownMenu onOpenChange={(open) => open && view.refresh()}>
      <DropdownMenuTrigger asChild disabled={pending || view.switching}>
        <Button type="button" variant="outline" size="xs" aria-label={label}>
          <UserRound aria-hidden="true" />
          {label}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" collisionPadding={8} className="w-72">
        {otherAccounts.map((choice) => (
          <DropdownMenuItem
            key={choice.id ?? ''}
            disabled={choice.disabled}
            onSelect={() => void choose(choice.id)}
          >
            <div className="min-w-0 py-0.5">
              <div className="truncate">{choice.label}</div>
              {choice.detail ? (
                <div className="truncate text-xs font-normal text-muted-foreground">
                  {choice.detail}
                </div>
              ) : null}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
