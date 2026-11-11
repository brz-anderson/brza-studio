import {
  requireLegacyAgentSessionAccountHome,
  type AgentSessionAccountHome
} from '../../shared/agent-session/lifecycle/agent-session-account-home'
import { agentSessionProviderHandleChainHead } from '../../shared/agent-session/lifecycle/agent-session-provider-handle'
import { pendingAgentSessionRewindFork } from '../../shared/agent-session/lifecycle/agent-session-rewind'
import { getClaudeProfileRouter } from '../claude-accounts/claude-profile-installed-router'
import {
  claudeLaunchAccountId,
  claudeSavedHostAccount
} from '../claude-accounts/claude-account-launch'
import {
  CLAUDE_PROFILE_MISSING_MESSAGE,
  CLAUDE_PROFILE_SETUP_FAILED_MESSAGE
} from '../../shared/claude-profile-routing'
import type { StructuredAgentSessionAdapter } from '../native-chat/agent-session-wire/providers/structured-agent-session-adapter'
import { copyClaudeTranscriptsToAccount } from './claude-account-switch-transcript'
import { CLAUDE_STRUCTURED_AGENT } from './structured/claude-structured-agent-definition'

/** What a refused account pin tells the person: the refusal reason and the sentence for it. */
export function claudeAccountPinRefusal(reason: 'unknown-account' | 'setup-failed'): {
  details: { reason: 'claudeAccountSetupFailed' | 'claudeAccountFolderMissing' }
  message: string
} {
  return reason === 'setup-failed'
    ? {
        details: { reason: 'claudeAccountSetupFailed' },
        message: CLAUDE_PROFILE_SETUP_FAILED_MESSAGE
      }
    : { details: { reason: 'claudeAccountFolderMissing' }, message: CLAUDE_PROFILE_MISSING_MESSAGE }
}

/** Ready the account's folder and name its login, for a chat that is pinned to it. */
export async function claudeReadyAccountPin(
  accountId: string | null
): Promise<
  | { ok: true; accountHome: AgentSessionAccountHome; account: string; targetHome: string }
  | { ok: false; reason: 'unknown-account' | 'setup-failed' }
> {
  const router = getClaudeProfileRouter()
  const saved = accountId === null || !router ? null : claudeSavedHostAccount(router, accountId)
  if (!router || saved === undefined) {
    return { ok: false, reason: 'unknown-account' }
  }
  const managedId = claudeLaunchAccountId(router, accountId)
  const targetHome =
    managedId === null
      ? router.systemDefaultHome()
      : await router.prepareAccount(managedId).catch(() => null)
  if (targetHome === null) {
    return { ok: false, reason: 'setup-failed' }
  }
  const login = managedId === null ? router.systemDefaultLogin() : router.accountLogin(managedId)
  return {
    ok: true,
    targetHome,
    accountHome: { variable: CLAUDE_STRUCTURED_AGENT.accountHomeVariable, path: targetHome },
    account: login?.email ?? saved?.email ?? 'System default'
  }
}

/** Ready the account's folder and carry the chat's transcripts into it; the record changes after. */
export const claudePrepareAccountSwitch: NonNullable<
  StructuredAgentSessionAdapter['prepareAccountSwitch']
> = async ({ record, accountId }) => {
  const ready = await claudeReadyAccountPin(accountId)
  const router = getClaudeProfileRouter()
  if (!ready.ok || !router) {
    return ready.ok ? { ok: false, reason: 'unknown-account' } : ready
  }
  const head = agentSessionProviderHandleChainHead(record.providerHandleChain)?.handle
  const fork = pendingAgentSessionRewindFork(record.rewind, head?.nativeId)
  await copyClaudeTranscriptsToAccount({
    providerSessionIds: [
      ...(head ? [head.nativeId] : []),
      ...(fork ? [fork.sessionId, fork.sourceSessionId] : [])
    ],
    sourceHomes: [
      requireLegacyAgentSessionAccountHome(record.accountHome).path,
      ...router.accountHomes(),
      router.systemDefaultHome()
    ],
    targetHome: ready.targetHome
  })
  return { ok: true, accountHome: ready.accountHome, account: ready.account }
}
