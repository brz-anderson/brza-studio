import type { StructuredAgentSessionHost } from '../host/structured-agent-session-host'
import { releaseIdleChatsOnOtherAccount } from '../host/structured-agent-session-account-switch'
import { BrzaDeferredUsageLimitContinue } from './brza-deferred-usage-limit-continue'

type HostInternals = ReturnType<StructuredAgentSessionHost['collaboratorsForTests']>
const CALLER = { callerKey: 'trusted-local:brza-continue-after-work' }

/** Montagem do pedido adiado no host, numa linha de campo: o host está no limite de linhas e muda a
 *  cada sync. `internals` só é lido depois do construtor, quando os colaboradores existem. */
export function start(
  host: Pick<StructuredAgentSessionHost, 'send' | 'deps' | 'conversationCommands'>,
  internals: () => HostInternals
): BrzaDeferredUsageLimitContinue {
  return new BrzaDeferredUsageLimitContinue({
    session: (sessionId) => internals().sessions.get(sessionId),
    store: () => host.deps.store,
    launchAccountHome: () => host.deps.launchAccountHome,
    retainedWork: (sessionId) => internals().conversationDelivery.retainedWork(sessionId),
    readCut: (sessionId) => internals().clientDelivery.readUsageLimitCut(sessionId),
    serialize: (sessionId, task) => internals().serialize(sessionId, task),
    send: (params) => host.send(CALLER, params),
    switchAccount: (params) => host.conversationCommands.switchAccount(CALLER, params),
    stopAgent: (sessionId) =>
      internals().lifetime.stopAgent(sessionId, { cause: 'evict', resting: true }),
    publish: (sessionId) => internals().clientDelivery.publishStatus(sessionId),
    subscribeStatus: (subscriber) => internals().clientDelivery.subscribeStatus(subscriber),
    now: () => host.deps.now?.() ?? Date.now(),
    logger: () => host.deps.logger
  })
}

/** The host's Stop, which drops a waiting continue (R4.3) once the host took it, and only the chat's
 *  own: a task's Stop on the strip or a question card's cancel leave the wait (R9.1). */
export function stopsWaiting<
  P extends {
    envelope: { sessionId: string }
    scope?: unknown
    taskId?: unknown
    prompt?: unknown
  },
  C,
  R extends { ok: boolean }
>(
  host: Pick<StructuredAgentSessionHost, 'brzaContinueAfterWork'>,
  cancel: (caller: C, params: P) => Promise<R>
): (caller: C, params: P) => Promise<R> {
  return async (caller, params) => {
    const { sessionId } = params.envelope
    if (params.scope !== undefined || params.taskId !== undefined || params.prompt !== undefined) {
      return cancel(caller, params)
    }
    const release = host.brzaContinueAfterWork.pause(sessionId)
    try {
      const result = await cancel(caller, params)
      if (result.ok) {
        host.brzaContinueAfterWork.stopped(sessionId)
      }
      return result
    } finally {
      release()
    }
  }
}

/** A selection applied: idle chats leave the old account, and a waiting continue checks again, so a
 *  selection back to the agent's account takes its line down at once (PLN-026, R9.2). */
export async function releaseIdleChatsAndRecheck(
  host: StructuredAgentSessionHost | null,
  agent: string,
  committed: () => boolean
): Promise<void> {
  await releaseIdleChatsOnOtherAccount(host, agent, committed)
  await host?.brzaContinueAfterWork.tick()
}
