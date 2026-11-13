import { useState } from 'react'
import { ChevronDown, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { useNativeChatOrcaStopView } from '../messages/notices/native-chat-orca-stop-context'
import { useNativeChatUsageLimitContinueInOtherAccount } from '../usage/NativeChatUsageLimitActions'
import type { NativeChatAccountSwitchView } from '../use-native-chat-account-switch'

async function continueInChosenAccount(
  view: NativeChatAccountSwitchView,
  accountId: string | null,
  onContinue: () => void,
  setPending: (pending: boolean) => void
): Promise<void> {
  setPending(true)
  try {
    if (await view.switchTo(accountId)) {
      onContinue()
    }
  } finally {
    setPending(false)
  }
}
import type { NativeChatUsageLimitAutoContinueState } from '../usage/NativeChatUsageLimitAutoContinue'

/** Beside Continue on a usage-limit row (P40, P79): moves the chat to the chosen account and
 *  continues now, which drops the scheduled automatic continue. */
export function BrzaUsageLimitContinueInOtherAccount({
  autoContinue
}: {
  autoContinue: NativeChatUsageLimitAutoContinueState | null | undefined
}): React.JSX.Element | null {
  const view = useNativeChatUsageLimitContinueInOtherAccount()
  const orcaStopView = useNativeChatOrcaStopView()
  if (!view) {
    return null
  }
  return (
    <BrzaContinueInOtherAccount
      view={view}
      disabled={orcaStopView.usageLimitContinueDisabled}
      onContinue={() => {
        if (autoContinue?.kind === 'scheduled') {
          autoContinue.cancel()
        }
        orcaStopView.continueUsageLimit()
      }}
    />
  )
}

export function BrzaContinueInOtherAccount({
  view,
  disabled = false,
  onContinue
}: {
  view: NativeChatAccountSwitchView
  disabled?: boolean
  onContinue: () => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const [pending, setPending] = useState(false)
  const otherAccounts = view.choices.filter((choice) => choice.id !== view.current.id)
  if (!otherAccounts.some((choice) => choice.id !== null)) {
    return null
  }
  const label = t(
    'components.native-chat.continueInOtherAccount.continue',
    'Continue in another account'
  )
  const choose = (accountId: string | null): void => {
    if (pending || view.switching) {
      return
    }
    void continueInChosenAccount(view, accountId, onContinue, setPending)
  }
  return (
    <DropdownMenu onOpenChange={(open) => open && view.refresh()}>
      <DropdownMenuTrigger asChild disabled={disabled || pending || view.switching}>
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
