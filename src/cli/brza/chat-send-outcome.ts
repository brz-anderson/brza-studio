type SendEnvelope =
  | {
      ok: true
      value:
        | { clientMessageId: string; submission: { dispatchState: string; reason?: string | null } }
        | { clientMessageId: string; queued: { state: string } }
      replayed?: boolean
    }
  | { ok: false; refusal: { code: string; message: string } }

export function chatSendOutcome(result: SendEnvelope) {
  if (!result.ok) {
    const unknown = result.refusal.code === 'agent_session_operation_unknown'
    return {
      delivery: unknown ? ('unknown' as const) : ('refused' as const),
      submission: {
        state: unknown ? ('unknown' as const) : ('refused' as const),
        reason: result.refusal.code
      },
      exitCode: unknown ? 3 : 1
    }
  }
  if ('queued' in result.value) {
    const rejected =
      result.value.queued.state === 'returned' || result.value.queued.state === 'withdrawn'
    return {
      delivery: 'queued' as const,
      submission: {
        state: rejected ? ('rejected' as const) : ('queued' as const),
        reason: rejected ? result.value.queued.state : null
      },
      exitCode: rejected ? 1 : 0
    }
  }
  const state = result.value.submission.dispatchState
  if (state === 'accepted' || state === 'rejected' || state === 'pending' || state === 'unknown') {
    return {
      delivery: 'submitted' as const,
      submission: { state, reason: result.value.submission.reason ?? null },
      exitCode: state === 'accepted' ? 0 : state === 'rejected' ? 1 : 3
    }
  }
  return {
    delivery: 'unknown' as const,
    submission: { state: 'unknown' as const, reason: null },
    exitCode: 3
  }
}
