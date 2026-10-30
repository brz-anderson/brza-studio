import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { activateAiVaultStructuredSession } from '@/lib/activate-ai-vault-structured-session'
import type { Tab } from '../../../../../shared/tab-types'
import type { AgentMessageSender } from '../../../../../shared/agent-session/agent-session-message-source'
import { brzaClaudePeerKind } from '../../../../../shared/native-chat/brza/brza-claude-peer-sender'

/** The one open chat tab named like the peer session: its own label or the host's chat title. */
export function findBrzaClaudePeerChatTab(
  tabsByWorktree: Readonly<Record<string, readonly Tab[]>>,
  sender: AgentMessageSender
): Tab | null {
  const name = sender.name?.trim()
  if (!name || brzaClaudePeerKind(sender) !== 'message') {
    return null
  }
  const named = Object.values(tabsByWorktree).flatMap((tabs) =>
    tabs.filter(
      (tab) =>
        tab.contentType === 'agent-session' &&
        (tab.customLabel?.trim() === name || tab.label.trim() === name)
    )
  )
  // Two chats with one name cannot tell which session wrote.
  return named.length === 1 ? named[0] : null
}

/** A Claude Code peer has no Orca mailbox entry; its name opens the chat tab that carries it, when one does. */
export function BrzaClaudePeerSenderName({
  sender,
  label,
  queued
}: {
  sender: AgentMessageSender
  label: string
  queued: boolean
}): React.JSX.Element {
  const tab = useAppStore((state) => findBrzaClaudePeerChatTab(state.unifiedTabsByWorktree, sender))
  if (!tab) {
    return (
      <span className={`max-w-48 truncate ${queued ? 'px-2' : 'px-2.5'}`} title={label}>
        {label}
      </span>
    )
  }
  return (
    <Button
      type="button"
      variant={queued ? 'link' : 'ghost'}
      size={queued ? 'xs' : 'sm'}
      title={
        queued ? label : translate('components.native-chat.agentMessage.goToAgent', 'Go to agent')
      }
      onClick={() =>
        void activateAiVaultStructuredSession({
          structuredSession: { workspaceId: tab.worktreeId, sessionId: tab.entityId }
        })
      }
    >
      <span className="max-w-48 truncate">{label}</span>
      {!queued ? <ArrowUpRight className="size-3" aria-hidden /> : null}
    </Button>
  )
}
