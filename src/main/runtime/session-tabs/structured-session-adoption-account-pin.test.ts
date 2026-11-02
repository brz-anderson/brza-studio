import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ClaudeManagedAccount } from '../../../shared/managed-account-types'
import { installClaudeProfileRouter } from '../../claude-accounts/claude-profile-installed-router'
import { createClaudeProfileReport } from '../../claude-accounts/claude-profile-report'
import { ClaudeProfileRouter } from '../../claude-accounts/claude-profile-router'
import { resolveStructuredAdoptionAccountPin } from './structured-session-adoption-account-pin'

const NOW = 1_800_000_000_000
const roots: string[] = []

afterEach(() => {
  installClaudeProfileRouter(undefined)
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

function installAccountB(): void {
  const root = mkdtempSync(join(tmpdir(), 'adoption-account-pin-'))
  roots.push(root)
  mkdirSync(join(root, 'claude-profiles', 'b', 'home'), { recursive: true })
  writeFileSync(join(root, 'claude-profiles', 'b', 'profile.json'), '{}')
  writeFileSync(
    join(root, 'claude-profiles', 'b', 'home', '.claude.json'),
    JSON.stringify({ oauthAccount: { emailAddress: 'b@example.com' } })
  )
  const account: ClaudeManagedAccount = {
    id: 'b',
    email: 'b@example.com',
    managedAuthPath: '/managed/b',
    authMethod: 'subscription-oauth',
    createdAt: NOW,
    updatedAt: NOW,
    lastAuthenticatedAt: NOW
  }
  installClaudeProfileRouter(
    new ClaudeProfileRouter({
      getSettings: () => ({
        claudeManagedAccounts: [account],
        activeClaudeManagedAccountId: null,
        activeClaudeManagedAccountIdsByRuntime: undefined,
        agentStatusHooksEnabled: false,
        disabledTuiAgents: []
      }),
      dataRoot: root,
      userHome: join(root, 'personal'),
      env: {},
      runSetup: async () => ({ ...createClaudeProfileReport(), outcome: 'prepared' })
    })
  )
}

describe('the account an adopted fork is pinned to', () => {
  it('names the account and its login', async () => {
    installAccountB()
    await expect(
      resolveStructuredAdoptionAccountPin('claude', {
        providerSessionId: 'forked',
        accountSwitch: { accountId: 'b' }
      })
    ).resolves.toEqual({ accountId: 'b', account: 'b@example.com' })
  })

  it('refuses the create when the account was removed, rather than opening the chat blank', async () => {
    installAccountB()
    await expect(
      resolveStructuredAdoptionAccountPin('claude', {
        providerSessionId: 'forked',
        accountSwitch: { accountId: 'removed' }
      })
    ).rejects.toMatchObject({
      refusal: {
        code: 'agent_session_operation_invalid',
        details: { reason: 'claudeAccountFolderMissing' }
      }
    })
  })

  it('pins nothing for a resume that carries no pin', async () => {
    installAccountB()
    await expect(
      resolveStructuredAdoptionAccountPin('claude', { providerSessionId: 'resumed' })
    ).resolves.toBeUndefined()
  })
})
