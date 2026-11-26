import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Maximize2, WrapText, X } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import EditorViewToggle from '@/components/editor/view-mode/EditorViewToggle'
import { nativeChatCodeCopyText } from '../native-chat-code-copy-text'
import { BrzaMarkdownExpandPreview } from './BrzaMarkdownExpandPreview'
import { brzaCodeBlockLanguage, isBrzaMarkdownFence } from './brza-markdown-fence'
import './brza-expand-button.css'

const CONTENT = '[data-native-chat-code-content]'
const BLOCK = '[data-native-chat-code-block]'
const ACTIONS = '[data-native-chat-code-actions]'
const SHOWN = 'data-brza-expand-shown'
const BUTTON_PX = 24
const ACTIONS_GAP_PX = 2
const CORNER_INSET_PX = 4
const OVERLAY = '[data-brza-expand-overlay]'
const HIDE_DELAY_MS = 200
const MARKDOWN_MODES = ['preview', 'source'] as const

/** The code, command output or diff under the pointer, scrolling or not (PLN-001 R62.2). */
export function brzaExpandTarget(node: EventTarget | null, root: Element): HTMLElement | null {
  if (!(node instanceof Element) || node.closest(OVERLAY)) {
    return null
  }
  const block = node.closest(BLOCK)
  const content = node.closest<HTMLElement>(CONTENT) ?? block?.querySelector<HTMLElement>(CONTENT)
  return content && root.contains(content) ? content : null
}

type Hover = { element: HTMLElement; top: number; left: number }

/** On the block's actions row, left of them; a block without actions (tool output, diff) gets its inner top-right corner. */
function brzaExpandButtonPosition(element: HTMLElement): { top: number; left: number } {
  const block = element.closest(BLOCK)
  const actions = block?.querySelector(ACTIONS)
  if (actions) {
    const rect = actions.getBoundingClientRect()
    return { top: rect.top, left: rect.left - ACTIONS_GAP_PX - BUTTON_PX }
  }
  const rect = (block ?? element).getBoundingClientRect()
  return {
    top: Math.max(rect.top + CORNER_INSET_PX, CORNER_INSET_PX),
    left: rect.right - BUTTON_PX - CORNER_INSET_PX
  }
}

/** One ⤢ for every block in the chat, delegated from the root so no Orca row changes. */
export function BrzaExpandLayer(): React.JSX.Element {
  const t = useTranslate()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [expanded, setExpanded] = useState<HTMLElement | null>(null)
  const [root, setRoot] = useState<Element | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const scheduleHide = useCallback((): void => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setHover(null), HIDE_DELAY_MS)
  }, [])

  useEffect(() => {
    const root = anchorRef.current?.closest('[data-native-chat-root]')
    if (!root) {
      return
    }
    setRoot(root)
    const onOver = (event: Event): void => {
      const element = brzaExpandTarget(event.target, root)
      if (!element) {
        scheduleHide()
        return
      }
      clearTimeout(hideTimer.current)
      setHover({ element, ...brzaExpandButtonPosition(element) })
    }
    const onScroll = (): void => setHover(null)
    root.addEventListener('mouseover', onOver, true)
    root.addEventListener('mouseleave', scheduleHide)
    root.addEventListener('scroll', onScroll, true)
    return () => {
      clearTimeout(hideTimer.current)
      root.removeEventListener('mouseover', onOver, true)
      root.removeEventListener('mouseleave', scheduleHide)
      root.removeEventListener('scroll', onScroll, true)
    }
  }, [scheduleHide])

  // ⤢ lives outside the block, so pointing at it would drop the block's hover and fade its actions away.
  const shownBlock = hover?.element.closest(BLOCK) ?? null
  useEffect(() => {
    if (!shownBlock) {
      return
    }
    shownBlock.setAttribute(SHOWN, '')
    return () => shownBlock.removeAttribute(SHOWN)
  }, [shownBlock])

  return (
    <span ref={anchorRef} className="contents">
      {hover && !expanded
        ? createPortal(
            <button
              type="button"
              data-brza-expand-button=""
              aria-label={t('brza.native-chat.expandBlock', 'Expand block')}
              title={t('brza.native-chat.expandBlockHint', 'Expand in chat (Esc closes)')}
              onClick={() => {
                setExpanded(hover.element)
                setHover(null)
              }}
              onMouseEnter={() => clearTimeout(hideTimer.current)}
              onMouseLeave={scheduleHide}
              style={{ top: hover.top, left: hover.left }}
              className="fixed z-50 flex size-6 shrink-0 items-center justify-center rounded-md text-chat-foreground-faint transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Maximize2 className="size-3.5" />
            </button>,
            document.body
          )
        : null}
      {expanded && root
        ? createPortal(
            <BrzaExpandOverlay source={expanded} root={root} onClose={() => setExpanded(null)} />,
            document.body
          )
        : null}
    </span>
  )
}

function BrzaExpandOverlay(props: {
  source: HTMLElement
  root: Element
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const { source, root, onClose } = props
  const bodyRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState(() => root.getBoundingClientRect())
  const [wrapped, setWrapped] = useState(true)
  const [copied, setCopied] = useState(false)
  const markdown = isBrzaMarkdownFence(brzaCodeBlockLanguage(source))
  const [mode, setMode] = useState<(typeof MARKDOWN_MODES)[number]>(markdown ? 'preview' : 'source')
  // A fence's text is its source verbatim; innerText also breaks a diff's row divs into lines.
  const text = markdown
    ? nativeChatCodeCopyText(source.textContent ?? '')
    : (source.innerText ?? source.textContent ?? '')
  const lines = text.split('\n').length

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body || mode !== 'source') {
      return
    }
    // A copy, so the transcript's own row stays where React put it.
    const clone = source.cloneNode(true)
    if (clone instanceof HTMLElement) {
      clone.removeAttribute('data-native-chat-code-content')
      Object.assign(clone.style, {
        maxHeight: 'none',
        maxWidth: 'none',
        overflow: 'visible',
        margin: '0'
      })
    }
    body.replaceChildren(clone)
  }, [source, mode])

  useEffect(() => {
    const onResize = (): void => setRect(root.getBoundingClientRect())
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [root, onClose])

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }, [text])

  return (
    <div
      data-brza-expand-overlay=""
      role="dialog"
      aria-label={t('brza.native-chat.expandedBlock', 'Expanded block')}
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      className="fixed z-50 flex flex-col bg-chat-canvas shadow-[0_0_0_1px_var(--border)]"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2.5 py-1.5 text-xs text-muted-foreground">
        <span className="mr-auto">
          {t('brza.native-chat.expandedLines', '{{count}} lines', {
            count: lines,
            defaultValue_one: '{{count}} line'
          })}
        </span>
        {markdown ? (
          <EditorViewToggle
            value={mode}
            modes={MARKDOWN_MODES}
            onChange={(value) => setMode(value === 'preview' ? 'preview' : 'source')}
          />
        ) : null}
        {mode === 'source' ? (
          <OverlayButton
            label={t('components.native-chat.wrapLines', 'Wrap lines')}
            pressed={wrapped}
            onClick={() => setWrapped(!wrapped)}
          >
            <WrapText className="size-3.5" />
          </OverlayButton>
        ) : null}
        <OverlayButton
          label={
            copied
              ? t('components.native-chat.copyMessage.copied', 'Copied')
              : t('components.native-chat.copyCode', 'Copy code')
          }
          onClick={copy}
        >
          <Copy className="size-3.5" />
        </OverlayButton>
        <OverlayButton label={t('brza.native-chat.closeExpanded', 'Close (Esc)')} onClick={onClose}>
          <X className="size-3.5" />
        </OverlayButton>
      </div>
      {mode === 'preview' ? (
        <div className="min-h-0 flex-1">
          <BrzaMarkdownExpandPreview content={text} />
        </div>
      ) : (
        <div
          ref={bodyRef}
          className={`scrollbar-sleek min-h-0 flex-1 overflow-auto p-3 font-mono text-chat-code text-chat-code-foreground ${
            wrapped ? '[&>*]:whitespace-pre-wrap' : '[&>*]:whitespace-pre'
          }`}
        />
      )}
    </div>
  )
}

function OverlayButton(props: {
  label: string
  pressed?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.pressed}
      title={props.label}
      onClick={props.onClick}
      className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground"
    >
      {props.children}
    </button>
  )
}
