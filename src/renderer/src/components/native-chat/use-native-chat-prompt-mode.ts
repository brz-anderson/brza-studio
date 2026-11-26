// The composer editor's mode state: plain text or Markdown shown formatted (the chat settings switch).
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AnyExtension, Editor } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { useAppStore } from '@/store'
import {
  createRichMarkdownEditorCodec,
  type RichMarkdownEditorCodec
} from '../editor/rich-markdown/document/rich-markdown-source-transport'
import { nativeChatPromptPills } from './composer/editor/native-chat-prompt-document'
import { nativeChatPromptExtensions } from './composer/editor/native-chat-prompt-extensions'
import {
  initialPromptContent,
  markdownModeExtensions,
  promptModeCoordinates,
  replacePromptDocument
} from './native-chat-prompt-editor-mode'
import { NativeChatAgentReference } from './composer/editor/native-chat-agent-reference'
import { NativeChatUnkernedRunDecorations } from './composer/editor/native-chat-unkerned-run-decorations'

/** The content a new editor starts with: read again only when the mode, its extensions or the scope
 *  change, from the value the composer had then. A later value (every keystroke) leaves it alone. */
function useInitialPromptContent(
  extensions: AnyExtension[],
  markdown: boolean,
  codec: RichMarkdownEditorCodec,
  scopeKey: string | undefined,
  value: string
) {
  const [seed, setSeed] = useState({ extensions, markdown, codec, scopeKey, value })
  if (
    seed.extensions !== extensions ||
    seed.markdown !== markdown ||
    seed.codec !== codec ||
    seed.scopeKey !== scopeKey
  ) {
    setSeed({ extensions, markdown, codec, scopeKey, value })
  }
  return useMemo(
    () =>
      initialPromptContent(seed.extensions, seed.markdown, seed.codec, seed.scopeKey, seed.value),
    [seed]
  )
}

/** The mode, its codec and extensions, and the content a new editor starts with. */
export function useNativeChatPromptMode(scopeKey: string | undefined, initialValue: string) {
  const initialValueRef = useRef(initialValue)
  // Why: the ref is written after commit, since React Compiler bails out on a write during render.
  useLayoutEffect(() => {
    initialValueRef.current = initialValue
  })
  const markdown = useAppStore((state) => state.settings?.nativeChatMarkdownComposer === true)
  const codec = useMemo(() => createRichMarkdownEditorCodec(), [])
  const extensions = useMemo(
    () => [
      // Plain text is the upstream composer's schema; Markdown swaps the editor's own for the formatted one
      // (its side-chat pill stays out: the pill reads only as plain text).
      ...(markdown
        ? [
            ...markdownModeExtensions(codec),
            NativeChatAgentReference,
            ...nativeChatPromptPills,
            NativeChatUnkernedRunDecorations
          ]
        : nativeChatPromptExtensions()),
      // A disabled box still says why it is disabled, as the plain text box's placeholder does.
      // The composer's editor outlives its component, so the hint comes from the live editor props.
      Placeholder.configure({
        placeholder: ({ editor }) => {
          const attributes = editor.options.editorProps?.attributes
          return typeof attributes === 'object' ? (attributes['data-placeholder-text'] ?? '') : ''
        },
        showOnlyWhenEditable: false
      })
    ],
    [codec, markdown]
  )
  const initial = useInitialPromptContent(extensions, markdown, codec, scopeKey, initialValue)
  return { markdown, codec, extensions, initial, initialValueRef }
}

/** The editor's text coordinates; a stored draft the other mode saved is re-read once the editor can. */
export function useNativeChatPromptCoordinates(
  editor: Editor | null,
  mode: ReturnType<typeof useNativeChatPromptMode>
) {
  const { markdown, codec, initial, initialValueRef } = mode
  const coordinates = useMemo(
    () => promptModeCoordinates(editor, markdown, codec),
    [codec, editor, markdown]
  )
  useLayoutEffect(() => {
    const value = initialValueRef.current
    if (editor && initial.stored && coordinates.text(editor.state.doc) !== value) {
      replacePromptDocument(editor, coordinates.content(value))
    }
  }, [coordinates, editor, initial.stored, initialValueRef])
  return coordinates
}
