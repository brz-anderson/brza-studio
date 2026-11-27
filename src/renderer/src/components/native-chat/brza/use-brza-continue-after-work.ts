import { useMemo } from 'react'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { useStructuredAgentSessionHostCapabilityState } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'
import type { BrzaContinueAfterWorkStatus } from '../../../../../shared/agent-session/brza/agent-session-status-continue-after-work'
import { BRZA_CONTINUE_AFTER_WORK_RUNTIME_CAPABILITY } from '../../../../../shared/rpc-contract/brza/brza-continue-after-work-params'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { useBrzaContinueAfterWorkStatus } from './use-brza-continue-after-work-status'

export type BrzaContinueAfterWorkView = {
  status: BrzaContinueAfterWorkStatus | null
  /** `deferred`: the host continues once the background work is done; `now`: continue as before. */
  arm: (turnItemId: string, account: string) => Promise<'now' | 'deferred'>
  cancel: () => void
}

/** O pedido adiado do host (PLN-026, D3–D4), num chat que segue a seleção; undefined num host sem a
 *  capacidade (mais velho ou remoto), onde o Continuar segue na hora como antes. */
export function useBrzaContinueAfterWork(pane: {
  sessionId: string
  target: RuntimeClientTarget
}): BrzaContinueAfterWorkView | undefined {
  const { sessionId, target } = pane
  const capability = useStructuredAgentSessionHostCapabilityState(
    target,
    BRZA_CONTINUE_AFTER_WORK_RUNTIME_CAPABILITY
  )
  const status = useBrzaContinueAfterWorkStatus(sessionId, target)
  return useMemo(() => {
    if (capability !== 'supported') {
      return undefined
    }
    return {
      status,
      arm: async (turnItemId, account) => {
        const armed = await callStructuredAgentSession<{ kind: 'now' | 'deferred' }>(
          target,
          'agentSession.brzaContinueAfterWork',
          { sessionId, turnItemId, account }
        ).catch((error: unknown) => {
          console.error('Failed to defer Continue in another account:', error)
          return null
        })
        return armed?.kind === 'deferred' ? 'deferred' : 'now'
      },
      cancel: () => {
        void callStructuredAgentSession(target, 'agentSession.brzaCancelContinueAfterWork', {
          sessionId
        }).catch((error: unknown) => {
          console.error('Failed to cancel the deferred continue:', error)
        })
      }
    }
  }, [capability, sessionId, status, target])
}
