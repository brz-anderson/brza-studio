import { useMemo } from 'react'
import type { NativeChatMessage } from '../../../../../shared/native-chat/native-chat-types'
import type { NativeChatStructuredViewProps } from '../native-chat-view-types'
import { NativeChatRowActionsProvider } from '../messages/actions/NativeChatRowActionsProvider'
import type { NativeChatPaneForks } from '../messages/actions/use-native-chat-fork'
import type { NativeChatRewindSurface } from '../messages/actions/use-native-chat-rewind-host'
import {
  NativeChatNewChatContext,
  useNativeChatNewChatFromMessage
} from '../native-chat-new-chat-from-message'
import { useNativeChatTabOwnerWorktreeId } from '../pane/ownership/use-native-chat-tab-owner'
import {
  NativeChatEditUserMessageContext,
  editNativeChatUserMessage
} from '../native-chat-edit-user-message'
import {
  NativeChatForkContext,
  useNativeChatForkFromMessage
} from '../native-chat-fork-from-message'

/** What the BrzA rows add to the pane's row actions: edit on the user's message, a new chat and a
 *  fork from the agent's. The upstream provider, nested inside, owns rewind and its own fork. */
export function BrzaRowActionsProvider({
  pane,
  chat: controller,
  forks,
  children
}: {
  pane: Pick<NativeChatStructuredViewProps, 'sessionId' | 'tabId' | 'agent' | 'groupId' | 'target'>
  chat: { rewind: { surface: NativeChatRewindSurface | undefined } }
  forks: NativeChatPaneForks
  children: React.ReactNode
}): React.JSX.Element {
  const chat = pane
  const worktreeId = useNativeChatTabOwnerWorktreeId(chat.tabId)
  const newChat = useNativeChatNewChatFromMessage({
    agent: chat.agent,
    worktreeId,
    groupId: chat.groupId,
    target: chat.target
  })
  const { sessionId, tabId } = chat
  const edit = useMemo(
    () => (message: NativeChatMessage) => editNativeChatUserMessage({ sessionId, tabId }, message),
    [sessionId, tabId]
  )
  const fork = useNativeChatForkFromMessage({
    agent: chat.agent,
    sessionId,
    tabId,
    worktreeId,
    target: chat.target
  })
  return (
    <NativeChatNewChatContext.Provider value={newChat}>
      <NativeChatEditUserMessageContext.Provider value={edit}>
        <NativeChatForkContext.Provider value={fork}>
          <NativeChatRowActionsProvider pane={pane} chat={controller} forks={forks}>
            {children}
          </NativeChatRowActionsProvider>
        </NativeChatForkContext.Provider>
      </NativeChatEditUserMessageContext.Provider>
    </NativeChatNewChatContext.Provider>
  )
}
