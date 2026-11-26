import type { Translate } from '@/i18n/use-translate'
import {
  NATIVE_CHAT_NOTICE_COPY,
  type NativeChatNoticeLook
} from '../../../../../shared/native-chat/transcript/notices/native-chat-notice'

/** The words on a transcript rule: the compaction and clear the upstream draws, and the account a
 *  switch moved the chat to. Kept out of NativeChatNoticeRow, which sits at its line limit. */
export function brzaDividerLabel(
  look: Extract<NativeChatNoticeLook, { kind: 'divider' }>,
  t: Translate
): string {
  switch (look.label) {
    case 'accountSwitched':
      return t(
        'components.native-chat.notices.accountSwitched',
        NATIVE_CHAT_NOTICE_COPY.accountSwitched,
        { account: look.account }
      )
    case 'contextCleared':
      return t(
        'components.native-chat.notices.contextCleared',
        NATIVE_CHAT_NOTICE_COPY.contextCleared
      )
    case 'compaction':
      return t('components.native-chat.notices.compaction', NATIVE_CHAT_NOTICE_COPY.compaction)
  }
}
