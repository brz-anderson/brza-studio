import type { Components } from 'react-markdown'
import { documentCommentMarkdownComponents } from '@/components/sidebar/comment-markdown-element-renderers'

const DocumentTable = documentCommentMarkdownComponents.table

/** BrzA: frames a chat table so "Full" width can size it like a code block (brza-chat-wide-blocks.css). */
export const NativeChatWideTable: Components['table'] = (props) => (
  <div data-native-chat-wide-block>
    {typeof DocumentTable === 'function' ? (
      <DocumentTable {...props} />
    ) : (
      <table>{props.children}</table>
    )}
  </div>
)
