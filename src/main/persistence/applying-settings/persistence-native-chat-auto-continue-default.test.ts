import { closeTestStores, testState, createStore, writeDataFile } from '../persistence-test-harness'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({
  app: { getPath: () => testState.dir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => Buffer.from(`encrypted:${plaintext}`, 'utf-8'),
    decryptString: (ciphertext: Buffer) => ciphertext.toString('utf-8').slice('encrypted:'.length)
  }
}))
vi.mock('../../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../../telemetry/cohort-classifier', () => ({
  getCohortAtEmit: () => ({ nth_repo_added: 2 })
}))

function writeSettings(settings: Record<string, unknown>): void {
  writeDataFile({
    schemaVersion: 1,
    repos: [],
    worktreeMeta: {},
    settings,
    ui: {},
    githubCache: { pr: {}, issue: {} },
    workspaceSession: {}
  })
}

describe('usage-limit auto-continue default', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
  })

  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('is on for new profiles', async () => {
    const store = await createStore()
    expect(store.getSettings().nativeChatAutoContinueAfterUsageLimit).toBe(true)
  })

  it('is on for a saved profile that has no choice yet', async () => {
    writeSettings({ nativeChatQueueFollowUps: true })
    const store = await createStore()
    expect(store.getSettings().nativeChatAutoContinueAfterUsageLimit).toBe(true)
  })

  it('keeps an explicit off', async () => {
    writeSettings({ nativeChatAutoContinueAfterUsageLimit: false })
    const store = await createStore()
    expect(store.getSettings().nativeChatAutoContinueAfterUsageLimit).toBe(false)
  })
})
