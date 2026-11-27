import type { StructuredAgentSessionStatusSubscriber } from '../observations/structured-agent-session-status-feed-deps'

/** When the deferred continue checks its waiting chats: pushed, not polled. What ends a wait
 *  publishes the chat's status; only deadlines no publish announces get a one-shot timer. */
export class BrzaContinueAfterWorkTriggers {
  private readonly deadlines = new Map<string, ReturnType<typeof setTimeout>[]>()
  private stopWatching: (() => void) | undefined
  private pass: Promise<void> | undefined
  private again = false

  constructor(
    private readonly deps: {
      subscribeStatus: (subscriber: StructuredAgentSessionStatusSubscriber) => () => void
      now: () => number
      waiting: ReadonlyMap<string, unknown>
      check: (sessionId: string) => Promise<void>
      disposed: () => boolean
    }
  ) {}

  /** Checks every waiting chat; a publish that lands meanwhile runs one more pass. */
  tick(): Promise<void> {
    if (this.pass) {
      this.again = true
      return this.pass
    }
    this.pass = this.passes().finally(() => {
      this.pass = undefined
    })
    return this.pass
  }

  private async passes(): Promise<void> {
    do {
      this.again = false
      for (const sessionId of this.deps.waiting.keys()) {
        if (!this.deps.disposed()) {
          await this.deps.check(sessionId)
        }
      }
    } while (this.again && !this.deps.disposed())
  }

  watch(): void {
    this.stopWatching ??= this.deps.subscribeStatus({
      id: 'brza-continue-after-work',
      emit: (event) => {
        const ids =
          event.type === 'status'
            ? [event.session.sessionId]
            : event.type === 'snapshot'
              ? event.sessions.map((summary) => summary.sessionId)
              : []
        if (ids.some((id) => this.deps.waiting.has(id))) {
          void this.tick()
        }
      }
    })
  }

  /** A deadline no publish announces: the 30-minute limit, a wake-up overdue, a switch retry. */
  at(sessionId: string, when: number): void {
    const timer = setTimeout(() => void this.tick(), Math.max(0, when - this.deps.now()))
    timer.unref?.()
    this.deadlines.set(sessionId, [...(this.deadlines.get(sessionId) ?? []), timer])
  }

  /** After the chat left `waiting`: its deadlines go, and the last one stops the watch. */
  forget(sessionId: string): void {
    this.deadlines.get(sessionId)?.forEach(clearTimeout)
    this.deadlines.delete(sessionId)
    if (this.deps.waiting.size === 0) {
      this.stopWatching?.()
      this.stopWatching = undefined
    }
  }
}
