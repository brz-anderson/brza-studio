import { useState, type RefObject } from 'react'
import { agentSessionPromptQuestions } from '../../../../shared/agent-session-question-answer'
import { chatApprovalFromJournal } from '../../../../shared/native-chat-interactive-prompt'
import type { CommentMarkdownLinkClickHandler } from '@/components/sidebar/CommentMarkdown'
import { NativeChatApprovalCard } from './NativeChatApprovalCard'
import { NativeChatPromptStrip } from './NativeChatPromptCollapse'
import { NativeChatStructuredQuestionCard } from './NativeChatStructuredQuestionCard'
import {
  structuredPromptKey,
  type StructuredPromptItem,
  type useStructuredPromptResponseHold
} from './use-structured-prompt-response-hold'

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

/** The pending approval or question, or its strip once folded above the usable composer. */
export function NativeChatStructuredPromptCard({
  prompt,
  collapse,
  response,
  onCancel,
  shouldFocus,
  answerInputRef,
  onLinkClick,
  allowFileUriLinks
}: {
  prompt: StructuredPromptItem
  collapse: StructuredPromptCollapse
  response: ReturnType<typeof useStructuredPromptResponseHold>
  onCancel: () => void
  shouldFocus: boolean
  answerInputRef: RefObject<HTMLInputElement | null>
  onLinkClick?: CommentMarkdownLinkClickHandler
  allowFileUriLinks: boolean
}): React.JSX.Element {
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
            shouldFocus={shouldFocus && !collapse.collapsed}
            onLinkClick={onLinkClick}
            allowFileUriLinks={allowFileUriLinks}
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
            shouldFocus={shouldFocus && !collapse.collapsed}
            answerInputRef={answerInputRef}
          />
        ) : null}
      </div>
      {collapse.collapsed ? (
        <NativeChatPromptStrip title={title} onExpand={collapse.expand} />
      ) : null}
    </>
  )
}
