import { describe, expect, it, vi } from 'vitest'
import { agentSessionRecordFixture } from '../agent-session-record-test-fixture'
import type { StructuredAgentSessionAdapter } from '../agent-session-wire/providers/structured-agent-session-adapter'
import { claudeAndCodexAgents } from '../agent-session-wire/providers/testing/structured-agent-session-adapter-router-test-support'
import { BrzaStructuredAgentSessionAdapterRouter } from './brza-structured-agent-session-adapter-router'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the router calls only the methods a case sets; every other member stays unused.
const NO_METHODS = {} as StructuredAgentSessionAdapter

type Fake = {
  adapter: StructuredAgentSessionAdapter
  applyPermissionMode: ReturnType<
    typeof vi.fn<NonNullable<StructuredAgentSessionAdapter['applyPermissionMode']>>
  >
  prepareAccountSwitch: ReturnType<
    typeof vi.fn<NonNullable<StructuredAgentSessionAdapter['prepareAccountSwitch']>>
  >
  forkThroughMessage: ReturnType<
    typeof vi.fn<NonNullable<StructuredAgentSessionAdapter['forkThroughMessage']>>
  >
}

function fakeAdapter(label: string): Fake {
  const applyPermissionMode = vi.fn<
    NonNullable<StructuredAgentSessionAdapter['applyPermissionMode']>
  >(async () => true)
  const prepareAccountSwitch = vi.fn<
    NonNullable<StructuredAgentSessionAdapter['prepareAccountSwitch']>
  >(async () => ({
    ok: true,
    accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: `/homes/${label}` },
    account: label
  }))
  const forkThroughMessage = vi.fn<
    NonNullable<StructuredAgentSessionAdapter['forkThroughMessage']>
  >(async () => ({ ok: true, providerSessionId: `fork-${label}` }))
  const adapter: StructuredAgentSessionAdapter = {
    ...NO_METHODS,
    acquire: async (input) => ({
      process: {
        hostId: 'local',
        pid: 1,
        processStartTimeMs: null,
        spawnToken: input.spawnToken
      },
      acquisitionGeneration: `generation-${label}`
    }),
    applyPermissionMode,
    prepareAccountSwitch,
    forkThroughMessage
  }
  return { adapter, applyPermissionMode, prepareAccountSwitch, forkThroughMessage }
}

function setup() {
  const claude = fakeAdapter('claude')
  const codex = fakeAdapter('codex')
  const router = new BrzaStructuredAgentSessionAdapterRouter(
    claudeAndCodexAgents({ claude: claude.adapter, codex: codex.adapter }),
    async () => undefined
  )
  return { claude, codex, router }
}

describe('BrzaStructuredAgentSessionAdapterRouter', () => {
  it('routes the mid-chat permission mode to the live owner only', async () => {
    const { claude, codex, router } = setup()
    expect(await router.applyPermissionMode({ sessionId: 'chat-1', mode: 'ask' })).toBe(false)

    await router.acquire({
      identity: {
        sessionId: 'chat-1',
        workspaceId: 'workspace-1',
        hostId: 'local',
        agent: 'codex',
        providerHandle: null
      },
      fence: 1,
      spawnToken: 'token'
    })
    expect(await router.applyPermissionMode({ sessionId: 'chat-1', mode: 'ask' })).toBe(true)

    expect(codex.applyPermissionMode).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'chat-1',
      mode: 'ask'
    })
    expect(claude.applyPermissionMode).not.toHaveBeenCalled()
  })

  it('routes an account switch by the record agent while the chat is at rest', async () => {
    const { claude, codex, router } = setup()
    const record = agentSessionRecordFixture({ sessionId: 'chat-2', provider: 'claude' })

    expect(await router.prepareAccountSwitch({ record, accountId: 'acct-1' })).toEqual({
      ok: true,
      accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/homes/claude' },
      account: 'claude'
    })
    expect(claude.prepareAccountSwitch).toHaveBeenCalledExactlyOnceWith({
      record,
      accountId: 'acct-1'
    })
    expect(codex.prepareAccountSwitch).not.toHaveBeenCalled()
  })

  it('refuses an account switch and a fork for an agent the registry does not know', async () => {
    const { claude, codex, router } = setup()
    const record = agentSessionRecordFixture({ sessionId: 'chat-3', provider: 'unknown-agent' })

    expect(await router.prepareAccountSwitch({ record, accountId: null })).toEqual({
      ok: false,
      reason: 'unknown-account'
    })
    expect(
      await router.forkThroughMessage({ record, message: { sessionId: 'p', uuid: 'u' } })
    ).toEqual({ ok: false, reason: 'unsupported' })
    for (const fake of [claude, codex]) {
      expect(fake.prepareAccountSwitch).not.toHaveBeenCalled()
      expect(fake.forkThroughMessage).not.toHaveBeenCalled()
    }
  })

  it('routes the fork through a message by the record agent', async () => {
    const { claude, codex, router } = setup()
    const record = agentSessionRecordFixture({ sessionId: 'chat-4', provider: 'codex' })
    const message = { sessionId: 'provider-session', uuid: 'message-uuid' }

    expect(await router.forkThroughMessage({ record, message })).toEqual({
      ok: true,
      providerSessionId: 'fork-codex'
    })
    expect(codex.forkThroughMessage).toHaveBeenCalledExactlyOnceWith({ record, message })
    expect(claude.forkThroughMessage).not.toHaveBeenCalled()
  })
})
