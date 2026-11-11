import { StructuredAgentSessionAdapterRouter } from '../agent-session-wire/providers/structured-agent-session-adapter-router'
import type { StructuredAgentSessionAdapter } from '../agent-session-wire/providers/structured-agent-session-adapter'

/** The router plus the BrzA methods: the mid-chat permission mode follows the live owner, and the
 *  account switch and the fork through a message follow the record's agent, so a chat at rest
 *  still reaches its adapter. Kept out of the upstream router, which sits at its line limit. */
export class BrzaStructuredAgentSessionAdapterRouter extends StructuredAgentSessionAdapterRouter {
  applyPermissionMode: NonNullable<StructuredAgentSessionAdapter['applyPermissionMode']> = (
    input
  ) => this.liveOwnerOrNull(input.sessionId)?.applyPermissionMode?.(input) ?? Promise.resolve(false)

  prepareAccountSwitch: NonNullable<StructuredAgentSessionAdapter['prepareAccountSwitch']> = (
    input
  ) =>
    this.capabilityOwner(
      input.record.sessionId,
      input.record.provider
    )?.adapter.prepareAccountSwitch?.(input) ??
    Promise.resolve({ ok: false, reason: 'unknown-account' })

  forkThroughMessage: NonNullable<StructuredAgentSessionAdapter['forkThroughMessage']> = (input) =>
    this.capabilityOwner(
      input.record.sessionId,
      input.record.provider
    )?.adapter.forkThroughMessage?.(input) ?? Promise.resolve({ ok: false, reason: 'unsupported' })
}
