import { afterEach, describe, expect, it, vi } from 'vitest'
import { SendParams } from '../../shared/rpc-contract/structured-agent-session-params'
import { AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY } from '../../shared/agent-session/agent-session-runtime-capabilities'
import { CHAT_HANDLERS } from './chat'

const SESSION = 'codex_8eb631ab_59c5_41e4_8672_01cfe0a6fd5f'

function ok(result: unknown) {
  return { id: 'req', ok: true, result, _meta: { runtimeId: 'runtime-1' } }
}

function historyPage(
  items: unknown[],
  fence: number | undefined = 3,
  pageOverrides: Record<string, unknown> = {}
) {
  return ok({
    ok: true,
    page: {
      sessionId: SESSION,
      epoch: 'e',
      fence,
      direction: 'tail',
      items,
      removedItemIds: [],
      submissions: [],
      ...pageOverrides
    }
  })
}

function fakeClient(
  responses: unknown[],
  capabilities: string[] = [AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY]
) {
  const call = vi.fn()
  for (const response of responses) {
    call.mockResolvedValueOnce(response)
  }
  return {
    call,
    getCliStatus: vi.fn(async () => ({
      result: { runtime: { reachable: true, runtimeId: 'runtime-1', capabilities } }
    }))
  }
}

async function run(
  command: string,
  flags: Record<string, string | boolean>,
  client: unknown,
  json = true
) {
  const logs: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((line: string) => logs.push(line))
  const handler = CHAT_HANDLERS[command]
  if (!handler) {
    throw new Error(`handler ausente: ${command}`)
  }
  try {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake client implements only the calls the chat handlers make.
    await handler({
      flags: new Map(Object.entries(flags)),
      client,
      cwd: '/tmp',
      json
    } as never)
  } finally {
    spy.mockRestore()
  }
  return json ? JSON.parse(logs.join('\n')).result : logs.join('\n')
}

const OPERATION = '1793750400000-3f2a9c0e8b7d4a1f9e6c5b4a3d2e1f00'

function recorded(state: string, replayed = false) {
  return ok({
    ok: true,
    replayed,
    fence: 7,
    cursor: { epoch: 'e', sequence: 1 },
    value: { clientMessageId: 'm-1', submission: { dispatchState: state, reason: null } }
  })
}

function sendParams(client: ReturnType<typeof fakeClient>) {
  const sends = client.call.mock.calls.filter(([method]) => method === 'agentSession.send')
  expect(sends).toHaveLength(1)
  return SendParams.parse(sends[0]?.[1])
}

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = 0
})

describe('chat send — operação P5', () => {
  it.each([
    { capabilities: [] },
    { capabilities: [AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY] }
  ])(
    'replay mantém id e fingerprint com outro fence e trimEnd (capacidades %j)',
    async ({ capabilities }) => {
      const first = fakeClient([historyPage([], 7), recorded('accepted')], capabilities)
      const receipt = await run('chat send', { session: SESSION, text: '  oi \n' }, first)
      expect(receipt.operation).toMatch(/^\d{13}-[0-9a-f]{32}$/)
      const replay = fakeClient([historyPage([], 9), recorded('accepted', true)], capabilities)
      expect(
        await run(
          'chat send',
          {
            session: SESSION,
            text: '  oi',
            operation: receipt.operation
          },
          replay
        )
      ).toMatchObject({
        operation: receipt.operation,
        replayed: true,
        submission: { state: 'accepted' }
      })
      const initial = sendParams(first)
      const retried = sendParams(replay)
      expect(initial.envelope.expectedRuntimeFence).toBe(7)
      expect(retried.envelope.expectedRuntimeFence).toBe(9)
      expect(retried.envelope.clientOperationId).toBe(initial.envelope.clientOperationId)
      expect(retried.envelope.payloadFingerprint).toBe(initial.envelope.payloadFingerprint)
      expect(retried.delivery).toBe(capabilities.length ? 'queue-if-active' : undefined)
      expect(retried.body.blocks).toEqual([{ type: 'text', text: '  oi' }])
      expect(process.exitCode).toBe(0)
    }
  )

  it.each([
    ['accepted', 0],
    ['rejected', 1],
    ['unknown', 3]
  ] as const)('replay usa o estado gravado %s, com uma mutação', async (state, exitCode) => {
    const client = fakeClient([historyPage([], 9), recorded(state, true)])
    expect(
      await run('chat send', { session: SESSION, text: 'oi', operation: OPERATION }, client)
    ).toMatchObject({ operation: OPERATION, replayed: true, submission: { state } })
    expect(sendParams(client).envelope.clientOperationId).toBe(OPERATION)
    expect(process.exitCode).toBe(exitCode)
  })

  it.each(['inválido', '', true, `${OPERATION}\n`])(
    'recusa operação malformada %j antes de acessar o host',
    async (operation) => {
      const client = fakeClient([historyPage([]), recorded('accepted')])
      await expect(
        run('chat send', { session: SESSION, text: 'oi', operation }, client)
      ).rejects.toMatchObject({ code: 'invalid_argument' })
      expect(client.getCliStatus).not.toHaveBeenCalled()
      expect(client.call).not.toHaveBeenCalled()
    }
  )

  it.each(['texto', 'delivery'])(
    'alterar %s muda fingerprint e preserva operationIdReused como refused/1',
    async (change) => {
      const first = fakeClient([historyPage([]), recorded('accepted')])
      await run('chat send', { session: SESSION, text: 'oi', operation: OPERATION }, first)
      const refusal = {
        code: 'agent_session_operation_conflict',
        message: 'Operation reused',
        details: { reason: 'operationIdReused' }
      }
      const replay = fakeClient(
        [historyPage([], 9), ok({ ok: false, refusal })],
        change === 'delivery' ? [] : [AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY]
      )
      expect(
        await run(
          'chat send',
          {
            session: SESSION,
            text: change === 'texto' ? 'outro' : 'oi',
            operation: OPERATION
          },
          replay
        )
      ).toMatchObject({
        operation: OPERATION,
        delivery: 'refused',
        submission: { state: 'refused' },
        refusal
      })
      const initial = sendParams(first)
      const retried = sendParams(replay)
      expect(retried.envelope.clientOperationId).toBe(OPERATION)
      expect(retried.envelope.payloadFingerprint).not.toBe(initial.envelope.payloadFingerprint)
      expect(process.exitCode).toBe(1)
    }
  )

  it('unknown continua unknown/3 em ambas as tentativas do mesmo id', async () => {
    const params: ReturnType<typeof sendParams>[] = []
    for (const fence of [7, 9]) {
      const client = fakeClient([
        historyPage([], fence),
        ok({
          ok: false,
          refusal: { code: 'agent_session_operation_unknown', message: 'Unknown outcome' }
        })
      ])
      expect(
        await run('chat send', { session: SESSION, text: 'oi', operation: OPERATION }, client)
      ).toMatchObject({
        operation: OPERATION,
        delivery: 'unknown',
        submission: { state: 'unknown' }
      })
      params.push(sendParams(client))
      expect(process.exitCode).toBe(3)
    }
    expect(params[0]?.envelope.clientOperationId).toBe(OPERATION)
    expect(params[1]?.envelope.clientOperationId).toBe(OPERATION)
    expect(params[0]?.envelope.payloadFingerprint).toBe(params[1]?.envelope.payloadFingerprint)
  })
})
