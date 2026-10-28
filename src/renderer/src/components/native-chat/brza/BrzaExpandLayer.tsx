import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Maximize2, WrapText, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'

const CONTENT = '[data-native-chat-code-content]'
const BLOCK = '[data-native-chat-code-block]'
const OVERLAY = '[data-brza-expand-overlay]'
const HIDE_DELAY_MS = 200

/** Only a block that scrolls, either way, has something to expand. */
export function brzaBlockScrolls(element: Element): boolean {
  return (
    element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1
  )
}

/** The code, command output or diff under the pointer, when it scrolls inside this chat. */
export function brzaExpandTarget(node: EventTarget | null, root: Element): HTMLElement | null {
  if (!(node instanceof Element) || node.closest(OVERLAY)) {
    return null
  }
  const block = node.closest(BLOCK)
  const content = node.closest<HTMLElement>(CONTENT) ?? block?.querySelector<HTMLElement>(CONTENT)
  return content && root.contains(content) && brzaBlockScrolls(content) ? content : null
}

type Hover = { element: HTMLElement; top: number; left: number }

/** One ⤢ for every block in the chat, delegated from the root so no Orca row changes. */
export function BrzaExpandLayer(): React.JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [expanded, setExpanded] = useState<HTMLElement | null>(null)
  const [root, setRoot] = useState<Element | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const root = anchorRef.current?.closest('[data-native-chat-root]')
    if (!root) {
      return
    }
    setRoot(root)
    const onOver = (event: Event): void => {
      if (event.target instanceof Element && event.target.closest('[data-brza-expand-button]')) {
        clearTimeout(hideTimer.current)
        return
      }
      const element = brzaExpandTarget(event.target, root)
      clearTimeout(hideTimer.current)
      if (!element) {
        hideTimer.current = setTimeout(() => setHover(null), HIDE_DELAY_MS)
        return
      }
      const block = element.closest(BLOCK)
      const rect = (block ?? element).getBoundingClientRect()
      // Left of the block's own header actions, which sit at its top right.
      setHover({
        element,
        top: Math.max(rect.top + 4, 4),
        left: rect.right - 28 - (block ? 96 : 4)
      })
    }
    const onScroll = (): void => setHover(null)
    root.addEventListener('mouseover', onOver, true)
    root.addEventListener('scroll', onScroll, true)
    return () => {
      clearTimeout(hideTimer.current)
      root.removeEventListener('mouseover', onOver, true)
      root.removeEventListener('scroll', onScroll, true)
    }
  }, [])

  return (
    <span ref={anchorRef} className="contents">
      {hover && !expanded
        ? createPortal(
            <button
              type="button"
              data-brza-expand-button=""
              aria-label={translate('brza.native-chat.expandBlock', 'Expand block')}
              title={translate('brza.native-chat.expandBlockHint', 'Expand in chat (Esc closes)')}
              onClick={() => {
                setExpanded(hover.element)
                setHover(null)
              }}
              style={{ top: hover.top, left: hover.left }}
              className="fixed z-50 flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  const { source, root, onClose } = props
  const bodyRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState(() => root.getBoundingClientRect())
  const [wrapped, setWrapped] = useState(true)
  const [copied, setCopied] = useState(false)
  const text = source.innerText ?? source.textContent ?? ''
  const lines = text.split('\n').length

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) {
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
  }, [source])

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
      aria-label={translate('brza.native-chat.expandedBlock', 'Expanded block')}
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      className="fixed z-50 flex flex-col bg-chat-canvas shadow-[0_0_0_1px_var(--border)]"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2.5 py-1.5 text-xs text-muted-foreground">
        <span className="mr-auto">
          {translate('brza.native-chat.expandedLines', '{{count}} lines', { count: lines })}
        </span>
        <OverlayButton
          label={translate('components.native-chat.wrapLines', 'Wrap lines')}
          pressed={wrapped}
          onClick={() => setWrapped(!wrapped)}
        >
          <WrapText className="size-3.5" />
        </OverlayButton>
        <OverlayButton
          label={
            copied
              ? translate('components.native-chat.copyMessage.copied', 'Copied')
              : translate('components.native-chat.copyCode', 'Copy code')
          }
          onClick={copy}
        >
          <Copy className="size-3.5" />
        </OverlayButton>
        <OverlayButton
          label={translate('brza.native-chat.closeExpanded', 'Close (Esc)')}
          onClick={onClose}
        >
          <X className="size-3.5" />
        </OverlayButton>
      </div>
      <div
        ref={bodyRef}
        className={`scrollbar-sleek min-h-0 flex-1 overflow-auto p-3 font-mono text-chat-code text-chat-code-foreground ${
          wrapped ? '[&>*]:whitespace-pre-wrap' : '[&>*]:whitespace-pre'
        }`}
      />
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
