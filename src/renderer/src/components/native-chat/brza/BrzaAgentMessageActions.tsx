import { useContext } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { NativeChatForkButton } from '../NativeChatForkButton'
import { NativeChatNewChatContext } from '../native-chat-new-chat-from-message'

/** The hover-bar button look the agent message's actions share. */
export const BRZA_AGENT_CONTROL_BUTTON_CLASS =
  'flex size-6 shrink-0 items-center justify-center rounded-md text-chat-foreground-faint transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type BrzaAgentMessageActionsProps = {
  /** The row's message, for the actions that act from this point of the conversation. */
  messageId: string
  /** The message's text without its visual lines, which a new chat starts from. */
  text: string
}

/** The agent message's own actions after the scroll button: a new chat from it and the fork.
 *  Each leaves out where its context is absent. */
export function BrzaAgentMessageActions({
  messageId,
  text
}: BrzaAgentMessageActionsProps): React.JSX.Element {
  const newChat = useContext(NativeChatNewChatContext)
  const newChatLabel = translate(
    'components.native-chat.newChatFromMessage',
    'New chat from this message'
  )
  return (
    <>
      {newChat ? (
        <button
          type="button"
          onClick={() => newChat(text)}
          aria-label={newChatLabel}
          title={newChatLabel}
          className={BRZA_AGENT_CONTROL_BUTTON_CLASS}
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
      ) : null}
      <NativeChatForkButton messageId={messageId} className={BRZA_AGENT_CONTROL_BUTTON_CLASS} />
    </>
  )
}
