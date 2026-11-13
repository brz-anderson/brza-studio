import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { selectClaudeProviderAccount } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import { runtimeTargetEnvironmentId } from '@/runtime/rpc/targets/runtime-client-target'
import type { AgentSessionOptionsResult } from '../../../../../shared/agent-session/options/agent-session-options-result'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { useStructuredAgentSessionAccountSwitch } from '../session/status/structured-agent-session-status-hooks'
import type { NativeChatAccountSwitchView } from '../use-native-chat-account-switch'

/** The accounts "Continue in another account" offers on a usage-limit row, and the move made
 *  before Continue (P40, P79). A chat pinned to an account (P36) moves with its own switch; one
 *  that follows the selection moves the selection, as the upstream's switcher on that row does,
 *  since a pinned chat ignores the selection (sync v1.4.246, R2). Null with no other account, or
 *  while the host has not said a chat that follows the selection may move. */
async function switchUsageLimitAccount(args: {
  target: RuntimeClientTarget
  sessionId: string
  accountId: string | null
  fetchSettings: () => Promise<unknown>
  inFlight: { current: boolean }
  setSwitching: (switching: boolean) => void
}): Promise<boolean> {
  if (args.inFlight.current) {
    return false
  }
  args.inFlight.current = true
  args.setSwitching(true)
  try {
    const options = await callStructuredAgentSession<AgentSessionOptionsResult>(
      args.target,
      'agentSession.options',
      { sessionId: args.sessionId }
    ).catch(() => null)
    if (options?.canSwitchAccount !== true) {
      toast.error(
        translate(
          'components.native-chat.usageLimitActions.accountUnavailable',
          'This chat cannot move to another account. Hand it off to another agent instead.'
        )
      )
      return false
    }
    await selectClaudeProviderAccount(args.target, {
      accountId: args.accountId,
      runtime: 'host',
      wslDistro: null
    })
    // Why: remote selections live on the server; only a local one changes GlobalSettings.
    if (runtimeTargetEnvironmentId(args.target) === null) {
      await args.fetchSettings()
    }
    return true
  } catch (error) {
    console.error('Failed to switch Claude account from a usage-limit row:', error)
    toast.error(
      translate('auto.components.settings.AccountsPane.2743cdc0af', 'Claude account update failed.')
    )
    return false
  } finally {
    args.inFlight.current = false
    args.setSwitching(false)
  }
}

export function useBrzaContinueInOtherAccount(
  pane: { sessionId: string; target: RuntimeClientTarget },
  chatAccountSwitch: NativeChatAccountSwitchView | null | undefined,
  canSwitchAccount: boolean | undefined
): NativeChatAccountSwitchView | null {
  const { sessionId, target } = pane
  const pinned = useStructuredAgentSessionAccountSwitch(sessionId, target)
  const fetchSettings = useAppStore((s) => s.fetchSettings)
  const [switching, setSwitching] = useState(false)
  const inFlight = useRef(false)
  const switchSelection = useCallback(
    (accountId: string | null) =>
      switchUsageLimitAccount({
        target,
        sessionId,
        accountId,
        fetchSettings,
        inFlight,
        setSwitching
      }),
    [fetchSettings, sessionId, target]
  )
  return useMemo(() => {
    if (!chatAccountSwitch) {
      return null
    }
    if (pinned) {
      return chatAccountSwitch
    }
    return canSwitchAccount === true
      ? {
          ...chatAccountSwitch,
          switching: chatAccountSwitch.switching || switching,
          switchTo: switchSelection
        }
      : null
  }, [canSwitchAccount, chatAccountSwitch, pinned, switchSelection, switching])
}
