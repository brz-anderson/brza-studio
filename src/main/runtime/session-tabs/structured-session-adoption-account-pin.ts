import { claudeAccountPinRefusal, claudeReadyAccountPin } from '../../claude/claude-account-switch'
import { agentSessionRefusalError } from '../../../shared/agent-session/failures/agent-session-wire-refusals'
import type { StructuredAgentId } from '../../../shared/agent-session/lifecycle/agent-session-provider-handle'
import type { StructuredAgentSessionResumeSource } from '../../../shared/agent-session/structured-agent-session-create'
import type { AgentSessionAccountSwitchResult } from '../../../shared/agent-session-account-switch'

/** The account an adopted chat is pinned to, with the login its divider names. A pin the host
 *  cannot ready refuses the create: opening the chat on the selection would start it blank. */
export async function resolveStructuredAdoptionAccountPin(
  agent: StructuredAgentId,
  resumeFrom: StructuredAgentSessionResumeSource | undefined
): Promise<AgentSessionAccountSwitchResult | undefined> {
  const pin = resumeFrom?.accountSwitch
  if (!pin || agent !== 'claude') {
    return undefined
  }
  const ready = await claudeReadyAccountPin(pin.accountId)
  if (!ready.ok) {
    const failure = claudeAccountPinRefusal(ready.reason)
    throw agentSessionRefusalError(
      'agent_session_operation_invalid',
      failure.details,
      failure.message
    )
  }
  return { accountId: pin.accountId, account: ready.account }
}
