import type { ClaudeAccountRecipe } from '../../../../shared/agent-session/lifecycle/accounts/agent-session-acquired-account'
import type { AgentSessionAccountSwitchRecord } from '../../../../shared/agent-session-account-switch'
import type { ClaudeProfileRouter } from '../../../claude-accounts/profiles/routing/claude-profile-router'
import { prepareClaudeAccountLaunch } from '../../../claude-accounts/claude-account-launch'
import { applyClaudeEnvPatch } from '../../../claude-accounts/runtime-auth/environment'
import { claudeConfigDirEnvPatch } from './claude-config-dir-pin'
import { resolveStructuredClaudeAccountHomePath } from '../../../runtime/agent-session/environment/structured-agent-account-home'

/** The account a launch runs under is the current selection, or the account the chat was switched to;
 *  the receipt records what it used. */
export async function prepareClaudeLaunchAccount(
  router: ClaudeProfileRouter | undefined,
  env: Record<string, string>,
  recordHome: string,
  switched?: Pick<AgentSessionAccountSwitchRecord, 'accountId'>
): Promise<ClaudeAccountRecipe> {
  if (!router) {
    return { route: 'system', home: recordHome, configDir: env.CLAUDE_CONFIG_DIR ?? null }
  }
  const preparation = switched
    ? await prepareClaudeAccountLaunch(router, switched.accountId)
    : await router.prepareLaunch()
  // Read before patching: System default preserves the launch environment's CLAUDE_CONFIG_DIR.
  // A chat switched to System default must not read the selected account's home.
  const home =
    preparation.provenance !== 'system'
      ? preparation.configDir
      : switched
        ? env.CLAUDE_CONFIG_DIR?.trim() || router.systemDefaultHome()
        : await resolveStructuredClaudeAccountHomePath({
            launchEnv: env,
            wslDistro: null,
            getClaudeConfigDirectory: () => router.systemDefaultHome()
          })
  applyClaudeEnvPatch(env, preparation.envPatch)
  return preparation.provenance.startsWith('profile:')
    ? { route: 'managed', accountId: preparation.provenance.slice('profile:'.length), home }
    : { route: 'system', home, configDir: env.CLAUDE_CONFIG_DIR ?? null }
}

/** Pins the account a launch would run under now, without preparing its folder: managed settings
 *  can refuse flags per account, so flag checks must ask as that account. */
export async function withClaudeLaunchAccountPin(
  router: ClaudeProfileRouter | undefined,
  env: Record<string, string>,
  recordHome: string
): Promise<Record<string, string>> {
  const home = router
    ? await resolveStructuredClaudeAccountHomePath({
        launchEnv: env,
        wslDistro: null,
        purpose: 'identity',
        getClaudeConfigDirectory: () => router.systemDefaultHome()
      })
    : recordHome
  return { ...env, ...claudeConfigDirEnvPatch(home, { env }) }
}
