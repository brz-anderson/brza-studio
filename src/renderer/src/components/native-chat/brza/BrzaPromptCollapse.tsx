import { useState, type RefObject } from 'react'
import { pendingPromptsAllUnanswerableHere } from '../../../../../shared/agent-session/requests/prompts/agent-session-approval-subject'
import { agentSessionPromptQuestions } from '../../../../../shared/agent-session/requests/prompts/agent-session-question-answer'
import { chatApprovalFromJournal } from '../../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { NativeChatApprovalCard } from '../prompts/NativeChatApprovalCard'
import { NativeChatPromptStrip } from '../prompts/NativeChatPromptCollapse'
import { NativeChatStructuredQuestionCard } from '../prompts/NativeChatStructuredQuestionCard'
import {
  structuredPromptKey,
  type StructuredPromptItem,
  type useStructuredPromptResponseHold
} from '../prompts/use-structured-prompt-response-hold'

export type StructuredPromptCollapse = {
  collapsed: boolean
  collapse: () => void
  expand: () => void
}

/** Only the folded occurrence stays folded; a new prompt or revision opens unfolded. */
export function useStructuredPromptCollapse(
  prompt: StructuredPromptItem | null
): StructuredPromptCollapse {
  const [collapsedKey, setCollapsedKey] = useState<string | null>(null)
  const key = prompt ? structuredPromptKey(prompt) : null
  return {
    collapsed: key !== null && collapsedKey === key,
    collapse: () => setCollapsedKey(key),
    expand: () => setCollapsedKey(null)
  }
}

export type BrzaPromptSlot = {
  collapse: StructuredPromptCollapse
  /** Unknown prompts leave the composer usable; a send starts a turn whose cancel can resolve them. */
  unanswerable: boolean
  /** The prompt's card holds the slot: unfolded, and one this chat can answer. */
  open: boolean
}

/** The chat's first pending prompt and how it shares the slot with the composer. */
export function useBrzaPromptSlot(
  prompts: readonly StructuredPromptItem[]
): [StructuredPromptItem | null, BrzaPromptSlot] {
  const prompt = prompts[0] ?? null
  const collapse = useStructuredPromptCollapse(prompt)
  const unanswerable = pendingPromptsAllUnanswerableHere(prompts)
  return [
    prompt,
    { collapse, unanswerable, open: prompt !== null && !unanswerable && !collapse.collapsed }
  ]
}

/** The pending approval or question, or its strip once folded above the usable composer. */
export function BrzaPromptCard({
  prompt,
  slot,
  response,
  onCancel,
  shouldFocus,
  answerInputRef
}: {
  prompt: StructuredPromptItem | null
  slot: BrzaPromptSlot
  response: ReturnType<typeof useStructuredPromptResponseHold>
  onCancel: () => void
  shouldFocus: boolean
  answerInputRef: RefObject<HTMLTextAreaElement | null>
}): React.JSX.Element | null {
  const { collapse } = slot
  if (!prompt) {
    return null
  }
  const key = structuredPromptKey(prompt)
  const approval = prompt.body.kind === 'approval' ? chatApprovalFromJournal(prompt.body) : null
  const questions =
    prompt.body.kind === 'question' ? agentSessionPromptQuestions(prompt.body) : null
  const title = approval?.title ?? questions?.[0]?.question ?? ''
  const isSubmitting = response.holds(prompt)
  return (
    <>
      {/* A collapsed card stays mounted but hidden, so a partly answered question survives. */}
      <div hidden={collapse.collapsed} inert={collapse.collapsed} className="contents">
        {approval ? (
          <NativeChatApprovalCard
            key={key}
            approval={approval}
            onChoose={(optionId) => void response.respond(prompt, { kind: 'option', optionId })}
            isSubmitting={isSubmitting}
            onCancel={onCancel}
            onCollapse={collapse.collapse}
            shouldFocus={shouldFocus && !slot.unanswerable && !collapse.collapsed}
          />
        ) : null}
        {questions ? (
          <NativeChatStructuredQuestionCard
            key={key}
            questions={questions}
            onAnswer={(answer) => void response.respond(prompt, answer)}
            isSubmitting={isSubmitting}
            onCancel={onCancel}
            onCollapse={collapse.collapse}
            shouldFocus={shouldFocus && !slot.unanswerable && !collapse.collapsed}
            answerInputRef={answerInputRef}
          />
        ) : null}
      </div>
      {collapse.collapsed ? (
        <NativeChatPromptStrip
          kind={approval ? 'approval' : 'question'}
          title={title}
          onExpand={collapse.expand}
        />
      ) : null}
    </>
  )
}
