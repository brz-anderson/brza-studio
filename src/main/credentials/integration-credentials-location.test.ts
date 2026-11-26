import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type * as Os from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let home = ''
// Hoisted and applied to every import, so the stores read the temp home through the mocked homedir.
vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof Os>()),
  homedir: () => home
}))
const ORCA_DECOY = 'decoy-sealed-by-the-orca-app'

function snapshotTree(root: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
      } else {
        out[path.slice(root.length)] = readFileSync(path, 'utf8')
      }
    }
  }
  walk(root)
  return out
}

// The files an Orca install leaves in ~/.orca; BrzA must neither read nor delete them.
function seedOrcaFiles(): void {
  const orca = join(home, '.orca')
  mkdirSync(join(orca, 'jira-tokens'), { recursive: true })
  mkdirSync(join(orca, 'linear-tokens'), { recursive: true })
  const jiraSite = {
    id: 'site',
    siteUrl: 'https://orca.atlassian.net',
    email: 'orca@example.com',
    displayName: 'Orca',
    accountId: 'account'
  }
  const siteId = Buffer.from('site').toString('base64url')
  const files: Record<string, string> = {
    'jira-sites.json': JSON.stringify({
      version: 1,
      activeSiteId: 'site',
      selectedSiteId: 'site',
      sites: [jiraSite]
    }),
    [`jira-tokens/${siteId}.enc`]: ORCA_DECOY,
    'linear-token.enc': ORCA_DECOY,
    [`linear-tokens/${siteId}.enc`]: ORCA_DECOY,
    'bitbucket-credential.enc': ORCA_DECOY,
    'openai-speech-token.enc': ORCA_DECOY,
    'minimax-session-cookie.enc': ORCA_DECOY,
    'minimax-api-key.enc': ORCA_DECOY,
    'opencode-go-api-key.enc': ORCA_DECOY,
    'zcode-plan-api-key.enc': ORCA_DECOY
  }
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(orca, name), text)
  }
}

async function loadStores() {
  vi.resetModules()
  const { setSecretStore } = await import('../../shared/secure-storage/secret-store')
  setSecretStore({
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString('utf-8'),
    describeProtectionGap: () => null
  })
  return {
    jira: await import('../jira/site-credential-store'),
    linearPaths: await import('../linear/accounts/linear-credential-paths'),
    linearTokens: await import('../linear/accounts/linear-token-store'),
    linearRegistry: await import('../linear/accounts/linear-workspace-registry'),
    bitbucket: await import('../bitbucket/credential-store'),
    speech: await import('../speech/openai-api-key-store'),
    minimaxCookie: await import('../minimax/minimax-cookie-store'),
    minimaxKey: await import('../minimax/minimax-api-key-store'),
    openCodeGo: await import('../opencode/accounts/opencode-go-api-key-store'),
    zcode: await import('../zcode/zcode-plan-api-key-store')
  }
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'brza-credentials-location-'))
  seedOrcaFiles()
})

afterEach(() => {
  vi.resetModules()
  rmSync(home, { recursive: true, force: true })
})

describe('integration credentials live in the BrzA folder, apart from Orca', () => {
  it('reads nothing from the files Orca left in ~/.orca', async () => {
    const stores = await loadStores()
    expect((await stores.jira.getSiteFile()).sites).toEqual([])
    expect(await stores.jira.hasStoredToken('site')).toBe(false)
    expect(await stores.linearRegistry.hasStoredToken()).toBe(false)
    expect(await stores.bitbucket.hasStoredBitbucketCredential()).toBe(false)
    expect(await stores.speech.hasOpenAiSpeechApiKey()).toBe(false)
    expect(await stores.minimaxCookie.hasMiniMaxSessionCookie()).toBe(false)
    expect(await stores.minimaxKey.hasMiniMaxApiKey()).toBe(false)
    expect(await stores.openCodeGo.hasOpenCodeGoApiKey()).toBe(false)
    expect(await stores.zcode.hasZcodePlanApiKey()).toBe(false)
  })

  it('saves and clears every store under ~/.brza and leaves ~/.orca byte for byte', async () => {
    const before = snapshotTree(join(home, '.orca'))
    const stores = await loadStores()

    await stores.jira.saveToken('mine', 'jira-token')
    await stores.jira.writeSiteFile({
      version: 1,
      activeSiteId: 'mine',
      selectedSiteId: 'mine',
      sites: [
        {
          id: 'mine',
          siteUrl: 'https://brza.atlassian.net',
          email: 'brza@example.com',
          displayName: 'BrzA',
          accountId: 'account',
          authType: 'cloud'
        }
      ]
    })
    await stores.linearTokens.saveWorkspaceToken('mine', 'linear-key')
    await stores.bitbucket.saveBitbucketCredential({
      authMode: 'token',
      email: 'brza@example.com',
      baseUrl: null,
      account: 'brza',
      accessToken: null,
      apiToken: 'bitbucket-token'
    })
    await stores.speech.saveOpenAiSpeechApiKey('sk-speech')
    await stores.minimaxCookie.saveMiniMaxSessionCookie('cookie')
    await stores.minimaxKey.saveMiniMaxApiKey('minimax-key')
    await stores.openCodeGo.saveOpenCodeGoApiKey('go-key')
    await stores.zcode.saveZcodePlanApiKey('zcode-key')

    expect(await stores.jira.readToken('mine')).toBe('jira-token')
    expect(await stores.speech.readOpenAiSpeechApiKey()).toBe('sk-speech')
    expect(await stores.zcode.readZcodePlanApiKey()).toBe('zcode-key')
    expect(Object.keys(snapshotTree(join(home, '.brza'))).sort()).toEqual(
      [
        `/jira-sites.json`,
        `/jira-tokens/${Buffer.from('mine').toString('base64url')}.enc`,
        `/linear-tokens/${Buffer.from('mine').toString('base64url')}.enc`,
        '/bitbucket-credential.enc',
        '/bitbucket-credential.json',
        '/openai-speech-token.enc',
        '/minimax-session-cookie.enc',
        '/minimax-api-key.enc',
        '/opencode-go-api-key.enc',
        '/zcode-plan-api-key.enc'
      ].sort()
    )

    await stores.jira.deleteToken('mine')
    await stores.linearTokens.clearToken('mine')
    await stores.bitbucket.clearStoredBitbucketCredential()
    await stores.speech.clearOpenAiSpeechApiKey()
    await stores.minimaxCookie.clearMiniMaxSessionCookie()
    await stores.minimaxKey.clearMiniMaxApiKey()
    await stores.openCodeGo.clearOpenCodeGoApiKey()
    await stores.zcode.clearZcodePlanApiKey()

    expect(snapshotTree(join(home, '.orca'))).toEqual(before)
  })
})
