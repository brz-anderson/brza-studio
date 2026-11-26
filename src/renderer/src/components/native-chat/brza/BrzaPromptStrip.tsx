import { useLayoutEffect, useRef } from 'react'
import { ChevronUp, CircleHelp, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { InteractivePromptCard } from '../../../../../shared/native-chat/input/native-chat-interactive-prompt'

type PromptKind = NonNullable<InteractivePromptCard>['kind']

/** A collapsed prompt above the usable composer; the action names the kind (Review, Answer) and
 *  expanding gives the card the input again. */
export function BrzaPromptStrip({
  kind,
  title,
  onExpand,
  takeFocus = false
}: {
  kind: PromptKind
  title: string
  onExpand: () => void
  /** No composer returns to hold focus, so the strip keeps it off the hidden card. */
  takeFocus?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const toggleRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (takeFocus) {
      toggleRef.current?.focus()
    }
  }, [takeFocus])
  const Icon = kind === 'approval' ? Shield : CircleHelp
  const action =
    kind === 'approval'
      ? t('components.native-chat.prompt.review', 'Review')
      : t('components.native-chat.prompt.answer', 'Answer')
  return (
    <div className="shrink-0 bg-chat-pane">
      <div className="mx-auto w-full max-w-(--chat-content-max-width) px-3 pt-2 sm:px-4">
        <div
          data-native-chat-prompt-strip="true"
          data-native-chat-prompt-kind={kind}
          className="flex items-center gap-2 rounded-lg border border-l-[3px] border-input border-l-primary bg-card py-1 pr-1.5 pl-3 shadow-xs"
        >
          <Icon
            aria-hidden="true"
            data-native-chat-prompt-strip-icon={kind}
            className="size-4 shrink-0 text-primary"
          />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</p>
          <Button
            ref={toggleRef}
            data-native-chat-prompt-card-focus={takeFocus || undefined}
            type="button"
            variant="ghost"
            size="xs"
            aria-expanded={false}
            onClick={onExpand}
          >
            {action}
            <ChevronUp aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** The strip of a card collapsed in the terminal chat, which names its kind and title. */
export function BrzaCardPromptStrip({
  card,
  onExpand,
  takeFocus = false
}: {
  card: NonNullable<InteractivePromptCard>
  onExpand: () => void
  takeFocus?: boolean
}): React.JSX.Element {
  const title =
    card.kind === 'approval' ? card.approval.title : (card.prompt.questions[0]?.question ?? '')
  return (
    <BrzaPromptStrip kind={card.kind} title={title} onExpand={onExpand} takeFocus={takeFocus} />
  )
}
