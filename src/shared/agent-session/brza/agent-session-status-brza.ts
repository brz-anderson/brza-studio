import type { AgentSessionStatusAccountSwitch } from './agent-session-status-account-switch'
import type { AgentSessionStatusContinueAfterWork } from './agent-session-status-continue-after-work'

/** Os campos do BrzA no resumo de status, num tipo só para o `agent-session-wire.ts` mudar uma linha. */
export type AgentSessionStatusBrza = AgentSessionStatusAccountSwitch &
  AgentSessionStatusContinueAfterWork
