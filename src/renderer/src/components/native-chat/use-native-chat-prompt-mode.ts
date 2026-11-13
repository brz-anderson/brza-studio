// The composer editor's mode state: plain text or Markdown shown formatted (the chat settings switch).
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import type { Editor } from '@tiptap/core'
import { useAppStore } from '@/store'
import { createRichMarkdownEditorCodec } from '../editor/rich-markdown/document/rich-markdown-source-transport'
import {
  NativeChatFileReference,
  NativeChatImageReference,
  NativeChatSkill
} from './composer/editor/native-chat-prompt-document'
import {
  initialPromptContent,
  promptModeCoordinates,
  promptModeExtensions,
  promptPlaceholderExtension,
  replacePromptDocument
} from './native-chat-prompt-editor-mode'
import { NativeChatAgentReference } from './composer/editor/native-chat-agent-reference'
import { NativeChatUnkernedRunDecorations } from './composer/editor/native-chat-unkerned-run-decorations'

/** The mode, its codec and extensions, and the content a new editor starts with. */
export function useNativeChatPromptMode(
  scopeKey: string | undefined,
  initialValue: string,
  placeholderRef: MutableRefObject<string>
) {
  const initialValueRef = useRef(initialValue)
  const markdown = useAppStore((state) => state.settings?.nativeChatMarkdownComposer === true)
  const codec = useMemo(() => createRichMarkdownEditorCodec(), [])
  const extensions = useMemo(
    () => [
      ...promptModeExtensions(markdown, codec),
      NativeChatSkill,
      NativeChatFileReference,
      NativeChatImageReference,
      NativeChatAgentReference,
      NativeChatUnkernedRunDecorations,
      // A disabled box still says why it is disabled, as the plain text box's placeholder does.
      promptPlaceholderExtension(placeholderRef)
    ],
    [codec, markdown, placeholderRef]
  )
  const initial = useMemo(
    () => initialPromptContent(extensions, markdown, codec, scopeKey, initialValue),
    [codec, extensions, initialValue, markdown, scopeKey]
  )
  useLayoutEffect(() => {
    initialValueRef.current = initialValue
  }, [initialValue, initialValueRef])
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
