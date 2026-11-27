import type { StructuredAgentSessionHost } from '../host/structured-agent-session-host'
import { BrzaDeferredUsageLimitContinue } from './brza-deferred-usage-limit-continue'

type HostInternals = ReturnType<StructuredAgentSessionHost['collaboratorsForTests']>

/** Montagem do pedido adiado no host, numa linha de campo: o host está no limite de linhas e muda a
 *  cada sync. `internals` só é lido depois do construtor, quando os colaboradores existem. */
export function start(
  host: Pick<StructuredAgentSessionHost, 'send' | 'deps'>,
  internals: () => HostInternals
): BrzaDeferredUsageLimitContinue {
  return new BrzaDeferredUsageLimitContinue({
    session: (sessionId) => internals().sessions.get(sessionId),
    store: () => host.deps.store,
    launchAccountHome: () => host.deps.launchAccountHome,
    retainedWork: (sessionId) => internals().conversationDelivery.retainedWork(sessionId),
    readCut: (sessionId) => internals().clientDelivery.readUsageLimitCut(sessionId),
    serialize: (sessionId, task) => internals().serialize(sessionId, task),
    send: (params) => host.send({ callerKey: 'trusted-local:brza-continue-after-work' }, params),
    stopAgent: (sessionId) =>
      internals().lifetime.stopAgent(sessionId, { cause: 'evict', resting: true }),
    publish: (sessionId) => internals().clientDelivery.publishStatus(sessionId),
    subscribeStatus: (subscriber) => internals().clientDelivery.subscribeStatus(subscriber),
    now: () => host.deps.now?.() ?? Date.now(),
    logger: () => host.deps.logger
  })
}

/** The host's Stop, which also drops a waiting continue (R4.3). */
export function stopsWaiting<P extends { envelope: { sessionId: string } }, C, R>(
  host: Pick<StructuredAgentSessionHost, 'brzaContinueAfterWork'>,
  cancel: (caller: C, params: P) => R
): (caller: C, params: P) => R {
  return (caller, params) => {
    host.brzaContinueAfterWork.stopped(params.envelope.sessionId)
    return cancel(caller, params)
  }
}
