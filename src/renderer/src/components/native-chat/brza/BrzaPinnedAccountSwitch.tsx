import type { ReactNode } from 'react'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import { NativeChatAccountPicker } from '../NativeChatAccountPicker'
import { useStructuredAgentSessionAccountSwitch } from '../structured-agent-session-status-hooks'
import type { NativeChatAccountSwitchView } from '../use-native-chat-account-switch'

/** On a usage-limit row, a chat pinned to an account (P36) moves with the chat's own account
 *  picker, the same `switchAccount` as the picker beside the model. The upstream's global switcher
 *  writes the selection, which a pinned chat ignores, so it would relaunch on the same account and
 *  hit the limit again. null for a chat that follows the selection: it keeps the global switcher. */
export function useBrzaPinnedAccountSwitch(
  pane: { sessionId: string; target: RuntimeClientTarget },
  accountSwitch: NativeChatAccountSwitchView | null | undefined
): ReactNode {
  const pinned = useStructuredAgentSessionAccountSwitch(pane.sessionId, pane.target)
  return pinned && accountSwitch ? (
    <NativeChatAccountPicker view={accountSwitch} isWorking={false} />
  ) : null
}
