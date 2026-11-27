import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/native-chat/status/structured-agent-session-status-feed'
import type { BrzaContinueAfterWorkStatus } from '../../../../../shared/agent-session/brza/agent-session-status-continue-after-work'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'

const SEPARATOR = '\u0000'

/** O Continuar em outra conta que o host segura para este chat (PLN-026, D4); null sem nenhum. */
export function useBrzaContinueAfterWorkStatus(
  sessionId: string,
  target: RuntimeClientTarget
): BrzaContinueAfterWorkStatus | null {
  const feed = useMemo(() => getStructuredAgentSessionStatusFeed(target), [target])
  useEffect(() => feed.activate(), [feed])
  // One string, so a status that leaves the wait alone does not re-render the row.
  const key = useSyncExternalStore(
    feed.subscribe,
    () => {
      const status = feed.getSnapshot().get(sessionId)?.brzaContinueAfterWork
      return status
        ? [
            status.turnItemId,
            status.account,
            status.since,
            status.expired ? '1' : '',
            status.accountUnavailable ? '1' : ''
          ].join(SEPARATOR)
        : ''
    },
    () => ''
  )
  return useMemo(() => {
    if (!key) {
      return null
    }
    const [turnItemId = '', account = '', since = '0', expired = '', unavailable = ''] =
      key.split(SEPARATOR)
    return {
      turnItemId,
      account,
      since: Number(since),
      ...(expired ? { expired: true } : {}),
      ...(unavailable ? { accountUnavailable: true } : {})
    }
  }, [key])
}
