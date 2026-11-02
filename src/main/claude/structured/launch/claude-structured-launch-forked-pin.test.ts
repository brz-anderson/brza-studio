import { createClaudeStructuredLaunchResolver } from '../../../runtime/structured-agent-launch-composition.test-support'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { agentSessionRecordFixture } from '../../../../shared/agent-session/lifecycle/agent-session-record.test-fixture'
import { claudeProviderHandle } from '../../../../shared/agent-session/lifecycle/agent-session-provider-handle-encoding'
import { ClaudeProfileRouter } from '../../../claude-accounts/claude-profile-router'
import { installClaudeProfileRouter } from '../../../claude-accounts/claude-profile-installed-router'

const roots: string[] = []
afterEach(() => {
  installClaudeProfileRouter(undefined)
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

async function launchPinnedFork() {
  const root = mkdtempSync(join(tmpdir(), 'claude-fork-pin-'))
  roots.push(root)
  mkdirSync(join(root, 'claude-profiles', 'a', 'home'), { recursive: true })
  writeFileSync(join(root, 'claude-profiles', 'a', 'profile.json'), '{}')
  installClaudeProfileRouter(
    new ClaudeProfileRouter({
      getSettings: () => ({
        claudeManagedAccounts: [],
        activeClaudeManagedAccountId: 'a',
        activeClaudeManagedAccountIdsByRuntime: undefined,
        agentStatusHooksEnabled: false,
        disabledTuiAgents: []
      }),
      dataRoot: root,
      userHome: join(root, 'personal'),
      env: {}
    })
  )
  // An adopted fork: the id of the copy, no resume cursor, its transcript in System default only.
  const handle = claudeProviderHandle('forked-under-system', null)
  const systemHome = join(root, 'personal', '.claude')
  const record = {
    ...agentSessionRecordFixture(),
    providerHandleChain: [
      { linkId: 'link-1', origin: 'adopted' as const, mintedAtFence: 1, observedAt: 1, handle }
    ],
    accountHome: { variable: 'CLAUDE_CONFIG_DIR' as const, path: systemHome },
    accountSwitch: {
      accountId: null,
      account: 'System default',
      operationId: 'op-1',
      callerKey: 'client-1',
      switchedAt: 1
    }
  }
  const resolve = createClaudeStructuredLaunchResolver({
    store: { getRecord: () => record, pinLaunchDirectory: vi.fn() },
    resolveLaunchArgs: () => [],
    resolveWorkspacePath: async (id) => `/repos/${id}`,
    resolveCommand: () => ({ command: '/usr/local/bin/claude', prefixArgs: [] }),
    resolveInheritedEnv: async () => ({ PATH: '/usr/bin' }),
    resolveAuthPolicy: () => ({ account: 'system' }),
    hasTranscript: async ({ claudeConfigDir }) => claudeConfigDir === systemHome
  })
  const launched = await resolve({
    identity: {
      sessionId: record.sessionId,
      workspaceId: 'workspace-1',
      hostId: 'local',
      agent: 'claude' as const,
      providerHandle: handle
    }
  })
  return { launched, systemHome }
}

it('resumes a fork pinned to the account that holds its transcript, whatever the selection', async () => {
  const { launched, systemHome } = await launchPinnedFork()
  expect(launched.claudeConfigDir).toBe(systemHome)
  expect(launched.resumesTranscript).toBe(true)
  expect(launched.options).toMatchObject({ resume: 'forked-under-system' })
})
