import type { AgentSessionAccountSwitchResult } from '../../agent-session-account-switch'

/** Campo do BrzA no resumo de status; fica fora do `agent-session-wire.ts` pelo limite de linhas. */
export type AgentSessionStatusAccountSwitch = {
  /** The account a person switched this chat to; absent while it follows the selected account,
   *  and from older hosts. */
  accountSwitch?: AgentSessionAccountSwitchResult
}
