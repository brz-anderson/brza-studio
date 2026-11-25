// BRZA-SYNC: rodada — o fork tinha aqui `accountSwitch` (recibo do "Continuar em outra conta", P36/P79); falta decidir como portá-lo.
import type { AgentSessionForkedFrom } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import type { AgentSessionAccountSwitch } from '../../agent-session-account-switch-record'
import type { AgentSessionStoreTransactions } from './agent-session-store-transactions'
import type { AgentSessionConversationClear } from './agent-session-conversation-command-record'
import type { AgentSessionRewindRecord } from '../../../../shared/agent-session/lifecycle/rewind/agent-session-rewind'

export function createAgentSessionConversationReceipts(
  transactions: Pick<AgentSessionStoreTransactions, 'mutationReceipt'>
) {
  return {
    forkBoundary: (sessionId: string, forkedFrom: AgentSessionForkedFrom) =>
      transactions.mutationReceipt({ kind: 'fork-boundary', sessionId, forkedFrom }),
    clear: (
      clear: () => AgentSessionConversationClear,
      operation: { callerKey: string; operationId: string }
    ) => transactions.mutationReceipt(() => ({ kind: 'clear', clear: clear(), operation })),
    accountSwitch: (
      change: () => AgentSessionAccountSwitch,
      operation: { callerKey: string; operationId: string }
    ) =>
      transactions.mutationReceipt(() => ({ kind: 'account-switch', change: change(), operation })),
    rewind: (sessionId: string, fence: number, rewind: AgentSessionRewindRecord) =>
      transactions.mutationReceipt({ kind: 'rewind-complete', sessionId, fence, rewind })
  }
}
