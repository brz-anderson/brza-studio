import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from '../desktop/electron-fixtures/orca-app'
import { expect, type Page } from '@stablyai/playwright-test'
import {
  activateGoldenWorktree,
  cleanupGoldenWorktree,
  createGoldenWorktree
} from './golden-source-control'
import { waitForSessionReady } from '../desktop/renderer-probes/store'

const README_PATH = 'README.md'

// Why: BrzA Studio opens an existing Markdown file in the read-only preview (D20), so the
// journey picks the rich editor itself, as the editor's own view toggle does.
async function showActiveMarkdownAsRich(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const state = window.__store?.getState()
          if (!state?.activeFileId) {
            return false
          }
          state.setMarkdownViewMode(state.activeFileId, 'rich')
          return true
        }),
      { timeout: 25_000 }
    )
    .toBe(true)
}

test('@golden opens, edits, saves, and reopens a tracked file', async ({
  orcaPage,
  testRepoPath,
  registerPostElectronShutdownCleanup
}) => {
  const fixture = createGoldenWorktree(testRepoPath, 'file-save')
  registerPostElectronShutdownCleanup(async () => cleanupGoldenWorktree(testRepoPath, fixture))
  const sentinel = `Golden file save ${Date.now()}`
  const readmePath = path.join(fixture.worktreePath, README_PATH)

  await waitForSessionReady(orcaPage)
  await activateGoldenWorktree(orcaPage, testRepoPath, fixture.worktreePath)
  await orcaPage.evaluate(() => {
    const state = window.__store?.getState()
    state?.setRightSidebarTab('source-control')
    state?.setRightSidebarOpen(true)
  })
  await orcaPage.getByRole('button', { name: 'Explorer' }).click()

  const explorer = orcaPage.locator('[data-orca-explorer-shell]')
  // Why: after save the row's full text is "README.md M" from the git badge.
  const readmeRow = explorer.locator('[data-file-explorer-row]').filter({
    has: orcaPage.getByText(README_PATH, { exact: true })
  })
  await expect(readmeRow).toBeVisible({ timeout: 10_000 })
  await readmeRow.click()

  await expect(orcaPage.locator('.editor-header-path').first()).toContainText(README_PATH, {
    timeout: 20_000
  })
  await showActiveMarkdownAsRich(orcaPage)
  const editor = orcaPage.locator('.rich-markdown-editor')
  await expect(editor).toBeVisible({ timeout: 25_000 })
  await expect(editor).toContainText('Orca E2E Test Repo')
  await editor.click()
  await orcaPage.keyboard.press('ControlOrMeta+End')
  await orcaPage.keyboard.press('Enter')
  await orcaPage.keyboard.type(sentinel)
  await orcaPage.keyboard.press('ControlOrMeta+S')

  await expect.poll(() => readFileSync(readmePath, 'utf8'), { timeout: 10_000 }).toContain(sentinel)
  const readmeTab = orcaPage.locator('[data-tab-id]').filter({ hasText: README_PATH }).last()
  await readmeTab.getByRole('button', { name: 'Close tab' }).click()
  await expect(
    orcaPage.locator('.editor-header-path').filter({ hasText: README_PATH })
  ).toHaveCount(0)

  await readmeRow.click()
  await expect(orcaPage.locator('.editor-header-path').first()).toContainText(README_PATH, {
    timeout: 20_000
  })
  await showActiveMarkdownAsRich(orcaPage)
  await expect(orcaPage.locator('.rich-markdown-editor')).toContainText(sentinel, {
    timeout: 25_000
  })
  await expect(explorer).toBeVisible()
  await expect(readmeRow).toBeVisible()
  await expect(
    orcaPage.getByText(path.basename(testRepoPath), { exact: true }).first()
  ).toBeVisible()
})
