import { ChevronDown, ChevronUp, CircleHelp, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { useTranslate } from '@/i18n/use-translate'
import type { InteractivePromptCard } from '../../../../../shared/native-chat/input/native-chat-interactive-prompt'

/** A prompt card's one collapse affordance; folding or unfolding writes nothing to the agent. */
export function NativeChatPromptCollapseToggle({
  expanded,
  disabled = false,
  onToggle
}: {
  expanded: boolean
  disabled?: boolean
  onToggle: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const label = expanded
    ? t('components.native-chat.prompt.collapse', 'Collapse')
    : t('components.native-chat.prompt.expand', 'Expand')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          aria-expanded={expanded}
          disabled={disabled}
          onClick={onToggle}
        >
          {expanded ? <ChevronDown /> : <ChevronUp />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
        {expanded ? <ShortcutKeyCombo keys={['Esc']} /> : null}
      </TooltipContent>
    </Tooltip>
  )
}

export function nativeChatPromptCardTitle(card: NonNullable<InteractivePromptCard>): string {
  return card.kind === 'approval' ? card.approval.title : (card.prompt.questions[0]?.question ?? '')
}

/** A collapsed prompt above the usable composer; expanding gives it the input again. */
export function NativeChatPromptStrip({
  kind,
  title,
  onExpand
}: {
  kind: NonNullable<InteractivePromptCard>['kind']
  title: string
  onExpand: () => void
}): React.JSX.Element {
  const t = useTranslate()
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
          <Button type="button" variant="ghost" size="xs" aria-expanded={false} onClick={onExpand}>
            {action}
            <ChevronUp aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** The strip of a card collapsed in the terminal chat, which names its kind and title. */
export function NativeChatCardPromptStrip({
  card,
  onExpand
}: {
  card: NonNullable<InteractivePromptCard>
  onExpand: () => void
}): React.JSX.Element {
  return (
    <NativeChatPromptStrip
      kind={card.kind}
      title={nativeChatPromptCardTitle(card)}
      onExpand={onExpand}
    />
  )
}
