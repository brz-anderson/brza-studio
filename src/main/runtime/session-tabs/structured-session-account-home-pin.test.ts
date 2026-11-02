import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { ClaudeProfileRouter } from '../../claude-accounts/claude-profile-router'
import { installClaudeProfileRouter } from '../../claude-accounts/claude-profile-installed-router'
import { agentSessionRecordFixture } from '../../../shared/agent-session/lifecycle/agent-session-record.test-fixture'
import { OrcaRuntimeWithStructuredSessionAccountHome } from './structured-session-account-home'

vi.mock('./structured-session-cli-writer-host', () => ({
  OrcaRuntimeWithStructuredSessionCliWriterHost: class {}
}))
vi.mock('../../orca-profiles/profile-storage-paths', async () => {
  const { tmpdir } = await import('node:os')
  return { getProfileUserDataPath: () => tmpdir() }
})
const roots: string[] = []
afterEach(() => {
  installClaudeProfileRouter(undefined)
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

// BrzA P36: the replace-before-send check (#30955) reads this home, so a chat switched in place
// must read its pinned account, not the selection, or every send would restart its agent.
it('names the account a chat was switched to, not the selected one', async () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-account-pin-'))
  roots.push(root)
  const settings = {
    claudeManagedAccounts: [
      { id: 'a', email: 'a@example.com' },
      { id: 'b', email: 'b@example.com' }
    ],
    activeClaudeManagedAccountId: 'a',
    activeClaudeManagedAccountIdsByRuntime: undefined,
    agentStatusHooksEnabled: false,
    disabledTuiAgents: []
  }
  const router = new ClaudeProfileRouter({
    getSettings: () => settings as never,
    dataRoot: root,
    userHome: join(root, 'personal'),
    env: {},
    runSetup: vi.fn()
  })
  installClaudeProfileRouter(router)
  const runtime: OrcaRuntimeWithStructuredSessionAccountHome = Object.assign(
    Object.create(OrcaRuntimeWithStructuredSessionAccountHome.prototype),
    {
      accounts: { getClaudeConfigDirectory: () => router.systemDefaultHome() },
      requireStore: () => ({ getSettings: () => settings }),
      structuredAgentLaunchEnv: () => ({})
    }
  )
  const pin = (accountId: string | null) => ({
    ...agentSessionRecordFixture(),
    accountSwitch: { accountId, account: 'x', operationId: 'op', callerKey: 'c', switchedAt: 1 }
  })
  const pinned = { variable: 'CLAUDE_CONFIG_DIR', path: router.accountHome('b') }
  await expect(
    runtime.resolveStructuredAgentLaunchAccountHome(pin('b'), 'identity')
  ).resolves.toEqual(pinned)
  // A read refuses a pin whose folder is gone, as the launch does, instead of naming the selection.
  await expect(runtime.resolveStructuredAgentLaunchAccountHome(pin('b'))).rejects.toBeDefined()
  mkdirSync(pinned.path, { recursive: true })
  await expect(runtime.resolveStructuredAgentLaunchAccountHome(pin('b'))).resolves.toEqual(pinned)
  // System default pinned: its own home, not the selected account's.
  await expect(runtime.resolveStructuredAgentLaunchAccountHome(pin(null))).resolves.toEqual({
    variable: 'CLAUDE_CONFIG_DIR',
    path: router.systemDefaultHome()
  })
  // No pin: the selection, as before.
  await expect(
    runtime.resolveStructuredAgentLaunchAccountHome(agentSessionRecordFixture(), 'identity')
  ).resolves.toEqual({ variable: 'CLAUDE_CONFIG_DIR', path: router.accountHome('a') })
})
