/** An agent's own `orca agent launch` leaves one card in its chat and opens the new chat with its prompt as that chat's task; nothing else does, and neither gates the launch. */

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createRestTestRig,
  type RestTestRig
} from '../../../../native-chat/agent-session-wire/host/testing/structured-agent-session-rest-test-rig'
import { HOST_TEST_NOW } from '../../../../native-chat/agent-session-wire/host/testing/structured-agent-session-host-test-data'
import { setStructuredAgentSessionHost } from '../../../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import type { RpcContext } from '../../core'
import { DESKTOP_RPC_CALLER, LOCAL_CLI_RPC_CALLER } from '../../rpc-caller-identity'
import {
  methodNamed,
  rpcContext,
  runtimeStub,
  setAgentLaunchRecordStore
} from './agent-launch.test-fixture'

const { AGENT_LAUNCH_METHODS } = await import('./agent-launch')
const AGENT_LAUNCH_REPLAY = methodNamed(AGENT_LAUNCH_METHODS, 'agent.launchReplay')

const CALLER = 'codex_6cba3e14_b1a0_4b36_8f25_96c0dfa39fbb'
const TASK = 'fix the full-output stall'
const AGENT_CLI: Partial<RpcContext> = {
  caller: LOCAL_CLI_RPC_CALLER,
  orchestrationCompatibilityEvidence: { agentSessionId: CALLER }
}

let rig: RestTestRig
let launches = 0

beforeEach(async () => {
  // The launch admits operation ids against the clock; the rig's host reads a fixed one.
  vi.useFakeTimers({ now: HOST_TEST_NOW, toFake: ['Date'] })
  rig = await createRestTestRig({ idleSweep: { intervalMs: 60_000 } })
  setStructuredAgentSessionHost(rig.host)
  setAgentLaunchRecordStore(rig.store)
  // The launching agent's own chat, opened by a person.
  await launch({ sessionId: CALLER }, {})
})

afterEach(async () => {
  setAgentLaunchRecordStore(null)
  setStructuredAgentSessionHost(null)
  await rig.dispose()
  vi.useRealTimers()
})

function launchRuntime(surface: 'chat' | 'terminal') {
  return {
    ...runtimeStub(surface === 'terminal' ? { settings: {}, lineCarriesPrompt: true } : {}),
    waitForTerminal: vi.fn(async () => ({ satisfied: true, status: 'idle' })),
    waitForFreshWorkerComposer: vi.fn(async () => {
      throw new Error('timeout')
    }),
    sendTerminalAgentPrompt: vi.fn(async () => ({
      handle: 'term_1',
      accepted: true,
      bytesWritten: 1
    })),
    resolveStructuredAgentSessionCreateIntent: vi.fn(async (params: { envelope: unknown }) => ({
      envelope: params.envelope,
      location: {
        executionHostId: 'local',
        wslDistro: null,
        workspaceId: 'workspace-1',
        workspaceKind: 'git-worktree'
      },
      provider: 'codex',
      agent: 'codex',
      accountHome: { variable: 'CODEX_HOME', path: '/host/.codex' },
      options: {},
      runtimeKind: 'native'
    })),
    publishStructuredAgentSessionTab: vi.fn(async () => {}),
    orchestrationSenderNames: {
      sender: (address: string) => ({
        party: { address, terminalHandle: null, orcaSessionId: null },
        name: 'Codex'
      })
    }
  }
}

/** What `orca agent launch` sends: a replayable launch under a fresh operation id. */
function launch(
  params: Record<string, unknown>,
  context: Partial<RpcContext> = AGENT_CLI,
  options: { operationId?: string; surface?: 'chat' | 'terminal' } = {}
) {
  const parsed = AGENT_LAUNCH_REPLAY.params.parse({
    agent: 'codex',
    target: { kind: 'existing', worktree: 'id:wt-7' },
    operationId: options.operationId ?? nextOperationId(),
    ...params
  })
  return AGENT_LAUNCH_REPLAY.handler(
    parsed,
    rpcContext(launchRuntime(options.surface ?? 'chat'), context)
  )
}

function nextOperationId(): string {
  launches++
  return `${HOST_TEST_NOW}-${launches.toString(16).padStart(32, '0')}`
}

async function cards() {
  return (await rig.host.journalSnapshot(CALLER)).items.filter(
    (item) => item.body.kind === 'agent-handoff'
  )
}

it('records one card per launch operation, linking the new chat, and none on replay', async () => {
  const append = vi.spyOn(rig.host, 'appendAgentStart')
  const operationId = nextOperationId()
  const create = { kind: 'create-worktree', create: { repo: 'id:repo-1', name: 'task' } }

  const first = await launch(
    { target: create, prompt: { text: TASK, delivery: 'submit' } },
    AGENT_CLI,
    { operationId }
  )
  await vi.waitFor(async () => expect(await cards()).toHaveLength(1))
  const replayed = await launch(
    { target: create, prompt: { text: TASK, delivery: 'submit' } },
    AGENT_CLI,
    { operationId }
  )

  expect(replayed).toEqual(first)
  expect(append).toHaveBeenCalledOnce()
  if (first.outcome.kind !== 'structured') {
    throw new Error('expected the launch to open a chat')
  }
  expect((await cards()).map((card) => card.body)).toEqual([
    {
      kind: 'agent-handoff',
      launchId: operationId,
      agent: expect.objectContaining({
        party: expect.objectContaining({ address: `orca_session_id:${first.outcome.sessionId}` })
      }),
      task: TASK
    }
  ])
})

it('records a card for each handoff, and never re-adds one the user removed, across a restart', async () => {
  await launch({ prompt: { text: TASK, delivery: 'submit' } })
  await launch({ prompt: { text: 'second task', delivery: 'submit' } }, AGENT_CLI, {
    surface: 'terminal'
  })
  await vi.waitFor(async () => expect(await cards()).toHaveLength(2))
  const [removed, kept] = await cards()
  expect(kept.body).toMatchObject({
    task: 'second task',
    agent: { party: { address: 'term_1' } }
  })

  const journal = rig.host.collaboratorsForTests().sessions.get(CALLER)!.journal
  if (removed.body.kind !== 'agent-handoff') {
    throw new Error('expected a handoff card')
  }
  const identity = {
    provider: 'orca' as const,
    clientMessageId: `agent-handoff:${removed.body.launchId}`
  }
  await journal.appendTombstone(identity, {
    fence: rig.store.getConversation(CALLER)!.currentFence
  })
  // Reopened from disk, the kept card reads back and the removed one stays removed.
  const host = await rig.restart()
  const destination = host.captureAgentStartDestination(CALLER)!
  await host.appendAgentStart(destination, removed.body, removed.observedAt + 10)

  expect(await cards()).toEqual([kept])
})

it.each([
  ['no prompt', {}],
  ['a draft', { prompt: { text: TASK, delivery: 'draft' } }],
  ['a blank submit, which the CLI never sends', { prompt: { text: ' \t\n ', delivery: 'submit' } }]
])('records the new agent with no task for %s', async (_label, params) => {
  await launch(params)

  await vi.waitFor(async () =>
    expect((await cards()).map((card) => card.body)).toMatchObject([{ task: '' }])
  )
})

it('leaves the task off the card for a prompt that is only a catalog command', async () => {
  await launch({ prompt: { text: '/rename pln-009', delivery: 'submit' } })

  await vi.waitFor(async () =>
    expect((await cards()).map((card) => card.body)).toMatchObject([{ task: '' }])
  )
})

it.each([
  [
    'a window',
    {
      caller: DESKTOP_RPC_CALLER,
      orchestrationCompatibilityEvidence: AGENT_CLI.orchestrationCompatibilityEvidence
    }
  ],
  ['a CLI outside a chat', { caller: LOCAL_CLI_RPC_CALLER }]
])('records nothing for a launch from %s', async (_label, context) => {
  const append = vi.spyOn(rig.host, 'appendAgentStart')

  await launch({ prompt: { text: TASK, delivery: 'submit' } }, context)

  expect(append).not.toHaveBeenCalled()
  expect(await cards()).toEqual([])
})

it('records nothing when the launch fails, and the failure is the launch’s own', async () => {
  const append = vi.spyOn(rig.host, 'appendAgentStart')

  // A chat naming itself as the new chat is refused before any agent starts.
  await expect(
    launch({ sessionId: CALLER, prompt: { text: TASK, delivery: 'submit' } })
  ).rejects.toThrow('agent_launch_session_already_exists')

  expect(append).not.toHaveBeenCalled()
  expect(await cards()).toEqual([])
})

async function firstMessage(sessionId: string) {
  const items = (await rig.host.journalSnapshot(sessionId)).items
  const message = items.find((item) => item.body.kind === 'message' && item.body.role === 'user')
  if (message?.body.kind !== 'message') {
    throw new Error('expected the new chat to open with a message')
  }
  return message.body
}

async function launchedChat(params: Record<string, unknown>, context?: Partial<RpcContext>) {
  const result = await launch(params, context)
  if (result.outcome.kind !== 'structured') {
    throw new Error('expected the launch to open a chat')
  }
  return result.outcome.sessionId
}

it('opens the new chat with the prompt as the launching chat’s task', async () => {
  const sessionId = await launchedChat({ prompt: { text: TASK, delivery: 'submit' } })

  const body = await firstMessage(sessionId)
  const id = (await rig.host.journalSnapshot(sessionId)).submissions[0].clientMessageId
  expect(body.blocks).toEqual([{ type: 'text', text: TASK }])
  expect(body.from).toMatchObject({
    kind: 'agent',
    senders: [
      {
        party: { address: `orca_session_id:${CALLER}` },
        name: 'Codex',
        relation: 'coordinator'
      }
    ],
    orchestration: { message: 'task', runId: id, taskId: id, dispatchId: id }
  })
})

it.each([
  [
    'a window',
    { prompt: { text: TASK, delivery: 'submit' } },
    {
      caller: DESKTOP_RPC_CALLER,
      orchestrationCompatibilityEvidence: AGENT_CLI.orchestrationCompatibilityEvidence
    }
  ],
  [
    'a CLI outside a chat',
    { prompt: { text: TASK, delivery: 'submit' } },
    { caller: LOCAL_CLI_RPC_CALLER }
  ],
  [
    'a prompt that is only a catalog command',
    { prompt: { text: '/rename pln-009', delivery: 'submit' } },
    AGENT_CLI
  ]
])('opens the new chat with a person’s message for %s', async (_label, params, context) => {
  const body = await firstMessage(await launchedChat(params, context))

  expect(body.from).toBeUndefined()
})
