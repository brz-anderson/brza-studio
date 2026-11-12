import { describe, expect, it } from 'vitest'
import { OrchestrationRequestEvidence } from '../runtime/orchestration-compatibility-envelope'

const SESSION = '11111111-1111-4111-8111-111111111111'
const LOCAL = { remote: false, mutation: false, requestId: undefined }

function sent(env: NodeJS.ProcessEnv, method: string, request = LOCAL) {
  return new OrchestrationRequestEvidence(env).envelopeFor(method, request)
    .orchestrationCompatibilityEvidence
}

describe('caller chat evidence on a chat-to-chat send', () => {
  it('names the caller chat on the send, and not on its history read', () => {
    const env = { ORCA_AGENT_SESSION_ID: SESSION }
    expect(sent(env, 'agentSession.send')).toEqual({ agentSessionId: SESSION })
    expect(sent(env, 'agentSession.history')).toBeUndefined()
  })

  it('names no chat from a host-stamped (WSL) session', () => {
    const env = {
      ORCA_AGENT_SESSION_ID: SESSION,
      ORCA_ORCHESTRATION_COMPATIBILITY_HOST_KIND: 'wsl',
      ORCA_ORCHESTRATION_COMPATIBILITY_HOST_ID: 'wsl-host',
      ORCA_ORCHESTRATION_COMPATIBILITY_HOST_INCARNATION: 'Ubuntu'
    }
    expect(sent(env, 'agentSession.send')).toBeUndefined()
  })

  it('names no chat to a paired server', () => {
    const env = { ORCA_AGENT_SESSION_ID: SESSION }
    expect(sent(env, 'agentSession.send', { ...LOCAL, remote: true })).toBeUndefined()
  })
})
