import { insertAgentReferences } from './native-chat-agent-reference'
import {
  nativeChatDraftPositions,
  hasUnsavedNativeChatComposerDraftChange
} from '../../drafts/native-chat-composer-draft-memory'
import { createNativeChatPastedTextHistory } from './native-chat-pasted-text-history'
import { resolveNativeChatPastedText } from '../../paste/native-chat-composer-pasted-text-references'
import { NativeChatPastedTextScopeProvider } from './native-chat-pasted-text-state'
import {
  readNativeChatDraftSnapshot,
  writeNativeChatDraftDocument
} from '../../drafts/native-chat-draft-views'
import { subscribeToNativeChatComposerDraft } from '../../drafts/native-chat-composer-draft-store'

import { closeHistory } from '@tiptap/pm/history'
import { Slice } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { memo, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { shallow } from 'zustand/shallow'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  fileReferenceContent,
  NativeChatFileReference,
  NativeChatImageReference,
  promptLeafText,
  promptText
} from './native-chat-prompt-document'
import { promptTextContent } from './native-chat-prompt-document-text'
import type {
  NativeChatComposerInput,
  NativeChatPromptEditorProps
} from './native-chat-composer-input'
import { NativeChatImageRowProvider } from './NativeChatImageReferencePill'
import { promptModeCoordinates, storedPromptDocument } from '../../native-chat-prompt-editor-mode'
import {
  useNativeChatPromptCoordinates,
  useNativeChatPromptMode
} from '../../use-native-chat-prompt-mode'
import { focusMountedNativeChatEditor, mountedEditorView } from './native-chat-mounted-editor-view'

import { useNativeChatComposerMount } from '../focus/native-chat-composer-mount'

const NO_IMAGES: readonly string[] = []
const NOT_COMPOSING = (): boolean => false

// `initialValue` only seeds the editor at mount; keep the other props referentially stable or this memo stops helping.
export const NativeChatPromptEditor = memo(
  NativePromptEditor,
  ({ initialValue: _previous, ...previous }, { initialValue: _next, ...next }) =>
    shallow(previous, next)
)

function NativePromptEditor({
  scopeKey,
  positionTarget,
  imageRow = NO_IMAGES,
  inputRef,
  isComposing = NOT_COMPOSING,
  initialValue,
  disabled,
  placeholder,
  onChange,
  onSelect,
  className,
  ...events
}: NativeChatPromptEditorProps): React.JSX.Element {
  const historyPaths = useMemo(() => createNativeChatPastedTextHistory(scopeKey ?? ''), [scopeKey])
  const adopted = useRef(readNativeChatDraftSnapshot(scopeKey, initialValue))
  const userOwned = useRef(false)
  const appliedPosition = useRef<unknown>(undefined)
  const claimSelection = () => {
    userOwned.current = true
    const position = adopted.current && nativeChatDraftPositions.get(adopted.current)
    if (position && position.at !== 'start' && position.target === positionTarget) {
      position.pending = false
    }
  }
  const placeholderRef = useRef(placeholder)
  placeholderRef.current = placeholder
  const mode = useNativeChatPromptMode(scopeKey, initialValue, placeholderRef)
  const { markdown, codec, extensions, initial } = mode
  const editor = useEditor(
    {
      extensions,
      content: initial.content,
      contentType: initial.contentType,
      editable: !disabled,
      editorProps: {
        attributes: {
          'data-native-chat-prompt-editor': 'true',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': placeholder,
          class: `${className ?? ''} ${markdown ? 'rich-markdown-editor native-chat-markdown-composer-editor' : ''} whitespace-pre-wrap break-words [&_p]:m-0 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child]:before:text-chat-foreground-faint [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:pointer-events-none`,
          ...Object.fromEntries(Object.entries(events).filter(([key]) => key.startsWith('aria-')))
        },
        // Clipboard input is text, read as Markdown in that mode; only the picker and attachments
        // create pills.
        handlePaste: (view, event) => {
          if (event.defaultPrevented) {
            return true
          }
          const text = event.clipboardData?.getData('text/plain')
          if (text == null) {
            return false
          }
          const content = editor?.schema.nodeFromJSON(
            promptModeCoordinates(editor, markdown, codec).content(text)
          )
          if (!content) {
            return false
          }
          view.dispatch(view.state.tr.replaceSelection(new Slice(content.content, 1, 1)))
          return true
        },
        clipboardTextSerializer: (slice, view) =>
          resolveNativeChatPastedText(
            scopeKey ?? '',
            markdown && editor
              ? promptModeCoordinates(editor, markdown, codec).text(
                  view.state.schema.topNodeType.create(null, slice.content)
                )
              : slice.content.textBetween(0, slice.content.size, '\n', promptLeafText),
            true
          )
      },
      onTransaction: ({ editor: current, transaction }) => {
        if (
          !transaction.getMeta('preventUpdate') &&
          (transaction.docChanged || transaction.selectionSet)
        ) {
          claimSelection()
        }
        const pastedTextFiles = transaction.docChanged
          ? historyPaths(current.state.doc, transaction.docs)
          : undefined
        // Remote/late draft adoption is already saved; only this window’s edits should persist their document and skill chips.
        if (
          scopeKey &&
          transaction.docChanged &&
          (!transaction.getMeta('preventUpdate') ||
            hasUnsavedNativeChatComposerDraftChange(scopeKey))
        ) {
          writeNativeChatDraftDocument(
            scopeKey,
            promptModeCoordinates(current, markdown, codec).text(current.state.doc),
            current.getJSON(),
            pastedTextFiles
          )
        }
      },
      onUpdate: () => {
        if (inputRef.current) {
          onChange(inputRef.current)
        }
      },
      onSelectionUpdate: () => {
        if (inputRef.current) {
          onSelect(inputRef.current)
        }
      }
    },
    [markdown]
  )

  const coordinates = useNativeChatPromptCoordinates(editor, mode)

  const applyPosition = useCallback(
    (previousRange?: { from: number; to: number }) => {
      const position = adopted.current && nativeChatDraftPositions.get(adopted.current)
      if (
        !editor ||
        !position?.pending ||
        appliedPosition.current === position ||
        (position.at !== 'start' && position.target !== positionTarget)
      ) {
        return
      }
      if (userOwned.current) {
        if (position.at !== 'start') {
          position.pending = false
        } else if (previousRange) {
          editor.commands.setTextSelection({
            from: coordinates.position(editor.state.doc, previousRange.from),
            to: coordinates.position(editor.state.doc, previousRange.to)
          })
        }
        return
      }
      appliedPosition.current = position
      editor.view.dispatch(
        editor.state.tr
          .setSelection(
            position.at === 'selection'
              ? TextSelection.create(
                  editor.state.doc,
                  coordinates.position(editor.state.doc, position.from),
                  coordinates.position(editor.state.doc, position.to)
                )
              : position.at === 'end'
                ? TextSelection.atEnd(editor.state.doc)
                : TextSelection.atStart(editor.state.doc)
          )
          .setMeta('preventUpdate', true)
      )
      if (position.at !== 'start') {
        position.pending = false
      }
    },
    [coordinates, editor, positionTarget]
  )
  useLayoutEffect(() => applyPosition(), [applyPosition])

  useLayoutEffect(() => {
    if (!editor || !scopeKey) {
      return
    }
    const capture = () => historyPaths(editor.state.doc)
    capture()
    return subscribeToNativeChatComposerDraft(scopeKey, capture)
  }, [editor, scopeKey, historyPaths])

  useLayoutEffect(() => editor?.setEditable(!disabled, false), [disabled, editor])

  const input = useMemo<NativeChatComposerInput | null>(
    () =>
      editor
        ? {
            insertAgentReferences: (references) => insertAgentReferences(editor, references),
            insertText: (text) => {
              const content = editor.schema.nodeFromJSON(coordinates.content(text))
              editor.view.dispatch(
                editor.state.tr.replaceSelection(new Slice(content.content, 1, 1))
              )
            },
            get value() {
              return coordinates.text(editor.state.doc)
            },
            set value(value: string) {
              const { doc } = editor.state
              const old = coordinates.text(doc)
              if (old === value) {
                return
              }
              // A draft loaded or adopted whole keeps its skill chips: its stored document wins.
              const previousRange = {
                from: coordinates.offset(doc, editor.state.selection.from),
                to: coordinates.offset(doc, editor.state.selection.to)
              }
              adopted.current = readNativeChatDraftSnapshot(scopeKey, value)
              const stored = storedPromptDocument(editor, coordinates, scopeKey, value)
              if (stored) {
                editor.commands.setContent(stored, { emitUpdate: false })
                applyPosition(previousRange)
                return
              }
              if (!value) {
                editor.commands.setContent(coordinates.content(''), { emitUpdate: false })
                applyPosition(previousRange)
                return
              }
              let start = 0
              while (start < old.length && start < value.length && old[start] === value[start]) {
                start++
              }
              let end = 0
              while (
                end < old.length - start &&
                end < value.length - start &&
                old[old.length - 1 - end] === value[value.length - 1 - end]
              ) {
                end++
              }
              // A text replacement intersecting an atom replaces its entire serialized token.
              const from = coordinates.position(doc, start, 'before')
              const to = coordinates.position(doc, old.length - end, 'after')
              start = coordinates.offset(doc, from)
              end = old.length - coordinates.offset(doc, to)
              if (markdown) {
                // Markdown reads only as a whole: a change typed text cannot make is read whole.
                const inserted = value.slice(start, value.length - end)
                const tr = editor.state.tr.insertText(inserted, from, to)
                if (!inserted.includes('\n') && coordinates.text(tr.doc) === value) {
                  editor.view.dispatch(tr.setMeta('preventUpdate', true))
                } else {
                  editor.commands.setContent(coordinates.content(value), { emitUpdate: false })
                }
                return
              }
              const content = editor.schema.nodeFromJSON(
                promptTextContent(value.slice(start, value.length - end))
              )
              editor.commands.command(({ tr }) => {
                tr.replaceRange(from, to, new Slice(content.content, 1, 1))
                tr.setMeta('preventUpdate', true)
                return true
              })
              applyPosition(previousRange)
            },
            get disabled() {
              return !editor.isEditable
            },
            set disabled(value: boolean) {
              editor.setEditable(!value)
            },
            get selectionStart() {
              return coordinates.offset(editor.state.doc, editor.state.selection.from)
            },
            get selectionEnd() {
              return coordinates.offset(editor.state.doc, editor.state.selection.to)
            },
            focus: () => focusMountedNativeChatEditor(editor),
            contains: (node) => mountedEditorView(editor)?.dom.contains(node) === true,
            isCaretOnVisualEdge: (edge) => {
              const { selection, doc } = editor.state
              if (!selection.empty) {
                return false
              }
              const before = promptText(doc, 0, selection.from)
              const after = promptText(doc, selection.from)
              // An empty composer has one line: no layout read on the path every recall starts from.
              if (before === '' && after === '') {
                return true
              }
              const beyond = edge === 'start' ? before : after
              // Why both: the text check covers other paragraphs, the view covers soft wraps.
              return (
                !beyond.includes('\n') &&
                editor.view.endOfTextblock(edge === 'start' ? 'up' : 'down')
              )
            },
            select: () => {
              editor.commands.selectAll()
            },
            setSelectionRange: (from, to) => {
              const { doc } = editor.state
              editor.commands.setTextSelection({
                from: coordinates.position(doc, from ?? 0),
                to: coordinates.position(doc, to ?? 0)
              })
            },
            insertSkill: (from, to, token, path) => {
              const { doc } = editor.state
              const range = {
                from: coordinates.position(doc, from),
                to: coordinates.position(doc, to)
              }
              editor.view.dispatch(closeHistory(editor.state.tr))
              editor
                .chain()
                .insertContentAt(range, [
                  { type: 'nativeChatSkill', attrs: { token, path: path ?? '' } },
                  { type: 'text', text: ' ' }
                ])
                .run()
              editor.view.dispatch(closeHistory(editor.state.tr))
            },
            removeImageReferences: (attachmentId) => {
              const { tr } = editor.state
              editor.state.doc.descendants((node, position) => {
                if (
                  node.type.name === NativeChatImageReference.name &&
                  node.attrs.attachmentId === attachmentId
                ) {
                  // With the space inserted after it, so no gap is left where it sat.
                  const from = tr.mapping.map(position)
                  const to = from + node.nodeSize
                  tr.delete(from, tr.doc.textBetween(to, to + 1) === ' ' ? to + 1 : to)
                }
              })
              // Undo must not bring back a chip whose image is gone.
              if (tr.docChanged) {
                editor.view.dispatch(tr.setMeta('addToHistory', false))
              }
            },
            stagePastedText: (token) => {
              const pill = { type: NativeChatFileReference.name, attrs: { token } }
              editor.view.dispatch(closeHistory(editor.state.tr))
              editor.view.dispatch(
                editor.state.tr.replaceSelectionWith(editor.schema.nodeFromJSON(pill), false)
              )
              editor.view.dispatch(closeHistory(editor.state.tr))
            },
            insertFileReferences: (paths) => {
              editor.commands.insertContentAt(
                editor.state.selection.from,
                paths.flatMap((path) => [fileReferenceContent(path), { type: 'text', text: ' ' }])
              )
            }
          }
        : null,
    [coordinates, editor, markdown, scopeKey, applyPosition]
  )
  useImperativeHandle(inputRef, () => input!, [input])
  useNativeChatComposerMount(scopeKey ?? '', input, isComposing, disabled)

  return (
    <NativeChatPastedTextScopeProvider value={scopeKey ?? ''}>
      <NativeChatImageRowProvider value={imageRow}>
        <EditorContent
          editor={editor}
          {...events}
          onCompositionStartCapture={claimSelection}
          data-disabled={disabled || undefined}
          className="data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
        />
      </NativeChatImageRowProvider>
    </NativeChatPastedTextScopeProvider>
  )
}
