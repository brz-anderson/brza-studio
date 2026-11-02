import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import type { StructuredAgentSessionAdapter } from '../agent-session-wire/structured-agent-session-adapter'

type RecordAdapter = (record: AgentSessionRecord) => StructuredAgentSessionAdapter | undefined

/** The router's BrzA methods that follow the record's agent, so a chat at rest still reaches its
 *  adapter. Split out of the router, which is at its line limit. */
export function brzaRouterRecordMethods(adapterOf: RecordAdapter) {
  return {
    prepareAccountSwitch: ((input) =>
      adapterOf(input.record)?.prepareAccountSwitch?.(input) ??
      Promise.resolve({ ok: false, reason: 'unknown-account' })) satisfies NonNullable<
      StructuredAgentSessionAdapter['prepareAccountSwitch']
    >,
    forkThroughMessage: ((input) =>
      adapterOf(input.record)?.forkThroughMessage?.(input) ??
      Promise.resolve({ ok: false, reason: 'unsupported' })) satisfies NonNullable<
      StructuredAgentSessionAdapter['forkThroughMessage']
    >
  }
}
