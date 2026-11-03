// Resume automatically: the host sends a chat's usage-limit Continue once the limit resets.
// One schedule per chat, bound to the cut turn and kept on disk; it fires once, and only while the
// chat still sits on that cut, so any message sent since cancels it. A cut cancelled or already
// sent is kept, one per chat, so a client's own default never schedules it again (BrzA P79).

import {
  nativeChatUsageLimitAutoResumeAt,
  type NativeChatUsageLimitAutoResume,
  type NativeChatUsageLimitAutoResumeCut
} from '../../../shared/native-chat/native-chat-usage-limit-auto-resume'
import type { StructuredAgentSessionLogger } from './structured-agent-session-logger'

/** Wall-clock checks this often: a monotonic timer stalls while the machine sleeps. */
const CHECK_INTERVAL_MS = 60_000
/** A chat that old is long past its cut; the bound keeps the file small. */
const MAX_DECLINED_CUTS = 500

export type StructuredAgentSessionUsageLimitAutoResumeDeps = {
  file: {
    read: () => Promise<NativeChatUsageLimitAutoResume[]>
    /** `declined` left out keeps the cuts the file holds. */
    update: <T>(
      change: (
        entries: NativeChatUsageLimitAutoResume[],
        declined: NativeChatUsageLimitAutoResumeCut[]
      ) => {
        entries: NativeChatUsageLimitAutoResume[]
        declined?: NativeChatUsageLimitAutoResumeCut[]
        result: T
      }
    ) => Promise<T>
  }
  /** The chat's latest usage-limit cut; null when it moved on or cannot be read. */
  readCut: (sessionId: string) => Promise<{ turnItemId: string; resetsAt?: number } | null>
  /** The Continue the row's button sends, bound to the cut turn. */
  sendContinue: (sessionId: string, turnItemId: string) => Promise<void>
  now: () => number
  logger: StructuredAgentSessionLogger
}

export type StructuredAgentSessionUsageLimitAutoResume = {
  /** Arms what the file holds; a schedule that came due while Orca was closed fires now. */
  start: () => Promise<void>
  stop: () => void
  /** Null when the chat no longer sits on that cut, or its limit gave no reset time; with
   *  `automatic`, also when that cut was cancelled or its Continue already sent. */
  schedule: (
    sessionId: string,
    turnItemId: string,
    options?: { automatic?: boolean }
  ) => Promise<NativeChatUsageLimitAutoResume | null>
  cancel: (sessionId: string) => Promise<void>
  list: (sessionId?: string) => Promise<NativeChatUsageLimitAutoResume[]>
}

export function createStructuredAgentSessionUsageLimitAutoResume(
  deps: StructuredAgentSessionUsageLimitAutoResumeDeps
): StructuredAgentSessionUsageLimitAutoResume {
  let known: readonly NativeChatUsageLimitAutoResume[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let firing: Promise<void> | null = null

  const stillCut = async (entry: NativeChatUsageLimitAutoResume): Promise<boolean> => {
    const cut = await deps.readCut(entry.sessionId).catch(() => null)
    return cut?.turnItemId === entry.turnItemId
  }

  const arm = (): void => {
    clearTimeout(timer)
    timer = undefined
    if (stopped || known.length === 0) {
      return
    }
    const next = Math.min(...known.map((entry) => entry.resumeAt))
    const delay = Math.max(0, Math.min(next - deps.now(), CHECK_INTERVAL_MS))
    timer = setTimeout(() => {
      timer = undefined
      void fireDue()
    }, delay)
  }

  const write: StructuredAgentSessionUsageLimitAutoResumeDeps['file']['update'] = (change) =>
    deps.file.update((entries, declined) => {
      const changed = change(entries, declined)
      known = changed.entries
      return changed
    })

  /** One mark per chat: a newer cut replaces the older one, and the oldest chats' marks go. */
  const declineIn = (
    declined: NativeChatUsageLimitAutoResumeCut[],
    cuts: readonly NativeChatUsageLimitAutoResumeCut[]
  ): NativeChatUsageLimitAutoResumeCut[] =>
    [
      ...declined.filter((mark) => !cuts.some((cut) => cut.sessionId === mark.sessionId)),
      ...cuts.map(({ sessionId, turnItemId }) => ({ sessionId, turnItemId }))
    ].slice(-MAX_DECLINED_CUTS)

  const sendDue = async (): Promise<void> => {
    if (!known.some((entry) => entry.resumeAt <= deps.now())) {
      return
    }
    // Off the disk before sending, so a crash mid-send never sends twice.
    const due = await write((entries, declined) => {
      const now = deps.now()
      const sending = entries.filter((entry) => entry.resumeAt <= now)
      return {
        entries: entries.filter((entry) => entry.resumeAt > now),
        declined: declineIn(declined, sending),
        result: sending
      }
    })
    for (const entry of due) {
      if (stopped || !(await stillCut(entry))) {
        continue
      }
      await deps.sendContinue(entry.sessionId, entry.turnItemId).catch((error: unknown) => {
        deps.logger.warn('resuming a chat after its usage limit failed', {
          scope: 'usage-limit-auto-resume',
          sessionId: entry.sessionId,
          error
        })
      })
    }
  }

  const fireDue = (): Promise<void> => {
    firing ??= sendDue()
      .catch((error: unknown) => {
        deps.logger.warn('writing the usage-limit auto-resume schedule failed', {
          scope: 'usage-limit-auto-resume',
          error
        })
      })
      .finally(() => {
        firing = null
        arm()
      })
    return firing
  }

  const withoutSession = (entries: NativeChatUsageLimitAutoResume[], sessionId: string) =>
    entries.filter((entry) => entry.sessionId !== sessionId)

  return {
    start: async () => {
      try {
        known = await deps.file.read()
      } catch (error) {
        deps.logger.warn('reading the usage-limit auto-resume schedule failed', {
          scope: 'usage-limit-auto-resume',
          error
        })
        return
      }
      await fireDue()
    },
    stop: () => {
      stopped = true
      clearTimeout(timer)
      timer = undefined
    },
    schedule: async (sessionId, turnItemId, options) => {
      const cut = await deps.readCut(sessionId)
      if (cut?.turnItemId !== turnItemId || cut.resetsAt === undefined) {
        return null
      }
      const entry = {
        sessionId,
        turnItemId,
        resumeAt: nativeChatUsageLimitAutoResumeAt(cut.resetsAt)
      }
      const scheduled = await write((entries, declined) => {
        // A mark for an older cut of this chat no longer holds anything back.
        const marks = declined.filter(
          (mark) => mark.sessionId !== sessionId || mark.turnItemId === turnItemId
        )
        if (options?.automatic && marks.some((mark) => mark.sessionId === sessionId)) {
          return { entries, declined: marks, result: null }
        }
        return {
          entries: [...withoutSession(entries, sessionId), entry],
          declined: marks,
          result: entry
        }
      })
      arm()
      return scheduled
    },
    cancel: async (sessionId) => {
      await write((entries, declined) => ({
        entries: withoutSession(entries, sessionId),
        declined: declineIn(
          declined,
          entries.filter((entry) => entry.sessionId === sessionId)
        ),
        result: undefined
      }))
      arm()
    },
    list: async (sessionId) => {
      const entries = (await deps.file.read()).filter(
        (entry) => sessionId === undefined || entry.sessionId === sessionId
      )
      const kept: NativeChatUsageLimitAutoResume[] = []
      const moved: NativeChatUsageLimitAutoResume[] = []
      for (const entry of entries) {
        if (await stillCut(entry)) {
          kept.push(entry)
        } else {
          moved.push(entry)
        }
      }
      if (moved.length > 0) {
        // Exact matches only: a schedule made while this read ran stays.
        await write((current) => ({
          entries: current.filter(
            (entry) =>
              !moved.some(
                (gone) =>
                  gone.sessionId === entry.sessionId &&
                  gone.turnItemId === entry.turnItemId &&
                  gone.resumeAt === entry.resumeAt
              )
          ),
          result: undefined
        }))
        arm()
      }
      return kept
    }
  }
}
