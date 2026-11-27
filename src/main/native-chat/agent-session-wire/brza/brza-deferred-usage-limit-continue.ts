import type { BrzaContinueAfterWorkStatus } from '../../../../shared/agent-session/brza/agent-session-status-continue-after-work'
import type { BrzaContinueAfterWorkRequest } from '../../../../shared/rpc-contract/brza/brza-continue-after-work-params'
import type { StructuredConversationCommandController } from '../operations/structured-conversation-command-controller'
import { agentSessionAccountHomesEqual } from '../../../../shared/agent-session/lifecycle/accounts/agent-session-account-home'
import { structuredAgentSessionMessageSendMutation } from '../../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import type { AgentSessionRecordStore } from '../../../runtime/agent-session/records/agent-session-record-store'
import type {
  StructuredAgentSessionHostDeps,
  StructuredAgentSessionHostSession
} from '../host/structured-agent-session-host-types'
import { structuredAgentSessionChildOwesWork } from '../recovery/structured-agent-session-outgrown-child'
import type { HostUsageLimitCut } from '../recovery/structured-agent-session-usage-limit-chain'
import type { UsageLimitContinueDeps } from '../recovery/structured-agent-session-usage-limit-continue-deps'
import { usageLimitContinueMutation } from '../recovery/structured-agent-session-usage-limit-continue-message'
import { structuredAgentSessionChildHasOpenWork } from '../termination/structured-agent-session-idle-sweep'
import type { StructuredAgentSessionStatusSubscriber } from '../observations/structured-agent-session-status-feed-deps'
import { brzaContinueAfterWorkStatuses as statuses } from './brza-continue-after-work-status'
import {
  brzaTaskNotifications,
  owedWakeUps,
  type BrzaRetainedWork
} from './brza-continue-after-work-wake-up'

/** R4.2, R7.2: the wait gives up after 30 minutes. */
export const BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS = 30 * 60_000
/** R4.1: a finished task whose wake-up has not started by now is carried in the continue. */
export const BRZA_CONTINUE_AFTER_WORK_WAKE_UP_GRACE_MS = 30_000

type Pending = {
  turnItemId: string
  account: string
  target: NonNullable<BrzaContinueAfterWorkRequest['target']>
  accountId?: string | null
  armedAt: number
  fallbackAt?: number
}
type Verdict = 'wait' | 'cancel' | 'drop' | 'expire' | 'fire' | 'fallback'

export type BrzaContinueAfterWorkDeps = {
  session: (sessionId: string) => StructuredAgentSessionHostSession | undefined
  store: () => Pick<AgentSessionRecordStore, 'getRecord' | 'getConversation' | 'hostId'>
  launchAccountHome: () => StructuredAgentSessionHostDeps['launchAccountHome']
  retainedWork: (sessionId: string) => BrzaRetainedWork
  readCut: (sessionId: string) => Promise<HostUsageLimitCut | null>
  serialize: UsageLimitContinueDeps['serialize']
  send: UsageLimitContinueDeps['send']
  /** Stops the chat's agent at rest, as an outgrown one is. */
  stopAgent: (sessionId: string) => Promise<void>
  publish: (sessionId: string) => void
  /** Moves a pinned chat to `accountId` (P36); the `pin` target switches before it continues (P5). */
  switchAccount: (
    params: Parameters<StructuredConversationCommandController['switchAccount']>[1]
  ) => ReturnType<StructuredConversationCommandController['switchAccount']>
  /** Every status publish: a turn ending, child work settling, the agent stopping. */
  subscribeStatus: (subscriber: StructuredAgentSessionStatusSubscriber) => () => void
  now: () => number
  logger: () => StructuredAgentSessionHostDeps['logger']
}

/** O Continuar em outra conta de um chat que segue a seleção, adiado enquanto o agente fica na conta
 *  esgotada pelo trabalho em segundo plano (PLN-026, D1–D2). Quando o trabalho acaba e o acordar do
 *  lead passa, manda a continuação do corte mais novo; o envio solta o agente e o relança na conta
 *  selecionada. Fica em memória: o reinício do app corta a tarefa e o Continuar da linha já move. */
export class BrzaDeferredUsageLimitContinue {
  private readonly pending = new Map<string, Pending>()
  private readonly deadlines = new Map<string, ReturnType<typeof setTimeout>[]>()
  private stopWatching: (() => void) | undefined
  private pass: Promise<void> | undefined
  private again = false
  private disposed = false

  constructor(private readonly deps: BrzaContinueAfterWorkDeps) {}

  /** `now`: nothing holds the agent on another account, so the row's Continue moves it today.
   *  The `pin` target is P5's (D5): until then it answers `now`, the pinned path of today. */
  arm = (input: BrzaContinueAfterWorkRequest): Promise<{ kind: 'now' | 'deferred' }> =>
    this.deps.serialize(input.sessionId, async () => {
      const { sessionId, turnItemId, account = '', target = 'selection' } = input
      const session = this.deps.session(sessionId)
      if (
        this.disposed ||
        !session ||
        target === 'pin' ||
        !(await this.heldOnOtherAccount(sessionId))
      ) {
        return { kind: 'now' as const }
      }
      const armedAt = this.deps.now()
      this.pending.set(sessionId, {
        turnItemId,
        account,
        target,
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        armedAt
      })
      statuses.set(session, { turnItemId, account, since: armedAt })
      this.deps.publish(sessionId)
      this.watch()
      this.at(sessionId, armedAt + BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS)
      return { kind: 'deferred' as const }
    })

  /** The row's Cancel, and the dismissal of an expired wait. */
  cancel = (sessionId: string): Promise<void> =>
    this.deps.serialize(sessionId, async () => this.end(sessionId))

  /** A Stop drops the wait: stopping must not turn into continuing later (R4.3). */
  stopped = (sessionId: string): void => {
    if (this.pending.has(sessionId)) {
      void this.cancel(sessionId).catch(this.warn(sessionId))
    }
  }

  readState = (sessionId: string): BrzaContinueAfterWorkStatus | undefined => {
    const session = this.deps.session(sessionId)
    return session && statuses.get(session)
  }

  dispose(): void {
    this.disposed = true
    for (const sessionId of this.pending.keys()) {
      this.forget(sessionId)
    }
  }

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
      for (const sessionId of this.pending.keys()) {
        if (!this.disposed) {
          await this.check(sessionId).catch(this.warn(sessionId))
        }
      }
    } while (this.again && !this.disposed)
  }

  /** Pushed, not polled: what ends the wait publishes the chat's status. */
  private watch(): void {
    this.stopWatching ??= this.deps.subscribeStatus({
      id: 'brza-continue-after-work',
      emit: (event) => {
        const ids =
          event.type === 'status'
            ? [event.session.sessionId]
            : event.type === 'snapshot'
              ? event.sessions.map((summary) => summary.sessionId)
              : []
        if (ids.some((id) => this.pending.has(id))) {
          void this.tick()
        }
      }
    })
  }

  /** A deadline no publish announces: the 30-minute limit, or a wake-up overdue. */
  private at(sessionId: string, when: number): void {
    const timer = setTimeout(() => void this.tick(), Math.max(0, when - this.deps.now()))
    timer.unref?.()
    this.deadlines.set(sessionId, [...(this.deadlines.get(sessionId) ?? []), timer])
  }

  private forget(sessionId: string): void {
    this.pending.delete(sessionId)
    this.deadlines.get(sessionId)?.forEach(clearTimeout)
    this.deadlines.delete(sessionId)
    if (this.pending.size === 0) {
      this.stopWatching?.()
      this.stopWatching = undefined
    }
  }

  private async check(sessionId: string): Promise<void> {
    const decided = await this.deps.serialize(sessionId, async () => {
      const pending = this.pending.get(sessionId)
      const verdict = pending ? await this.verdict(sessionId, pending) : 'wait'
      // Read before the stop: the agent's tasks are what the continue has to carry.
      const notices =
        verdict === 'fallback'
          ? brzaTaskNotifications(owedWakeUps(null, this.childWork(sessionId)))
          : ''
      if (verdict === 'fallback') {
        await this.deps.stopAgent(sessionId)
      }
      if (verdict !== 'wait') {
        this.end(sessionId, verdict === 'expire')
      }
      return { verdict, notices }
    })
    if (decided.verdict === 'fire' || decided.verdict === 'fallback') {
      await this.continueOn(sessionId, decided.notices)
    }
  }

  private async verdict(sessionId: string, pending: Pending): Promise<Verdict> {
    const session = this.deps.session(sessionId)
    const record = this.deps.store().getRecord(sessionId)
    // Closed, moved to another host, or evicted: nothing is left to continue here.
    if (!session || !record || record.location.executionHostId !== this.deps.store().hostId) {
      return 'drop'
    }
    // Pinned since (P36): the chat no longer follows the selection.
    if (record.accountSwitch) {
      return 'cancel'
    }
    const selected = await this.selectedHome(sessionId)
    const home = session.child?.accountHome
    if (home && selected && agentSessionAccountHomesEqual(home, selected)) {
      return 'cancel'
    }
    if (!session.child || !(await structuredAgentSessionChildOwesWork(this.retained(sessionId)))) {
      return 'fire'
    }
    if (this.deps.now() - pending.armedAt >= BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS) {
      return 'expire'
    }
    return (await this.wakeUpOverdue(sessionId, pending)) ? 'fallback' : 'wait'
  }

  /** The task settled a while ago, nothing else is open and no turn started for its wake-up;
   *  until then, a deadline checks again when the grace runs out. */
  private async wakeUpOverdue(sessionId: string, pending: Pending): Promise<boolean> {
    const reads = this.retained(sessionId)
    const work = await reads.currentWork()
    const owed = owedWakeUps(work, reads.childWork())
    if (owed.length === 0 || structuredAgentSessionChildHasOpenWork(reads, work)) {
      return false
    }
    const due =
      Math.max(...owed.map((task) => task.settledAt ?? 0)) +
      BRZA_CONTINUE_AFTER_WORK_WAKE_UP_GRACE_MS
    if (this.deps.now() >= due) {
      return true
    }
    if (pending.fallbackAt !== due) {
      pending.fallbackAt = due
      this.at(sessionId, due)
    }
    return false
  }

  /** The newest cut's continue: it releases the agent and starts it on the selected account. With
   *  `notices`, the stopped agent never woke up for its tasks, so they travel in the body. */
  private async continueOn(sessionId: string, notices: string): Promise<void> {
    const cut = await this.deps.readCut(sessionId)
    const fence = this.deps.store().getConversation(sessionId)?.currentFence
    // No cut left: the wake-up went through on the old account, so nothing is cut off any more.
    if (!cut || fence === undefined) {
      return
    }
    const base = await usageLimitContinueMutation({
      sessionId,
      cut,
      at: this.deps.now(),
      expectedRuntimeFence: fence
    })
    const result = await this.deps.send(
      notices
        ? structuredAgentSessionMessageSendMutation({
            sessionId,
            clientOperationId: base.envelope.clientOperationId,
            expectedRuntimeFence: fence,
            body: { ...base.body, blocks: [...base.body.blocks, { type: 'text', text: notices }] },
            usageLimitContinuationOfTurnItemId: cut.turnItemId
          })
        : base
    )
    // Superseded: the automatic continue reached the newer cut first and already moved the chat.
    if (!result.ok && result.refusal.details?.reason !== 'continuationSuperseded') {
      this.deps.logger().warn('the deferred continue in another account was refused', {
        scope: 'brza-continue-after-work',
        sessionId,
        reason: result.refusal.details?.reason
      })
    }
  }

  private async heldOnOtherAccount(sessionId: string): Promise<boolean> {
    const session = this.deps.session(sessionId)
    const home = session?.child?.accountHome
    const selected = await this.selectedHome(sessionId)
    return (
      home !== undefined &&
      selected !== null &&
      !this.deps.store().getRecord(sessionId)?.accountSwitch &&
      !agentSessionAccountHomesEqual(home, selected) &&
      (await structuredAgentSessionChildOwesWork(this.retained(sessionId)))
    )
  }

  private async selectedHome(sessionId: string) {
    const record = this.deps.store().getRecord(sessionId)
    const read = this.deps.launchAccountHome()
    return record && read ? await read(record).catch(() => null) : null
  }

  private retained = (sessionId: string): BrzaRetainedWork => this.deps.retainedWork(sessionId)
  private childWork = (sessionId: string) => this.retained(sessionId).childWork()

  /** Expired keeps the status, so the row says the wait ran out until the person dismisses it. */
  private end(sessionId: string, expired = false): void {
    const session = this.deps.session(sessionId)
    const status = session && statuses.get(session)
    this.forget(sessionId)
    if (session && status) {
      if (expired) {
        statuses.set(session, { ...status, expired: true })
      } else {
        statuses.delete(session)
      }
      this.deps.publish(sessionId)
    }
  }

  private warn = (sessionId: string) => (error: unknown) =>
    this.deps.logger().warn('the deferred continue in another account failed', {
      scope: 'brza-continue-after-work',
      sessionId,
      error
    })
}
