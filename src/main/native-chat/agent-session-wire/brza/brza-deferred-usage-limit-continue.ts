import type { BrzaContinueAfterWorkStatus } from '../../../../shared/agent-session/brza/agent-session-status-continue-after-work'
import type { BrzaContinueAfterWorkRequest } from '../../../../shared/rpc-contract/brza/brza-continue-after-work-params'
import type { StructuredConversationCommandController } from '../operations/structured-conversation-command-controller'
import { agentSessionAccountHomesEqual } from '../../../../shared/agent-session/lifecycle/accounts/agent-session-account-home'
import type { AgentSessionRecordStore } from '../../../runtime/agent-session/records/agent-session-record-store'
import type {
  StructuredAgentSessionHostDeps,
  StructuredAgentSessionHostSession
} from '../host/structured-agent-session-host-types'
import { structuredAgentSessionChildOwesWork } from '../recovery/structured-agent-session-outgrown-child'
import type { UsageLimitContinueDeps } from '../recovery/structured-agent-session-usage-limit-continue-deps'
import type { StructuredAgentSessionStatusSubscriber } from '../observations/structured-agent-session-status-feed-deps'
import { brzaContinueAfterWorkStatuses as statuses } from './brza-continue-after-work-status'
import { BrzaContinueAfterWorkTriggers } from './brza-continue-after-work-triggers'
import { brzaWithoutCut, type BrzaContinueAfterWorkEnding } from './brza-continue-after-work-cut'
import { sendBrzaContinue, type BrzaContinueSendDeps } from './brza-continue-after-work-send'
import { BRZA_PIN_SWITCH_RETRY_MS, brzaPinOf, brzaSwitchPin } from './brza-continue-after-work-pin'
import {
  brzaTaskNotifications,
  brzaWakeUpDue,
  owedWakeUps,
  type BrzaRetainedWork
} from './brza-continue-after-work-wake-up'

/** R4.2, R7.2: the wait gives up after 30 minutes. */
export const BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS = 30 * 60_000

type Pending = {
  turnItemId: string
  account: string
  target: NonNullable<BrzaContinueAfterWorkRequest['target']>
  accountId?: string | null
  armedAt: number
  fallbackAt?: number
  /** The work was done with no cut yet after this failed turn; its limit row may be on its way. */
  cutMissing?: { turnId: string; at: number }
  /** `pin`: the chat's pin when the person chose; another since means the composer moved it. */
  pinAtArm?: string | null
  /** `pin`: a wake-up that never came, carried across a switch that has to wait. */
  notices?: string
  /** `pin`: after a refused switch, no new attempt before this. */
  retryAt?: number
}
type Verdict = 'wait' | 'cancel' | 'drop' | 'expire' | 'fire' | 'fallback' | 'turnFailed'

export type BrzaContinueAfterWorkDeps = BrzaContinueSendDeps & {
  session: (sessionId: string) => StructuredAgentSessionHostSession | undefined
  store: () => Pick<AgentSessionRecordStore, 'getRecord' | 'getConversation' | 'hostId'>
  launchAccountHome: () => StructuredAgentSessionHostDeps['launchAccountHome']
  retainedWork: (sessionId: string) => BrzaRetainedWork
  serialize: UsageLimitContinueDeps['serialize']
  /** Moves a pinned chat to `accountId` (P36), outside the chat's serialization, which it takes
   *  itself; the `pin` target switches before it continues (D5). */
  switchAccount: (
    params: Parameters<StructuredConversationCommandController['switchAccount']>[1]
  ) => ReturnType<StructuredConversationCommandController['switchAccount']>
  /** Stops the chat's agent at rest, as an outgrown one is. */
  stopAgent: (sessionId: string) => Promise<void>
  publish: (sessionId: string) => void
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
  private disposed = false
  private readonly paused = new Set<string>()
  private readonly triggers: BrzaContinueAfterWorkTriggers

  constructor(private readonly deps: BrzaContinueAfterWorkDeps) {
    this.triggers = new BrzaContinueAfterWorkTriggers({
      subscribeStatus: deps.subscribeStatus,
      now: deps.now,
      waiting: this.pending,
      check: (sessionId) => this.check(sessionId).catch(this.warn(sessionId)),
      disposed: () => this.disposed
    })
  }

  /** `now`: nothing holds the agent on another account, so the row's Continue moves it today. The
   *  `pin` target: a pinned chat's own switch waits for the work, then the continue follows (D5). */
  arm = (input: BrzaContinueAfterWorkRequest): Promise<{ kind: 'now' | 'deferred' }> =>
    this.deps.serialize(input.sessionId, async () => {
      const { sessionId, turnItemId, account = '', target = 'selection', accountId } = input
      const session = this.deps.session(sessionId)
      const record = this.deps.store().getRecord(sessionId)
      const pinAtArm = record ? brzaPinOf(record) : undefined
      const held =
        target === 'pin'
          ? accountId !== undefined &&
            pinAtArm !== accountId &&
            !!session?.child &&
            (await this.owesWork(sessionId))
          : await this.heldOnOtherAccount(sessionId)
      if (this.disposed || !session || !held) {
        return { kind: 'now' as const }
      }
      const armedAt = this.deps.now()
      this.pending.set(sessionId, {
        turnItemId,
        account,
        target,
        ...(accountId !== undefined ? { accountId } : {}),
        ...(target === 'pin' && pinAtArm !== undefined ? { pinAtArm } : {}),
        armedAt
      })
      statuses.set(session, { turnItemId, account, since: armedAt })
      this.deps.publish(sessionId)
      this.triggers.watch()
      this.triggers.at(sessionId, armedAt + BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS)
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

  /** Holds the wait while the chat's Stop is in flight; `release` checks again (R9.1). */
  pause = (sessionId: string): (() => void) => {
    this.paused.add(sessionId)
    return () => {
      this.paused.delete(sessionId)
      void this.tick()
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
  tick = (): Promise<void> => this.triggers.tick()

  private forget(sessionId: string): void {
    this.pending.delete(sessionId)
    this.triggers.forget(sessionId)
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
      // A pinned wait ends only once its switch lands or cannot (R8.2).
      if ((verdict === 'fire' || verdict === 'fallback') && pending?.target === 'pin') {
        pending.notices ||= notices
        return { verdict, notices: pending.notices, pinned: pending }
      }
      if (verdict !== 'wait') {
        const ending =
          verdict === 'expire' ? 'expired' : verdict === 'turnFailed' ? verdict : undefined
        this.end(sessionId, ending, ending && (await this.deps.readCut(sessionId))?.turnItemId)
      }
      return { verdict, notices }
    })
    if (decided.pinned) {
      await this.switchThenContinue(sessionId, decided.pinned, decided.notices)
    } else if (decided.verdict === 'fire' || decided.verdict === 'fallback') {
      await this.continueOn(sessionId, decided.notices)
    }
  }

  /** The pinned chat's switch now that nothing is owed, then the continue on the fence it left. */
  private async switchThenContinue(sessionId: string, pending: Pending, notices: string) {
    const record = this.deps.store().getRecord(sessionId)
    const fence = this.deps.store().getConversation(sessionId)?.currentFence
    const { accountId } = pending
    if (!record || fence === undefined || accountId === undefined) {
      return
    }
    const at = this.deps.now()
    const outcome = await brzaSwitchPin({
      sessionId,
      accountId,
      fence: record.lease.runtimeFence,
      at,
      switchAccount: this.deps.switchAccount
    })
    if (outcome === 'wait') {
      pending.retryAt = at + BRZA_PIN_SWITCH_RETRY_MS
      this.triggers.at(sessionId, pending.retryAt)
      return
    }
    const cut = outcome === 'unavailable' ? await this.deps.readCut(sessionId) : null
    const current = await this.deps.serialize(sessionId, async () => {
      const same = this.pending.get(sessionId) === pending
      if (same) {
        const ending = outcome === 'unavailable' ? 'accountUnavailable' : undefined
        this.end(sessionId, ending, cut?.turnItemId)
      }
      return same
    })
    if (current && outcome === 'switched') {
      await this.continueOn(sessionId, notices, fence)
    }
  }

  private async verdict(sessionId: string, pending: Pending): Promise<Verdict> {
    const session = this.deps.session(sessionId)
    const record = this.deps.store().getRecord(sessionId)
    // Closed, moved to another host, or evicted: nothing is left to continue here.
    if (!session || !record || record.location.executionHostId !== this.deps.store().hostId) {
      return 'drop'
    }
    // Read when used: the reads before it wait, and the clock moves on meanwhile.
    if (this.paused.has(sessionId)) {
      return 'wait'
    }
    const expired = () => this.deps.now() - pending.armedAt >= BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS
    if (pending.target === 'pin') {
      // The composer moved the pin since; a switch that keeps waiting runs out as the work does.
      if (brzaPinOf(record) !== pending.pinAtArm) {
        return 'cancel'
      }
      if (expired()) {
        return 'expire'
      }
      if (pending.retryAt !== undefined && this.deps.now() < pending.retryAt) {
        return 'wait'
      }
    } else {
      // Pinned since (P36): the chat no longer follows the selection.
      if (record.accountSwitch) {
        return 'cancel'
      }
      const selected = await this.selectedHome(sessionId)
      const home = session.child?.accountHome
      if (home && selected && agentSessionAccountHomesEqual(home, selected)) {
        return 'cancel'
      }
    }
    if (!session.child || !(await this.owesWork(sessionId))) {
      if (await this.deps.readCut(sessionId)) {
        return 'fire'
      }
      return brzaWithoutCut({
        reads: session.journal.reads,
        wait: pending,
        now: this.deps.now(),
        recheckAt: (when) => this.triggers.at(sessionId, when)
      })
    }
    if (expired()) {
      return 'expire'
    }
    return (await this.wakeUpOverdue(sessionId, pending)) ? 'fallback' : 'wait'
  }

  /** Until the wake-up is overdue, a deadline checks again when its grace runs out. */
  private async wakeUpOverdue(sessionId: string, pending: Pending): Promise<boolean> {
    const due = await brzaWakeUpDue(this.retained(sessionId))
    if (due === null || this.deps.now() >= due) {
      return due !== null
    }
    if (pending.fallbackAt !== due) {
      pending.fallbackAt = due
      this.triggers.at(sessionId, due)
    }
    return false
  }

  private continueOn(
    sessionId: string,
    notices: string,
    fence = this.deps.store().getConversation(sessionId)?.currentFence
  ): Promise<void> {
    return sendBrzaContinue(this.deps, { sessionId, notices, fence })
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
      (await this.owesWork(sessionId))
    )
  }

  private owesWork = (sessionId: string) =>
    structuredAgentSessionChildOwesWork(this.retained(sessionId))

  private async selectedHome(sessionId: string) {
    const record = this.deps.store().getRecord(sessionId)
    const read = this.deps.launchAccountHome()
    return record && read ? await read(record).catch(() => null) : null
  }

  private retained = (sessionId: string): BrzaRetainedWork => this.deps.retainedWork(sessionId)
  private childWork = (sessionId: string) => this.retained(sessionId).childWork()

  /** Expired keeps the status, so the row says the wait ran out until the person dismisses it; it
   *  moves to the newest cut, the row it shows on, so no later cut's row says it. */
  private end(sessionId: string, ending?: BrzaContinueAfterWorkEnding, cutItemId?: string): void {
    const session = this.deps.session(sessionId)
    const status = session && statuses.get(session)
    this.forget(sessionId)
    if (session && status) {
      if (ending) {
        const reason = ending === 'expired' ? {} : { reason: ending }
        const turnItemId = cutItemId ?? status.turnItemId
        statuses.set(session, { ...status, turnItemId, expired: true, ...reason })
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
