// Resume automatically: the Continue a usage limit's row offers, sent by the host once the limit
// resets. The host keeps the schedule, so it survives a closed window and a restart.

// Why: a client may call the `agentSession.usageLimitAutoResume*` methods only on a host that has
// them; on an older host the row offers Continue alone.
export const AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_RUNTIME_CAPABILITY =
  'agent-session.usage-limit-auto-resume.v1' as const

// Why: BrzA P79 (pedido 41) — a client schedules by itself only on a host that keeps a Cancel per
// cut, or a remounted row would schedule a cancelled cut again.
export const AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_AUTOMATIC_RUNTIME_CAPABILITY =
  'agent-session.usage-limit-auto-resume-automatic.v1' as const

/** Past the reset, so the provider's own clock has turned over before Continue reaches it. */
export const NATIVE_CHAT_USAGE_LIMIT_AUTO_RESUME_DELAY_MS = 60_000

/** One chat's scheduled Continue, bound to the turn the limit cut, as the host lists it. */
export type NativeChatUsageLimitAutoResume = {
  sessionId: string
  turnItemId: string
  /** Epoch ms. */
  resumeAt: number
}

/** A cut that must not schedule by itself again: cancelled, or its Continue already sent. */
export type NativeChatUsageLimitAutoResumeCut = Pick<
  NativeChatUsageLimitAutoResume,
  'sessionId' | 'turnItemId'
>

export function nativeChatUsageLimitAutoResumeAt(resetsAt: number): number {
  return resetsAt + NATIVE_CHAT_USAGE_LIMIT_AUTO_RESUME_DELAY_MS
}
