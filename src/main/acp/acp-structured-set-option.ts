import type { StructuredAgentSessionSetOptionInput as SetOptionInput } from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import { AgentSessionOptionRejectedError } from '../native-chat/agent-session-wire/structured-agent-session-option-error'
import { writeAcpSessionOption } from './acp-session-option-write'
import {
  ACP_OPTION_WRITE_TIMEOUT_MS,
  type AcpStructuredSessionAdapterDeps
} from './acp-structured-session-adapter-deps'
import type { AcpStructuredChildren } from './acp-structured-child-lifecycle'
import type { AcpStructuredSession } from './acp-structured-session'

/** Split out of the adapter, which is at its line limit. */
export async function setAcpStructuredOption(
  session: AcpStructuredSession,
  input: SetOptionInput,
  deps: Pick<AcpStructuredSessionAdapterDeps, 'optionWriteTimeoutMs'>,
  children: Pick<AcpStructuredChildren, 'connectionLost'>
) {
  const write = session.options.write(input.key, input.value)
  if (!write) {
    throw new AgentSessionOptionRejectedError(
      `${session.spec.agent} offers no session option named ${input.key}`
    )
  }
  session.options.notePick(input.key)
  // Bound option writes so they cannot hold the session queue indefinitely.
  await writeAcpSessionOption(session.connection, session.options, write, {
    key: input.key,
    value: input.value,
    agent: session.spec.agent,
    timeoutMs: deps.optionWriteTimeoutMs ?? ACP_OPTION_WRITE_TIMEOUT_MS,
    ...(input.signal ? { signal: input.signal } : {}),
    onUncertain: (error) => children.connectionLost(session, error)
  })
  return session.options.reported()
}
