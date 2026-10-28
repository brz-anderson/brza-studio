import type { AgentChatPermissionChoice } from '../../shared/agent-chat-permission-mode'
import { writeAcpSessionOption } from './acp-session-option-write'
import { isAcpReadySession, type AcpStructuredChild } from './acp-structured-child'
import {
  ACP_OPTION_WRITE_TIMEOUT_MS,
  type AcpStructuredSessionAdapterDeps
} from './acp-structured-session-adapter-deps'

export type AcpModeInput = {
  sessionId: string
  mode: AgentChatPermissionChoice
  signal?: AbortSignal
}

// Agents with a mode option switch live; restart only while the agent reports another mode.
export function acpModeNeedsRestart(
  session: AcpStructuredChild | undefined,
  mode: AgentChatPermissionChoice
): boolean | undefined {
  const values = session?.spec.permissionModeConfig?.values
  if (!isAcpReadySession(session) || !values || mode === 'own') {
    return undefined
  }
  // Without a reported mode, compare the launch mode so restarts cannot loop.
  const reported = session.options.reportedPermissionMode(values)
  return reported === null ? undefined : reported !== mode
}

/** Write the mode to the live agent; true once it reports the requested mode. */
export async function applyAcpMode(
  session: AcpStructuredChild | undefined,
  input: AcpModeInput,
  deps: Pick<AcpStructuredSessionAdapterDeps, 'optionWriteTimeoutMs'>
): Promise<boolean> {
  const values = session?.spec.permissionModeConfig?.values
  const value = input.mode === 'own' ? undefined : values?.[input.mode]
  if (!isAcpReadySession(session) || !values || !value) {
    return false
  }
  await writeAcpSessionOption(
    session.connection,
    session.options,
    { method: 'config', configId: session.options.modeConfigId(), value },
    {
      key: 'permissionMode',
      value,
      agent: session.spec.agent,
      timeoutMs: deps.optionWriteTimeoutMs ?? ACP_OPTION_WRITE_TIMEOUT_MS,
      ...(input.signal ? { signal: input.signal } : {})
    }
  )
  return session.options.reportedPermissionMode(values) === input.mode
}
