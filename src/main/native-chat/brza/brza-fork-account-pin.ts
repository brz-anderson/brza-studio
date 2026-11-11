import type { AgentSessionAccountSwitchResult } from '../../../shared/agent-session-account-switch'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'

/** The pin a fork inherits from its source (P74). The copy sits in the account the source runs on,
 *  so a fork that followed the global selection would launch in another account, find no
 *  transcript and open blank. A source with no pin leaves the fork on the selection. */
export function brzaForkAccountPin(
  source: Pick<AgentSessionRecord, 'accountSwitch'>
): { accountSwitch: AgentSessionAccountSwitchResult } | Record<string, never> {
  const pin = source.accountSwitch
  return pin ? { accountSwitch: { accountId: pin.accountId, account: pin.account } } : {}
}
