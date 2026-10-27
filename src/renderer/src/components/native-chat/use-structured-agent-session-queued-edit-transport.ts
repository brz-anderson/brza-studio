import { useMemo } from 'react'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import {
  useStructuredAgentSessionHostEditsQueuedImages,
  useStructuredAgentSessionHostEditsQueuedMessages,
  useStructuredAgentSessionHostReordersQueuedMessages
} from '@/runtime/structured-agent-session-host-capability'
import type { QueuedEditTransport } from './use-structured-agent-session-queued-edit'
import type { StructuredAgentSessionWrite } from './use-structured-agent-session-mutate'

/** What a queued card's Edit writes through, as far as this chat's host supports it. */
export function useStructuredAgentSessionQueuedEditTransport(
  target: RuntimeClientTarget,
  sessionId: string,
  write: StructuredAgentSessionWrite
): QueuedEditTransport {
  const capable = useStructuredAgentSessionHostEditsQueuedMessages(target)
  const imagesCapable = useStructuredAgentSessionHostEditsQueuedImages(target)
  const reorderCapable = useStructuredAgentSessionHostReordersQueuedMessages(target)
  return useMemo(
    () => ({ target, sessionId, capable, imagesCapable, reorderCapable, write }),
    [capable, imagesCapable, reorderCapable, sessionId, target, write]
  )
}
