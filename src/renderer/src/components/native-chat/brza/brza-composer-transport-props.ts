import type { AgentType } from '../../../../../shared/agent-status/contracts/agent-status-types'
import type { NativeChatStructuredComposerTransport } from '../composer/submit/native-chat-structured-composer-transport'

/** What the composer field takes from the chat's agent and structured transport: the model picker's
 *  open request and, where the host can move a Claude chat to another account, the switch the
 *  account picker beside it drives. Kept out of NativeChatComposerPane, which sits at its line limit. */
export function brzaComposerTransportProps(
  agent: AgentType,
  transport: NativeChatStructuredComposerTransport | undefined
) {
  return {
    sessionOptionsPickerRequest: transport?.optionPickerRequest ?? null,
    agent,
    accountSwitch: transport?.accountSwitch
  }
}
