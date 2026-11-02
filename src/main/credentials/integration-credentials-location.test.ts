import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type * as Os from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let home = ''
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
  vi.doMock('node:os', async () => {
    const actual = await vi.importActual<typeof Os>('node:os')
    return { ...actual, homedir: () => home }
  })
  const { setSecretStore } = await import('../../shared/secret-store')
  setSecretStore({
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString('utf-8'),
    describeProtectionGap: () => null
  })
  return {
    jira: await import('../jira/site-credential-store'),
    linearPaths: await import('../linear/linear-credential-paths'),
    linearTokens: await import('../linear/linear-token-store'),
    linearRegistry: await import('../linear/linear-workspace-registry'),
    bitbucket: await import('../bitbucket/credential-store'),
    speech: await import('../speech/openai-api-key-store'),
    minimaxCookie: await import('../minimax/minimax-cookie-store'),
    minimaxKey: await import('../minimax/minimax-api-key-store'),
    openCodeGo: await import('../opencode/opencode-go-api-key-store'),
    zcode: await import('../zcode/zcode-plan-api-key-store')
  }
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'brza-credentials-location-'))
  seedOrcaFiles()
})

afterEach(() => {
  vi.doUnmock('node:os')
  vi.resetModules()
  rmSync(home, { recursive: true, force: true })
})

describe('integration credentials live in the BrzA folder, apart from Orca', () => {
  it('reads nothing from the files Orca left in ~/.orca', async () => {
    const stores = await loadStores()
    expect(stores.jira.getSiteFile().sites).toEqual([])
    expect(stores.jira.hasStoredToken('site')).toBe(false)
    expect(stores.linearRegistry.hasStoredToken()).toBe(false)
    expect(stores.bitbucket.hasStoredBitbucketCredential()).toBe(false)
    expect(stores.speech.hasOpenAiSpeechApiKey()).toBe(false)
    expect(stores.minimaxCookie.hasMiniMaxSessionCookie()).toBe(false)
    expect(stores.minimaxKey.hasMiniMaxApiKey()).toBe(false)
    expect(stores.openCodeGo.hasOpenCodeGoApiKey()).toBe(false)
    expect(stores.zcode.hasZcodePlanApiKey()).toBe(false)
  })

  it('saves and clears every store under ~/.brza and leaves ~/.orca byte for byte', async () => {
    const before = snapshotTree(join(home, '.orca'))
    const stores = await loadStores()

    stores.jira.saveToken('mine', 'jira-token')
    stores.jira.writeSiteFile({
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
    stores.linearTokens.saveWorkspaceToken('mine', 'linear-key')
    stores.bitbucket.saveBitbucketCredential({
      authMode: 'token',
      email: 'brza@example.com',
      baseUrl: null,
      account: 'brza',
      accessToken: null,
      apiToken: 'bitbucket-token'
    })
    stores.speech.saveOpenAiSpeechApiKey('sk-speech')
    stores.minimaxCookie.saveMiniMaxSessionCookie('cookie')
    stores.minimaxKey.saveMiniMaxApiKey('minimax-key')
    stores.openCodeGo.saveOpenCodeGoApiKey('go-key')
    stores.zcode.saveZcodePlanApiKey('zcode-key')

    expect(stores.jira.readToken('mine')).toBe('jira-token')
    expect(stores.speech.readOpenAiSpeechApiKey()).toBe('sk-speech')
    expect(stores.zcode.readZcodePlanApiKey()).toBe('zcode-key')
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

    stores.jira.deleteToken('mine')
    stores.linearTokens.clearToken('mine')
    stores.bitbucket.clearStoredBitbucketCredential()
    stores.speech.clearOpenAiSpeechApiKey()
    stores.minimaxCookie.clearMiniMaxSessionCookie()
    stores.minimaxKey.clearMiniMaxApiKey()
    stores.openCodeGo.clearOpenCodeGoApiKey()
    stores.zcode.clearZcodePlanApiKey()

    expect(snapshotTree(join(home, '.orca'))).toEqual(before)
  })
})
