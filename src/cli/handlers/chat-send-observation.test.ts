import { afterEach, describe, expect, it, vi } from 'vitest'
import { RuntimeClientError, RuntimeRpcFailureError } from '../runtime-client'
import { CHAT_HANDLERS } from './chat'
import { AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY } from '../../shared/agent-session/agent-session-runtime-capabilities'
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

describe('chat send R20 — transporte após envio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    process.exitCode = 0
  })
  function submission(dispatchState: string, clientMessageId = 'm-1') {
    return {
      clientMessageId,
      dispatchState,
      reason: null,
      fence: 7,
      payloadFingerprint: 'fp',
      providerItemId: null,
      submittedAt: 1,
      resolvedAt: null
    }
  }

  function sent(dispatchState: string) {
    return ok({
      ok: true,
      replayed: false,
      fence: 7,
      cursor: { epoch: 'e', sequence: 1 },
      value: { clientMessageId: 'm-1', submission: submission(dispatchState) }
    })
  }

  it.each(['runtime_unavailable', 'remote_runtime_unavailable'] as const)(
    'R20 pending recupera transporte transitório %s sem reenviar',
    async (code) => {
      vi.useFakeTimers()
      const client = fakeClient([historyPage([], 7), sent('pending')])
      client.call.mockRejectedValueOnce(new RuntimeClientError(code, 'offline'))
      client.call.mockResolvedValueOnce(
        historyPage([], 7, { submissions: [submission('accepted')] })
      )
      const observed = run('chat send', { session: SESSION, text: 'hi' }, client).then(
        (result) => ({ result }),
        (error) => ({ error })
      )
      await vi.advanceTimersByTimeAsync(1000)
      expect(await observed).toMatchObject({
        result: { submission: { state: 'accepted', reason: null } }
      })
      expect(
        client.call.mock.calls.filter(([method]) => method === 'agentSession.send')
      ).toHaveLength(1)
      expect(process.exitCode).toBe(0)
    }
  )

  it('R20 pending persistente preserva operation e último erro no teto original', async () => {
    vi.useFakeTimers()
    const client = fakeClient([historyPage([], 7), sent('pending')])
    client.call.mockRejectedValue(new RuntimeClientError('runtime_timeout', 'último timeout'))
    const observed = run('chat send', { session: SESSION, text: 'hi' }, client).then(
      (result) => ({ result }),
      (error) => ({ error })
    )
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await observed).toMatchObject({
      result: {
        delivery: 'submitted',
        submission: { state: 'pending', reason: 'último timeout' },
        operation: client.call.mock.calls[1]?.[1].envelope.clientOperationId
      }
    })
    expect(client.call).toHaveBeenCalledTimes(62)
    expect(process.exitCode).toBe(3)
  })

  it('R20 limita chamada lenta ao orçamento restante usando timeout do client', async () => {
    vi.useFakeTimers()
    const client = fakeClient([historyPage([], 7), sent('pending')])
    client.call.mockImplementation(
      (_method, _params, options) =>
        new Promise((_resolve, reject) => {
          setTimeout(
            () => reject(new RuntimeClientError('runtime_timeout', 'slow timeout')),
            options?.timeoutMs ?? 60_000
          )
        })
    )
    let completed = false
    const observed = run('chat send', { session: SESSION, text: 'hi' }, client).then(
      (result) => {
        completed = true
        return { result }
      },
      (error) => ({ error })
    )
    await vi.advanceTimersByTimeAsync(29_999)
    expect(completed).toBe(false)
    expect(client.call.mock.calls[2]?.[2]).toEqual({ timeoutMs: 29_500 })
    await vi.advanceTimersByTimeAsync(1)
    expect(await observed).toMatchObject({
      result: { submission: { state: 'pending', reason: 'slow timeout' } }
    })
    expect(process.exitCode).toBe(3)
    expect(client.call).toHaveBeenCalledTimes(3)
  })

  it.each([
    new TypeError('programming error'),
    new RuntimeClientError('invalid_runtime_response', 'bad frame'),
    new RuntimeRpcFailureError({
      id: 'rpc',
      ok: false,
      error: { code: 'runtime_timeout', message: 'RPC refusal' }
    })
  ])('R20 relança erro não transporte no pending: %s', async (error) => {
    vi.useFakeTimers()
    const client = fakeClient([historyPage([], 7), sent('pending')])
    client.call.mockRejectedValueOnce(error)
    const assertion = expect(
      run('chat send', { session: SESSION, text: 'hi' }, client)
    ).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(500)
    await assertion
  })

  it.each(['waiting', 'dispatched', 'returned', 'withdrawn'] as const)(
    'R20 queued %s preserva recibo sem metadados quando transporte falha',
    async (state) => {
      const client = fakeClient([
        historyPage([], 7),
        ok({
          ok: true,
          replayed: state !== 'waiting',
          fence: 7,
          cursor: { epoch: 'e', sequence: 1 },
          value: { clientMessageId: 'm-1', queued: { messageId: 'q1', position: 2, state } }
        })
      ])
      client.call.mockRejectedValueOnce(new RuntimeClientError('runtime_access_denied', 'denied'))
      const result = await run('chat send', { session: SESSION, text: 'hi' }, client)
      const rejected = state === 'returned' || state === 'withdrawn'
      expect(result).toMatchObject({
        delivery: 'queued',
        submission: { state: rejected ? 'rejected' : 'queued' },
        queuePosition: 2,
        queueMetadataUnavailable: true
      })
      for (const field of ['held_by', 'nextQueuedMessageId', 'queuePaused']) {
        expect(result).not.toHaveProperty(field)
      }
      expect(process.exitCode).toBe(rejected ? 1 : 0)
      expect(client.call).toHaveBeenCalledTimes(3)
    }
  )
  it.each([
    new TypeError('bug'),
    new RuntimeRpcFailureError({
      id: 'rpc',
      ok: false,
      error: { code: 'runtime_unavailable', message: 'RPC failure' }
    })
  ])('R20 queued relança erro não transporte: %s', async (error) => {
    const client = fakeClient([
      historyPage([], 7),
      ok({
        ok: true,
        replayed: false,
        fence: 7,
        cursor: { epoch: 'e', sequence: 1 },
        value: {
          clientMessageId: 'm-1',
          queued: { messageId: 'q1', position: 2, state: 'waiting' }
        }
      })
    ])
    client.call.mockRejectedValueOnce(error)
    await expect(run('chat send', { session: SESSION, text: 'hi' }, client)).rejects.toBe(error)
    expect(client.call).toHaveBeenCalledTimes(3)
  })
})
