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
import type {
  NativeChatAccountChoice,
  NativeChatAccountSwitchView
} from '../use-native-chat-account-switch'
import type { NativeChatUsageLimitAutoContinueState } from '../usage/native-chat-usage-limit-auto-continue-setting'
import { BrzaContinueAfterWorkLine } from './BrzaContinueAfterWorkLine'

/** False from `beforeSwitch`: the host holds the move, so nothing follows now. */
type BeforeSwitch = (choice: NativeChatAccountChoice) => Promise<boolean>

async function continueInChosenAccount(
  view: NativeChatAccountSwitchView,
  choice: NativeChatAccountChoice,
  callbacks: {
    beforeSwitch?: BeforeSwitch
    onContinue: (choice: NativeChatAccountChoice) => void | Promise<void>
  },
  setPending: (pending: boolean) => void
): Promise<void> {
  const { beforeSwitch, onContinue } = callbacks
  setPending(true)
  try {
    if (beforeSwitch && !(await beforeSwitch(choice))) {
      return
    }
    if (await view.switchTo(choice.id)) {
      await onContinue(choice)
    }
  } finally {
    setPending(false)
  }
}

/** Beside Continue on a usage-limit row (P40, P79): moves the chat to the chosen account and
 *  continues now, which drops the scheduled automatic continue. While background work holds the
 *  agent on the old account, the host continues once it is done and the row says so (PLN-026). */
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
  const { afterWork, pinned } = view
  const turnItemId = orcaStopView.usageLimitTurnItemId
  const status = afterWork?.status
  if (afterWork && status && !status.expired) {
    return <BrzaContinueAfterWorkLine status={status} onCancel={afterWork.cancel} />
  }
  const dropAutoContinue = (): void => {
    if (autoContinue?.kind === 'scheduled') {
      autoContinue.cancel()
    }
  }
  // A pinned chat cannot move while its agent runs: the host holds its switch with the continue.
  const beforeSwitch: BeforeSwitch | undefined =
    pinned && afterWork && turnItemId
      ? async (choice) => {
          if ((await afterWork.arm(turnItemId, choice.label, choice.id)) === 'now') {
            return true
          }
          dropAutoContinue()
          return false
        }
      : undefined
  const button = (
    <BrzaContinueInOtherAccount
      view={view}
      disabled={orcaStopView.usageLimitContinueDisabled}
      {...(beforeSwitch ? { beforeSwitch } : {})}
      onContinue={async (choice) => {
        const armed =
          afterWork && turnItemId && !pinned ? await afterWork.arm(turnItemId, choice.label) : 'now'
        dropAutoContinue()
        if (armed === 'now') {
          orcaStopView.continueUsageLimit()
        }
      }}
    />
  )
  // The host moves an ended wait to the newest cut, so only that cut's row says it.
  if (afterWork && status?.expired && status.turnItemId === turnItemId) {
    return (
      <>
        <BrzaContinueAfterWorkLine status={status} onCancel={afterWork.cancel} />
        {button}
      </>
    )
  }
  return button
}

export function BrzaContinueInOtherAccount({
  view,
  disabled = false,
  beforeSwitch,
  onContinue
}: {
  view: NativeChatAccountSwitchView
  disabled?: boolean
  beforeSwitch?: BeforeSwitch
  onContinue: (choice: NativeChatAccountChoice) => void | Promise<void>
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
  const choose = (choice: NativeChatAccountChoice): void => {
    if (pending || view.switching) {
      return
    }
    void continueInChosenAccount(view, choice, { beforeSwitch, onContinue }, setPending)
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
            onSelect={() => choose(choice)}
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
