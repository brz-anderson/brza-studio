// The composer's two modes: plain text, or Markdown shown formatted (the chat settings switch).
import { getSchema, type AnyExtension, type Editor, type JSONContent } from '@tiptap/core'
import type { Schema, Slice } from '@tiptap/pm/model'
import { encodeRawMarkdownHtmlForRichEditor } from '../editor/rich-markdown/raw-source/raw-markdown-html'
import type { RichMarkdownEditorCodec } from '../editor/rich-markdown/document/rich-markdown-source-transport'
import { readNativeChatDraftDocument } from './drafts/native-chat-draft-views'
import {
  openingPromptContent,
  promptTextContent
} from './composer/editor/native-chat-prompt-document-text'
import {
  createNativeChatMarkdownPromptExtensions,
  markdownPromptCoordinates
} from './native-chat-markdown-prompt'
import {
  PLAIN_PROMPT_COORDINATES,
  promptLeafText,
  type NativeChatPromptCoordinates
} from './composer/editor/native-chat-prompt-document'

/** The Markdown mode's editor schema; plain text keeps the upstream composer's own. */
export function markdownModeExtensions(codec: RichMarkdownEditorCodec): AnyExtension[] {
  return createNativeChatMarkdownPromptExtensions(codec)
}

/** The text the composer reads, sends and keeps its carets in: Markdown with the switch on. */
export function promptModeCoordinates(
  editor: Editor | null,
  markdown: boolean,
  codec: RichMarkdownEditorCodec
): NativeChatPromptCoordinates {
  return markdown && editor ? markdownPromptCoordinates(editor, codec) : PLAIN_PROMPT_COORDINATES
}

function fitsSchema(schema: Schema, content: JSONContent): boolean {
  try {
    schema.nodeFromJSON(content).check()
    return true
  } catch {
    return false
  }
}

/** A new editor's first content: the draft's stored document when it fits, since skill chips live
 *  only there. One the other mode saved can fit and read as other text, so `stored` asks for a
 *  check once the editor can read it. */
export function initialPromptContent(
  extensions: AnyExtension[],
  markdown: boolean,
  codec: RichMarkdownEditorCodec,
  scopeKey: string | undefined,
  value: string
): { content: JSONContent | string; contentType?: 'markdown'; stored: boolean } {
  const stored = scopeKey ? readNativeChatDraftDocument(scopeKey, value) : undefined
  if (stored && fitsSchema(getSchema(extensions), stored)) {
    // Drafts saved before Shift+Enter split paragraphs hold hard breaks; plain text reads one line each.
    return { content: markdown ? stored : openingPromptContent(stored, value), stored: true }
  }
  return markdown
    ? {
        content: encodeRawMarkdownHtmlForRichEditor(value, codec),
        contentType: 'markdown',
        stored: false
      }
    : { content: promptTextContent(value), stored: false }
}

/** The draft's stored document when it reads as `value`. */
export function storedPromptDocument(
  editor: Editor,
  coordinates: NativeChatPromptCoordinates,
  scopeKey: string | undefined,
  value: string
): JSONContent | undefined {
  const stored = scopeKey ? readNativeChatDraftDocument(scopeKey, value) : undefined
  return stored &&
    fitsSchema(editor.schema, stored) &&
    coordinates.text(editor.schema.nodeFromJSON(stored)) === value
    ? stored
    : undefined
}

/** The whole document replaced as no edit of the user's: no undo step, no change event. */
export function replacePromptDocument(editor: Editor, content: JSONContent): void {
  const { tr, doc } = editor.state
  tr.replaceWith(0, doc.content.size, editor.schema.nodeFromJSON(content).content)
  editor.view.dispatch(tr.setMeta('addToHistory', false).setMeta('preventUpdate', true))
}

/** A change to a Markdown composer's text: typed text goes in place; one typing cannot make is read whole. */
export function replaceMarkdownPromptText(
  editor: Editor,
  coordinates: NativeChatPromptCoordinates,
  value: string,
  tail: { start: number; end: number; from: number; to: number }
): void {
  const inserted = value.slice(tail.start, value.length - tail.end)
  const tr = editor.state.tr.insertText(inserted, tail.from, tail.to)
  if (!inserted.includes('\n') && coordinates.text(tr.doc) === value) {
    editor.view.dispatch(tr.setMeta('preventUpdate', true))
  } else {
    editor.commands.setContent(coordinates.content(value), { emitUpdate: false })
  }
}

/** The text a copied slice puts on the clipboard: the Markdown it reads as, with the switch on. */
export function promptClipboardText(
  editor: Editor | null,
  markdown: boolean,
  codec: RichMarkdownEditorCodec,
  slice: Slice,
  schema: Schema
): string {
  return markdown && editor
    ? promptModeCoordinates(editor, markdown, codec).text(
        schema.topNodeType.create(null, slice.content)
      )
    : slice.content.textBetween(0, slice.content.size, '\n', promptLeafText)
}
