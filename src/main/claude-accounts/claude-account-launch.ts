import {
  CLAUDE_INJECTED_CONFIG_DIR_ENV,
  CLAUDE_PROFILE_POINTER_ENV
} from '../../shared/claude-profile-routing'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { isDirectory } from './claude-profile-homes'
import { claudeProfileMissing } from './claude-profile-launch-errors'
import type { ClaudeProfileRouter } from './claude-profile-router'
import type { ClaudeRuntimeAuthPreparation } from './runtime-auth/runtime-auth-types'

/** The saved account when it is this host's own; undefined for any other id. */
export function claudeSavedHostAccount(
  router: Pick<ClaudeProfileRouter, 'savedAccount'>,
  accountId: string
): ClaudeManagedAccount | undefined {
  const saved = router.savedAccount(accountId)
  return saved && saved.managedAuthRuntime !== 'wsl' ? saved : undefined
}

/** The account a launch on `accountId` runs under; null when it is System default's login. */
export function claudeLaunchAccountId(
  router: Pick<ClaudeProfileRouter, 'coveredBySystemDefault'>,
  accountId: string | null
): string | null {
  return accountId !== null && !router.coveredBySystemDefault(accountId) ? accountId : null
}

/** Launch on `accountId` (null: System default) whatever the selection: a chat switched to it. */
export async function prepareClaudeAccountLaunch(
  router: ClaudeProfileRouter,
  accountId: string | null
): Promise<ClaudeRuntimeAuthPreparation> {
  // An account removed since the switch must not be set up again under its old id.
  if (accountId !== null && !claudeSavedHostAccount(router, accountId)) {
    throw claudeProfileMissing()
  }
  const launchId = claudeLaunchAccountId(router, accountId)
  await router.readyForLaunch(launchId)
  const home = launchId === null ? null : router.accountHome(launchId)
  // Never fall back from a missing folder: that would run the wrong account.
  if (home !== null && !isDirectory(home)) {
    throw claudeProfileMissing()
  }
  return {
    configDir: home ?? router.systemDefaultHome(),
    runtime: 'host',
    wslDistro: null,
    wslLinuxConfigDir: null,
    // Preserve the user's inherited CLAUDE_CONFIG_DIR for System default.
    envPatch: {
      [CLAUDE_PROFILE_POINTER_ENV]: router.pointerPath,
      ...(home ? { CLAUDE_CONFIG_DIR: home, [CLAUDE_INJECTED_CONFIG_DIR_ENV]: home } : {})
    },
    provenance: home ? `profile:${launchId}` : 'system'
  }
}

/** The home a chat switched to `accountId` launches under, read without setting anything up; the
 *  same answer `prepareClaudeAccountLaunch` gives. undefined when no router decides it, so the
 *  caller falls back to the selection. `identity` names it before its folder exists. */
export function pinnedClaudeAccountHome(
  router: ClaudeProfileRouter | null | undefined,
  pin: { accountId: string | null },
  launchEnv: Record<string, string | undefined>,
  purpose: 'read' | 'identity'
): { variable: 'CLAUDE_CONFIG_DIR'; path: string } | undefined {
  if (!router) {
    return undefined
  }
  if (pin.accountId !== null && !claudeSavedHostAccount(router, pin.accountId)) {
    if (purpose === 'identity') {
      return { variable: 'CLAUDE_CONFIG_DIR', path: router.accountHome(pin.accountId) }
    }
    throw claudeProfileMissing()
  }
  const launchId = claudeLaunchAccountId(router, pin.accountId)
  if (launchId === null) {
    return {
      variable: 'CLAUDE_CONFIG_DIR',
      path: launchEnv.CLAUDE_CONFIG_DIR?.trim() || router.systemDefaultHome()
    }
  }
  const path = router.accountHome(launchId)
  if (purpose === 'read' && !isDirectory(path)) {
    throw claudeProfileMissing()
  }
  return { variable: 'CLAUDE_CONFIG_DIR', path }
}
