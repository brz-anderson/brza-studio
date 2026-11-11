import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { AGENT_SESSION_REWIND_RUNTIME_CAPABILITY } from '../../../../shared/agent-session/agent-session-runtime-capabilities'
import { runtimeEnvironmentSupportsCapability } from '../rpc/compatibility/runtime-capability-proof'

/** Upstream's text with the product name. */
export const REWIND_NEEDS_NEWER_SERVER_MESSAGE =
  'Rewinding requires a newer BrzA Studio server. Update the server and try again.'

/** Refuses a rewind a remote server is too old to run. Kept out of the client, which sits at its
 *  line limit, so the message keeps upstream's wording under the brand. */
export async function assertServerSupportsRewind(
  method: string,
  target: RuntimeClientTarget
): Promise<void> {
  if (
    method === 'agentSession.rewind' &&
    target.kind === 'environment' &&
    !(await runtimeEnvironmentSupportsCapability(
      target.environmentId,
      AGENT_SESSION_REWIND_RUNTIME_CAPABILITY
    ))
  ) {
    throw new Error(REWIND_NEEDS_NEWER_SERVER_MESSAGE)
  }
}
