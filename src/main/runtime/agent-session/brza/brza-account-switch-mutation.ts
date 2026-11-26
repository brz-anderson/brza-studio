import {
  commitAccountSwitchRecord,
  type AgentSessionAccountSwitch
} from '../../agent-session-account-switch-record'
import { settleAgentSessionOperationInto } from '../ownership/agent-session-operation-admission'
import type { AgentSessionStoreState } from '../records/agent-session-store-state'

/** The store mutation of an account switch: the record's move and the operation's receipt land
 *  together, as a `/clear` does with its record. Kept out of the upstream mutation union's logic. */
export type BrzaAccountSwitchMutation = {
  kind: 'account-switch'
  change: AgentSessionAccountSwitch
  operation: { callerKey: string; operationId: string }
}

export function applyBrzaAccountSwitchMutation(
  state: AgentSessionStoreState,
  mutation: BrzaAccountSwitchMutation
): void {
  const { change } = mutation
  commitAccountSwitchRecord(state, change)
  settleAgentSessionOperationInto(state, {
    ...mutation.operation,
    outcome: {
      status: 'succeeded',
      sessionId: change.sessionId,
      accountSwitch: {
        accountId: change.accountSwitch.accountId,
        account: change.accountSwitch.account
      }
    }
  })
}
