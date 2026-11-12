import { afterEach, describe, expect, it, vi } from 'vitest'
import { SendParams } from '../../shared/rpc-contract/structured-agent-session-params'
import { AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY } from '../../shared/agent-session/agent-session-runtime-capabilities'
import { parseChatSessionSelector } from '../chat-sessions'
import { RuntimeClientError } from '../runtime-client'
import { CHAT_HANDLERS } from './chat'

const SESSION = 'codex_8eb631ab_59c5_41e4_8672_01cfe0a6fd5f'
const HANDLE = `structured-agent-session-${SESSION}`

function ok(result: unknown) {
  return { id: 'req', ok: true, result, _meta: { runtimeId: 'runtime-1' } }
}

function agentRow(paneKey: string, overrides: Record<string, unknown> = {}) {
  return {
    paneKey,
    parentPaneKey: null,
    state: 'working',
    agentType: 'codex',
    prompt: '',
    taskTitle: null,
    displayName: 'Fix tests',
    lastAssistantMessage: 'Running the suite.',
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: 1,
    updatedAt: 2,
    ...overrides
  }
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

function item(body: unknown) {
  return { itemId: 'i', revision: 1, sequence: 1, observedAt: 1, body }
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

afterEach(() => {
  vi.restoreAllMocks()
  // Why: a leaked 0 breaks the neighbour tests in this worker that expect it unset.
  process.exitCode = undefined
})

describe('parseChatSessionSelector', () => {
  it('accepts a session id, a handle, or a pane key', () => {
    expect(parseChatSessionSelector(SESSION)).toBe(SESSION)
    expect(parseChatSessionSelector(HANDLE)).toBe(SESSION)
    expect(parseChatSessionSelector(`${HANDLE}:leaf-1`)).toBe(SESSION)
    expect(() => parseChatSessionSelector('structured-agent-session-')).toThrow(RuntimeClientError)
  })
})

describe('chat list', () => {
  it('lists top-level chats and leaves terminal agents and subagents out', async () => {
    const client = fakeClient([
      ok({
        worktrees: [
          {
            worktreeId: 'repo::/w',
            displayName: 'paper',
            agents: [
              agentRow(`${HANDLE}:leaf`),
              agentRow(`${HANDLE}:sub`, { parentPaneKey: `${HANDLE}:leaf` }),
              agentRow('tab-1:pane-1', { state: 'done' })
            ]
          }
        ]
      })
    ])
    const result = await run('chat list', {}, client)
    expect(result.chats).toEqual([
      expect.objectContaining({
        session: SESSION,
        handle: HANDLE,
        worktree: 'paper',
        state: 'working',
        title: 'Fix tests',
        lastAssistantMessage: 'Running the suite.'
      })
    ])
  })

  it('keeps only chats in the requested state', async () => {
    const client = fakeClient([
      ok({
        worktrees: [
          {
            worktreeId: 'repo::/w',
            displayName: 'paper',
            agents: [agentRow(`${HANDLE}:leaf`, { state: 'done' })]
          }
        ]
      })
    ])
    expect((await run('chat list', { state: 'working' }, client)).chats).toEqual([])
  })
})

describe('chat read', () => {
  it('returns item identity and a live cursor for a tail read', async () => {
    const client = fakeClient([
      historyPage(
        [
          {
            ...item({ kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'hi' }] }),
            itemId: 'item-1',
            revision: 2,
            sequence: 8
          }
        ],
        3,
        { liveCursor: { epoch: 'e', sequence: 9 } }
      )
    ])
    const result = await run('chat read', { session: SESSION }, client)
    expect(result.entries).toEqual([
      { kind: 'message', role: 'assistant', text: 'hi', itemId: 'item-1', revision: 2, sequence: 8 }
    ])
    expect(result.nextCursor).toBe('e:9')
    expect(result.hasNewer).toBe(false)
  })

  it('keeps the first tail live cursor while paging backward', async () => {
    const client = fakeClient([
      historyPage([item({ kind: 'status', text: 'working' })], 3, {
        window: {
          oldest: { epoch: 'e', sequence: 8 },
          newest: { epoch: 'e', sequence: 9 }
        },
        liveCursor: { epoch: 'e', sequence: 10 },
        hasOlder: true
      }),
      historyPage(
        [
          item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'older' }] }),
          item({ kind: 'status', text: 'still working' })
        ],
        3,
        {
          direction: 'before',
          window: {
            oldest: { epoch: 'e', sequence: 6 },
            newest: { epoch: 'e', sequence: 7 }
          },
          liveCursor: { epoch: 'e', sequence: 11 },
          hasOlder: false
        }
      )
    ])

    const result = await run('chat read', { session: SESSION, limit: '1' }, client)

    expect(result.entries).toMatchObject([{ text: 'older' }])
    expect(result.nextCursor).toBe('e:10')
  })

  it('falls back to the first tail window when its live cursor is absent', async () => {
    const client = fakeClient([
      historyPage([item({ kind: 'status', text: 'working' })], 3, {
        window: {
          oldest: { epoch: 'e', sequence: 8 },
          newest: { epoch: 'e', sequence: 9 }
        },
        hasOlder: true
      }),
      historyPage(
        [
          item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'older' }] }),
          item({ kind: 'status', text: 'still working' })
        ],
        3,
        {
          direction: 'before',
          window: {
            oldest: { epoch: 'e', sequence: 6 },
            newest: { epoch: 'e', sequence: 7 }
          },
          liveCursor: { epoch: 'e', sequence: 11 },
          hasOlder: false
        }
      )
    ])

    const result = await run('chat read', { session: SESSION, limit: '1' }, client)

    expect(result.entries).toMatchObject([{ text: 'older' }])
    expect(result.nextCursor).toBe('e:9')
  })

  it('reads one after page with a cursor and returns its cursor, newer flag and removed ids', async () => {
    const client = fakeClient([
      historyPage(
        [
          {
            ...item({
              kind: 'message',
              role: 'assistant',
              blocks: [{ type: 'text', text: 'new' }]
            }),
            itemId: 'item-2',
            revision: 1,
            sequence: 10
          }
        ],
        3,
        {
          direction: 'after',
          window: {
            oldest: null,
            newest: { epoch: 'e', sequence: 10 },
            nextCursor: { epoch: 'e', sequence: 10 }
          },
          liveCursor: { epoch: 'e', sequence: 12 },
          hasNewer: true,
          removedItemIds: ['gone']
        }
      )
    ])
    const result = await run('chat read', { session: SESSION, cursor: 'e:9' }, client)
    expect(client.call).toHaveBeenCalledWith('agentSession.history', {
      sessionId: SESSION,
      direction: 'after',
      cursor: { epoch: 'e', sequence: 9 },
      limit: 200
    })
    expect(result).toMatchObject({ nextCursor: 'e:10', hasNewer: true, removedItemIds: ['gone'] })
  })

  it('passes a colon-containing epoch to the after request', async () => {
    const client = fakeClient([
      historyPage([], 3, {
        direction: 'after',
        window: { oldest: null, newest: null, nextCursor: { epoch: 'a:b', sequence: 7 } }
      })
    ])

    await run('chat read', { session: SESSION, cursor: 'a:b:7' }, client)

    expect(client.call).toHaveBeenCalledWith('agentSession.history', {
      sessionId: SESSION,
      direction: 'after',
      cursor: { epoch: 'a:b', sequence: 7 },
      limit: 200
    })
  })

  it.each([
    'epoch_changed',
    'cursor_ahead',
    'cursor_compacted',
    'journal_gap',
    'schema_unreadable'
  ])('reports reset %s and reads the tail', async (reason) => {
    process.exitCode = 0
    const client = fakeClient([
      ok({
        ok: false,
        reset: reason,
        page: {
          sessionId: SESSION,
          epoch: 'fresh',
          fence: 4,
          direction: 'tail',
          items: [
            {
              ...item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'fresh' }] }),
              itemId: 'fresh-1',
              revision: 1,
              sequence: 1
            }
          ],
          removedItemIds: [],
          submissions: [],
          liveCursor: { epoch: 'fresh', sequence: 2 },
          hasOlder: false
        }
      })
    ])
    const result = await run('chat read', { session: SESSION, cursor: 'old:9' }, client)
    expect(result).toMatchObject({
      cursor_reset: reason,
      entries: [{ text: 'fresh' }],
      nextCursor: 'fresh:2',
      hasNewer: false
    })
    expect(process.exitCode).toBe(2)
    process.exitCode = 0
  })

  it.each(['abc', 'e:-1', ':3'])(
    'rejects malformed cursor %s before calling the host',
    async (cursor) => {
      const client = fakeClient([])
      await expect(run('chat read', { session: SESSION, cursor }, client)).rejects.toMatchObject({
        code: 'invalid_argument'
      })
      expect(client.call).not.toHaveBeenCalled()
    }
  )

  it('rejects a cursor combined with limit', async () => {
    const client = fakeClient([])
    await expect(
      run('chat read', { session: SESSION, cursor: 'e:1', limit: '3' }, client)
    ).rejects.toMatchObject({ code: 'invalid_argument' })
    expect(client.call).not.toHaveBeenCalled()
  })

  it('accepts a repeated compacted reset and exits 2 each time', async () => {
    const reset = ok({
      ok: false,
      reset: 'cursor_compacted',
      page: {
        sessionId: SESSION,
        epoch: 'fresh',
        fence: 4,
        direction: 'tail',
        items: [
          {
            ...item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'fresh' }] }),
            itemId: 'fresh-1',
            revision: 1,
            sequence: 2
          }
        ],
        removedItemIds: [],
        submissions: [],
        window: {
          oldest: null,
          newest: { epoch: 'fresh', sequence: 2 },
          nextCursor: { epoch: 'fresh', sequence: 2 }
        },
        liveCursor: { epoch: 'fresh', sequence: 3 },
        hasOlder: false,
        hasNewer: false
      }
    })
    const client = fakeClient([reset, reset])
    for (let index = 0; index < 2; index += 1) {
      process.exitCode = 0
      const result = await run('chat read', { session: SESSION, cursor: 'old:8' }, client)
      expect(result).toMatchObject({
        cursor_reset: 'cursor_compacted',
        entries: [{ text: 'fresh', itemId: 'fresh-1', sequence: 2 }],
        nextCursor: 'fresh:3'
      })
      expect(process.exitCode).toBe(2)
    }
    process.exitCode = 0
  })

  it('returns messages, tools and waiting prompts, without provider status frames', async () => {
    const client = fakeClient([
      historyPage([
        item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Run tests' }] }),
        item({ kind: 'tool-call', name: 'shell', input: {}, state: 'completed' }),
        item({ kind: 'status', text: 'codex · notification' }),
        item({
          kind: 'approval',
          title: 'Allow git push?',
          detail: null,
          options: [],
          resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null }
        }),
        item({
          kind: 'message',
          role: 'assistant',
          blocks: [{ type: 'text', text: '2 failures.' }]
        })
      ])
    ])
    const result = await run('chat read', { session: HANDLE, limit: '4' }, client)
    expect(client.call).toHaveBeenCalledWith('agentSession.history', {
      sessionId: SESSION,
      direction: 'tail',
      limit: 16
    })
    expect(result.entries).toEqual([
      { kind: 'message', role: 'user', text: 'Run tests', itemId: 'i', revision: 1, sequence: 1 },
      { kind: 'tool', name: 'shell', state: 'completed', itemId: 'i', revision: 1, sequence: 1 },
      {
        kind: 'approval',
        text: 'Allow git push?',
        pending: true,
        itemId: 'i',
        revision: 1,
        sequence: 1
      },
      {
        kind: 'message',
        role: 'assistant',
        text: '2 failures.',
        itemId: 'i',
        revision: 1,
        sequence: 1
      }
    ])
  })

  it('shows the requested number of entries, the newest ones', async () => {
    const client = fakeClient([
      historyPage([
        item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'first' }] }),
        item({ kind: 'status', text: 'frame' }),
        item({ kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'second' }] }),
        item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'third' }] })
      ])
    ])
    const result = await run('chat read', { session: SESSION, limit: '2' }, client)
    expect(result.entries.map((entry: { text: string }) => entry.text)).toEqual(['second', 'third'])
  })

  it('pages backward when status frames leave the requested limit unfilled', async () => {
    const client = fakeClient([
      historyPage([item({ kind: 'status', text: 'frame' })], 3, {
        window: { oldest: { epoch: 'e', sequence: 9 } },
        hasOlder: true
      }),
      historyPage(
        [
          item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'first' }] }),
          item({ kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'second' }] })
        ],
        3,
        { window: { oldest: { epoch: 'e', sequence: 1 } }, hasOlder: false }
      )
    ])
    const result = await run('chat read', { session: SESSION, limit: '2' }, client)
    expect(client.call).toHaveBeenNthCalledWith(2, 'agentSession.history', {
      sessionId: SESSION,
      direction: 'before',
      cursor: { epoch: 'e', sequence: 9 },
      limit: 200
    })
    expect(result.entries.map((entry: { text: string }) => entry.text)).toEqual(['first', 'second'])
  })

  it('replaces the window with a reset page instead of mixing it into older rows', async () => {
    const client = fakeClient([
      historyPage([item({ kind: 'status', text: 'frame' })], 3, {
        window: { oldest: { epoch: 'e', sequence: 9 } },
        hasOlder: true
      }),
      ok({
        ok: false,
        reset: 'journal-truncated',
        page: {
          sessionId: SESSION,
          epoch: 'e2',
          fence: 4,
          direction: 'tail',
          items: [
            item({ kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'fresh' }] })
          ],
          removedItemIds: [],
          submissions: [],
          window: { oldest: { epoch: 'e2', sequence: 1 } },
          hasOlder: false
        }
      })
    ])
    const result = await run('chat read', { session: SESSION, limit: '2' }, client)
    expect(client.call).toHaveBeenNthCalledWith(2, 'agentSession.history', {
      sessionId: SESSION,
      direction: 'before',
      cursor: { epoch: 'e', sequence: 9 },
      limit: 200
    })
    expect(result.entries.map((entry: { text: string }) => entry.text)).toEqual(['fresh'])
  })
})

describe('chat send', () => {
  it('sends a host-valid message fenced to the chat it read, queued while the agent works', async () => {
    const client = fakeClient([
      historyPage([], 7),
      ok({
        ok: true,
        replayed: false,
        fence: 7,
        cursor: { epoch: 'e', sequence: 2 },
        value: {
          clientMessageId: 'm-1',
          queued: { messageId: 'q-1', position: 1, state: 'waiting' }
        }
      }),
      historyPage([], 7, { actionablePromptIds: ['p1'], nextQueuedMessageId: 'q-2' })
    ])
    const result = await run('chat send', { session: SESSION, text: 'Run the tests' }, client)
    const params = client.call.mock.calls[1]![1]
    expect(client.call.mock.calls[1]![0]).toBe('agentSession.send')
    // The host validates the same schema, so a malformed envelope or body fails here.
    expect(SendParams.safeParse(params).success).toBe(true)
    expect(params).toMatchObject({
      envelope: { sessionId: SESSION, expectedRuntimeFence: 7 },
      delivery: 'queue-if-active',
      body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Run the tests' }] }
    })
    expect(result).toEqual({
      session: SESSION,
      operation: expect.any(String),
      replayed: false,
      delivery: 'queued',
      submission: { state: 'queued', reason: null },
      clientMessageId: 'm-1',
      queuePosition: 1,
      nextQueuedMessageId: 'q-2',
      held_by: 'question'
    })
  })

  it('sends without the queue field to a host that has no message queue', async () => {
    const client = fakeClient(
      [
        historyPage([], 2),
        ok({
          ok: true,
          replayed: false,
          fence: 2,
          cursor: { epoch: 'e', sequence: 1 },
          value: {
            clientMessageId: 'm-2',
            submission: { clientMessageId: 'm-2', dispatchState: 'accepted', reason: null }
          }
        })
      ],
      []
    )
    const result = await run('chat send', { session: SESSION, text: 'hi' }, client)
    expect(client.call.mock.calls[1]![1]).not.toHaveProperty('delivery')
    expect(result.delivery).toBe('submitted')
  })

  it('reports a host refusal as a result with exit code 1', async () => {
    const client = fakeClient([
      historyPage([], 2),
      ok({
        ok: false,
        refusal: { code: 'agent_session_fence_mismatch', message: 'The chat restarted.' }
      })
    ])
    expect(await run('chat send', { session: SESSION, text: 'hi' }, client)).toMatchObject({
      delivery: 'refused',
      submission: { state: 'refused' },
      refusal: { code: 'agent_session_fence_mismatch' }
    })
    expect(process.exitCode).toBe(1)
  })

  it('refuses empty text before contacting the host', async () => {
    const client = fakeClient([])
    await expect(run('chat send', { session: SESSION, text: '  ' }, client)).rejects.toMatchObject({
      code: 'invalid_argument'
    })
    expect(client.call).not.toHaveBeenCalled()
  })
})

describe('chat send — contrato P4', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
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

  it.each([
    ['accepted', 0],
    ['rejected', 1],
    ['unknown', 3]
  ] as const)('imprime %s e sai %i', async (state, exitCode) => {
    const client = fakeClient([historyPage([], 7), sent(state)])
    expect(await run('chat send', { session: SESSION, text: 'hi' }, client)).toMatchObject({
      delivery: 'submitted',
      submission: { state },
      operation: expect.any(String)
    })
    expect(process.exitCode).toBe(exitCode)
  })

  it.each([
    ['question', { actionablePromptIds: ['p1'] }, 'question', false],
    ['working', { actionablePromptIds: [], working: true }, 'working', false],
    ['precedência de question', { actionablePromptIds: ['p1'], working: true }, 'question', false],
    [
      'pausa',
      { queuePause: { reason: 'stopped' }, actionablePromptIds: ['p1'], working: true },
      null,
      true
    ],
    ['fila escoada', { queuedMessages: [], actionablePromptIds: [], working: false }, null, false]
  ] as const)('queued: %s', async (_name, page, heldBy, paused) => {
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
      }),
      historyPage([], 7, { ...page, nextQueuedMessageId: 'q2' })
    ])
    const result = await run('chat send', { session: SESSION, text: 'hi' }, client)
    expect(result).toMatchObject({
      delivery: 'queued',
      submission: { state: 'queued' },
      queuePosition: 2,
      nextQueuedMessageId: 'q2',
      held_by: heldBy
    })
    expect(result.queuePaused === true).toBe(paused)
    expect(client.call).toHaveBeenNthCalledWith(3, 'agentSession.history', {
      sessionId: SESSION,
      direction: 'tail',
      limit: 1
    })
    expect(process.exitCode).toBe(0)
  })

  it.each(['returned', 'withdrawn'] as const)('replay %s sai rejected/1', async (state) => {
    const client = fakeClient([
      historyPage([], 7),
      ok({
        ok: true,
        replayed: true,
        fence: 7,
        cursor: { epoch: 'e', sequence: 1 },
        value: { clientMessageId: 'm-1', queued: { messageId: 'q1', position: 1, state } }
      }),
      historyPage([])
    ])
    expect(await run('chat send', { session: SESSION, text: 'hi' }, client)).toMatchObject({
      delivery: 'queued',
      replayed: true,
      submission: { state: 'rejected' }
    })
    expect(process.exitCode).toBe(1)
  })

  it.each([
    ['agent_session_fence_mismatch', 'refused', 1],
    ['agent_session_operation_unknown', 'unknown', 3]
  ] as const)('recusa %s imprime resultado e sai %i', async (code, state, exitCode) => {
    const client = fakeClient([
      historyPage([]),
      ok({ ok: false, refusal: { code, message: 'reason' } })
    ])
    expect(await run('chat send', { session: SESSION, text: 'hi' }, client)).toMatchObject({
      delivery: state,
      submission: { state },
      refusal: { code }
    })
    expect(process.exitCode).toBe(exitCode)
  })

  it('runtime_timeout preserva operation e sai unknown/3', async () => {
    const client = fakeClient([historyPage([])])
    client.call.mockRejectedValueOnce(new RuntimeClientError('runtime_timeout', 'Timed out'))
    const result = await run('chat send', { session: SESSION, text: 'hi' }, client)
    expect(result).toMatchObject({
      delivery: 'unknown',
      submission: { state: 'unknown' },
      clientMessageId: null
    })
    expect(result.operation).toBe(client.call.mock.calls[1]?.[1].envelope.clientOperationId)
    expect(process.exitCode).toBe(3)
  })

  it('runtime_timeout imprime retry completo com argumentos literais seguros', async () => {
    const client = fakeClient([historyPage([])])
    client.call.mockRejectedValueOnce(new RuntimeClientError('runtime_timeout', 'Timed out'))
    const text = "don't $(touch /tmp/unsafe); echo `whoami`"
    const output = await run('chat send', { session: SESSION, text }, client, false)
    const operation = client.call.mock.calls[1]?.[1].envelope.clientOperationId
    const quotedText =
      process.platform === 'win32'
        ? "'don''t $(touch /tmp/unsafe); echo `whoami`'"
        : "'don'\"'\"'t $(touch /tmp/unsafe); echo `whoami`'"
    expect(output).toBe(
      `retry without resending: orca chat send --session '${SESSION}' --text ${quotedText} --operation '${operation}'`
    )
    expect(process.exitCode).toBe(3)
  })

  it('preserva corpo de pessoa e fence do tail com origem no ambiente', async () => {
    vi.stubEnv('ORCA_AGENT_SESSION_ID', SESSION)
    const client = fakeClient([historyPage([], 42), sent('accepted')])
    await run('chat send', { session: SESSION, text: 'hi' }, client)
    expect(client.call).toHaveBeenNthCalledWith(
      2,
      'agentSession.send',
      expect.objectContaining({
        envelope: expect.objectContaining({ expectedRuntimeFence: 42 }),
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'hi' }] }
      })
    )
  })

  it.each(['accepted', 'rejected', 'unknown'] as const)(
    'pending resolve em %s pelo tail após 500ms',
    async (state) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
      const client = fakeClient([
        historyPage([], 7),
        sent('pending'),
        historyPage([], 7, { submissions: [submission('accepted', 'outro')] }),
        historyPage([], 7, { submissions: [submission(state)] })
      ])
      const promise = run('chat send', { session: SESSION, text: 'hi' }, client)
      await vi.advanceTimersByTimeAsync(499)
      expect(client.call).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(client.call).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(500)
      expect(await promise).toMatchObject({ delivery: 'submitted', submission: { state } })
      expect(process.exitCode).toBe(state === 'accepted' ? 0 : state === 'rejected' ? 1 : 3)
      expect(client.call).toHaveBeenNthCalledWith(
        4,
        'agentSession.history',
        {
          sessionId: SESSION,
          direction: 'tail',
          limit: 1
        },
        { timeoutMs: 29_000 }
      )
    }
  )

  it('pending mantém espera até 30s, polling 500ms e sai 3 no teto', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
    const client = fakeClient([historyPage([], 7), sent('pending')])
    client.call.mockResolvedValue(historyPage([], 7, { submissions: [submission('pending')] }))
    const promise = run('chat send', { session: SESSION, text: 'hi' }, client)
    let completed = false
    void promise.then(() => {
      completed = true
    })
    await vi.advanceTimersByTimeAsync(29_999)
    expect(completed).toBe(false)
    expect(client.call).toHaveBeenCalledTimes(61)
    await vi.advanceTimersByTimeAsync(1)
    expect(await promise).toMatchObject({ delivery: 'submitted', submission: { state: 'pending' } })
    expect(client.call).toHaveBeenCalledTimes(62)
    expect(
      client.call.mock.calls
        .slice(2)
        .every(
          ([method, params]) =>
            method === 'agentSession.history' && params.direction === 'tail' && params.limit === 1
        )
    ).toBe(true)
    expect(process.exitCode).toBe(3)
    await vi.advanceTimersByTimeAsync(500)
    expect(client.call).toHaveBeenCalledTimes(62)
  })
})
