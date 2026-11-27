// `agentSession.brzaContinueAfterWork` — Continue in another account on a chat whose agent stays on
// the old account for its background work: the host continues once that work is done (PLN-026).

import {
  BrzaCancelContinueAfterWorkParams,
  BrzaContinueAfterWorkParams
} from '../../../../../../shared/rpc-contract/brza/brza-continue-after-work-params'
import { defineMethod } from '../../../core'
import { requireInstalledStructuredHost } from '../creation/structured-agent-session-gate'

export const BRZA_CONTINUE_AFTER_WORK_METHODS = [
  defineMethod({
    name: 'agentSession.brzaContinueAfterWork',
    permission: 'workspace',
    params: BrzaContinueAfterWorkParams,
    handler: async (params, ctx) => {
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      return host.brzaContinueAfterWork.arm(params)
    }
  }),
  defineMethod({
    name: 'agentSession.brzaCancelContinueAfterWork',
    permission: 'workspace',
    params: BrzaCancelContinueAfterWorkParams,
    handler: async (params, ctx) => {
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      await host.brzaContinueAfterWork.cancel(params.sessionId)
      return { ok: true as const }
    }
  })
]
