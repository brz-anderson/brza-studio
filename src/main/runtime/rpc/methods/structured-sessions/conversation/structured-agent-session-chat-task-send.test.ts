/** A send from one chat's agent to another chat arrives as the coordinator's task; every other send stays a person's message. */

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createQueuedMessageTestRig,
  type QueuedMessageTestRig
} from '../../../../../native-chat/agent-session-wire/host/testing/structured-agent-session-queued-message-rig.test-fixture'
import {
  HOST_TEST_NOW,
  HOST_TEST_SESSION as SESSION,
  hostTestMessage,
  hostTestOperationId
} from '../../../../../native-chat/agent-session-wire/host/testing/structured-agent-session-host-test-data'
import { setStructuredAgentSessionHost } from '../../../../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import {
  AGENT_SESSION_ACCEPTED_SEND_RUNTIME_CAPABILITY,
  STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY
} from '../../../../../../shared/agent-session/agent-session-runtime-capabilities'
import { agentJournalSubmissionKey } from '../../../../../../shared/agent-session/journal/agent-session-journal-item-key'
import { agentSessionMessagePayload } from '../../../../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import type { RpcContext } from '../../../core'
import {
  DESKTOP_RPC_CALLER,
  LOCAL_CLI_RPC_CALLER,
  type RpcCallerIdentity
} from '../../../rpc-caller-identity'
import { sendStructuredAgentSessionForClient } from './structured-agent-session-send-compatibility'

const COORDINATOR_CHAT = 'claude_6cba3e14_b1a0_4b36_8f25_96c0dfa39fbb'
const TASK = 'rode a revisão e me diga o que achou'

let rig: QueuedMessageTestRig

beforeEach(async () => {
  vi.useFakeTimers({ now: HOST_TEST_NOW, toFake: ['Date'] })
  rig = await createQueuedMessageTestRig({ now: () => Date.now() })
  setStructuredAgentSessionHost(rig.host)
})

afterEach(async () => {
  setStructuredAgentSessionHost(null)
  await rig.dispose()
  vi.useRealTimers()
})

function rpcContext(caller: RpcCallerIdentity, agentSessionId?: string): RpcContext {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the send path reads only the sender-name lookup of the runtime.
  return {
    runtime: {
      orchestrationSenderNames: {
        sender: (address: string) => ({
          party: { address, terminalHandle: null, orcaSessionId: null },
          name: 'Coordenadora'
        })
      }
    },
    clientId: 'client-1',
    clientKind: 'runtime',
    clientCapabilities: [
      STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY,
      AGENT_SESSION_ACCEPTED_SEND_RUNTIME_CAPABILITY
    ],
    caller,
    ...(agentSessionId ? { orchestrationCompatibilityEvidence: { agentSessionId } } : {})
  } as unknown as RpcContext
}

async function send(context: RpcContext, delivery?: 'queue-if-active') {
  const body = hostTestMessage(TASK)
  const id = hostTestOperationId()
  const fields = { body: agentSessionMessagePayload(body), ...(delivery ? { delivery } : {}) }
  const result = await sendStructuredAgentSessionForClient(
    {
      body,
      ...(delivery ? { delivery } : {}),
      envelope: rig.envelope(fields, 'agentSession.send', id)
    },
    context
  )
  expect(result).toMatchObject({ ok: true })
  return id
}

function journal() {
  const stored = rig.host.collaboratorsForTests().sessions.get(SESSION)?.journal
  if (!stored) {
    throw new Error('the rig opens its session')
  }
  return stored
}

function sentBody(id: string) {
  const body = journal().itemBody(agentJournalSubmissionKey(id))
  if (body?.kind !== 'message') {
    throw new Error('expected the sent message')
  }
  return body
}

it('shows a send from another chat as that chat’s task, with its text untouched', async () => {
  const id = await send(rpcContext(LOCAL_CLI_RPC_CALLER, COORDINATOR_CHAT))

  expect(sentBody(id)).toEqual({
    ...hostTestMessage(TASK),
    from: {
      kind: 'agent',
      senders: [
        {
          party: {
            address: `orca_session_id:${COORDINATOR_CHAT}`,
            terminalHandle: null,
            orcaSessionId: null
          },
          name: 'Coordenadora',
          relation: 'coordinator'
        }
      ],
      orchestration: { message: 'task', runId: id, taskId: id, dispatchId: id }
    }
  })
})

it('holds a send to a busy chat as the same task, not as a person’s draft', async () => {
  await rig.workingSend()

  const id = await send(rpcContext(LOCAL_CLI_RPC_CALLER, COORDINATOR_CHAT), 'queue-if-active')

  const [card] = journal().queuedMessages.list()
  expect(card.messageId).toBe(id)
  expect(card.body.from).toMatchObject({ orchestration: { message: 'task', runId: id } })
})

it.each([
  ['a chat sending to itself', LOCAL_CLI_RPC_CALLER, SESSION],
  ['a CLI outside a chat', LOCAL_CLI_RPC_CALLER, undefined],
  ['a window', DESKTOP_RPC_CALLER, COORDINATOR_CHAT],
  ['a paired device', { kind: 'paired-device', deviceId: 'device-1' } as const, COORDINATOR_CHAT]
])('leaves a send from %s as a person’s message', async (_label, caller, agentSessionId) => {
  const id = await send(rpcContext(caller, agentSessionId))

  expect(sentBody(id)).toEqual(hostTestMessage(TASK))
})
