import type { AgentType } from '../../shared/agent-status/contracts/agent-status-types'
import { getVerifiedNativeChatCommands } from '../../shared/native-chat/native-chat-agent-profiles'

/** A prompt that is only a catalog command, like the `/rename <name>` that names a Claude chat, is
 *  session plumbing the new chat already hides, so no card repeats it as a task. */
export function isLocalCommandPrompt(agent: AgentType, text: string): boolean {
  const name = /^\s*\/([^\s/]+)/.exec(text)?.[1]
  return name !== undefined && getVerifiedNativeChatCommands(agent).some((c) => c.name === name)
}
