import type { AgentSessionAccountPin } from './agent-session-account-switch'

/** Why a chat cannot be forked at a message: the provider cannot fork, the row is not one of its
 *  messages, or its transcript has not saved the message yet. */
export type AgentSessionMessageForkReason = 'unsupported' | 'invalid-target' | 'not-saved'

export type AgentSessionMessageForkResult =
  | {
      ok: true
      providerSessionId: string
      /** The account the source chat is pinned to; the copy lives in its folder, so the fork opens there. */
      accountSwitch?: AgentSessionAccountPin
    }
  | { ok: false; reason: AgentSessionMessageForkReason }
