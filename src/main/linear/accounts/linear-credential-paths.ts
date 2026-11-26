import { credentialFileExists } from '../../credentials/credential-file-io'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getIntegrationCredentialsDir } from '../../credentials/integration-credentials-dir'

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

// The login Connect Linear hands this Mac, next to the workspace's API key.
export function getWorkspaceLoginPath(workspaceId: string): string {
  return join(getWorkspaceTokenDir(), `${Buffer.from(workspaceId).toString('base64url')}.login.enc`)
}

export async function ensureCredentialsDir(): Promise<void> {
  const dir = getIntegrationCredentialsDir()
  if (!(await credentialFileExists(dir))) {
    await mkdir(dir, { recursive: true })
  }
}

export async function ensureWorkspaceTokenDir(): Promise<void> {
  const dir = getWorkspaceTokenDir()
  if (!(await credentialFileExists(dir))) {
    await mkdir(dir, { recursive: true })
  }
}
