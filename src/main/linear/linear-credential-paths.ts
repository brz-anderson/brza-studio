import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getIntegrationCredentialsDir } from '../credentials/integration-credentials-dir'

export const LEGACY_WORKSPACE_ID = 'legacy'

function getLegacyTokenPath(): string {
  return join(getIntegrationCredentialsDir(), 'linear-token.enc')
}

export function getLegacyViewerPath(): string {
  return join(getIntegrationCredentialsDir(), 'linear-viewer.json')
}

export function getWorkspaceFilePath(): string {
  return join(getIntegrationCredentialsDir(), 'linear-workspaces.json')
}

export function getWorkspaceTokenDir(): string {
  return join(getIntegrationCredentialsDir(), 'linear-tokens')
}

export function getWorkspaceTokenPath(workspaceId: string): string {
  if (workspaceId === LEGACY_WORKSPACE_ID) {
    return getLegacyTokenPath()
  }
  return join(getWorkspaceTokenDir(), `${Buffer.from(workspaceId).toString('base64url')}.enc`)
}

export function ensureCredentialsDir(): void {
  const dir = getIntegrationCredentialsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function ensureWorkspaceTokenDir(): void {
  const dir = getWorkspaceTokenDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
