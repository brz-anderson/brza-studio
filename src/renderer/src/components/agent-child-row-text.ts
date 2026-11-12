import {
  agentChildRowDetailText as sharedAgentChildRowDetailText,
  agentChildRowLeadTrail,
  agentChildRowName as sharedAgentChildRowName
} from '../../../shared/agent-status/presentation/agent-child-row-lead-trail'
import type { AgentChildRowModel } from '../../../shared/agent-status/presentation/agent-child-row-model'
import { agentStateLabel } from '@/components/AgentStateDot'
import { sayBackgroundTaskTranslated } from '@/components/native-chat/tools/tasks/background-task-words-text'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { agentNoUpdateLabel } from '../../../shared/agent-status/presentation/agent-row-decay-state'

export type AgentChildRowText = {
  /** Leads the line; kept when the row truncates. */
  lead: string
  /** Follows the separator; '' when there is nothing more to say. */
  trail: string
}

/** How long this child has been silent, on the reader's clock the model measured it on. */
export function agentChildRowNoUpdateLabel(row: AgentChildRowModel, now: number): string {
  return agentNoUpdateLabel({ updatedAt: row.recencyAt }, now)
}

const AGENT_CHILD_ROW_COPY = {
  stateLabel: agentStateLabel,
  ended: () => translate('components.agentChildRow.ended', 'Ended'),
  sayBackgroundTask: sayBackgroundTaskTranslated
}

export function agentChildRowDetailText(row: AgentChildRowModel, now: number): string {
  return sharedAgentChildRowDetailText(row, now, AGENT_CHILD_ROW_COPY)
}

/** The line beneath a full-width row: what the child said, or that it ended; '' otherwise. */
export function agentChildRowMessageLine(
  row: AgentChildRowModel,
  t: Translate = translate
): string {
  if (row.detail?.kind === 'message') {
    return row.detail.text
  }
  return row.detail?.kind === 'ended' ? t('components.agentChildRow.ended', 'Ended') : ''
}

/** The row's name, or its state when the child reported none. */
export function agentChildRowName(row: AgentChildRowModel): string {
  return sharedAgentChildRowName(row, agentStateLabel)
}

/** The agent type that sits between the name and the tool on a running row; '' when it adds nothing. */
export function agentChildRowTypeBeforeTool(row: AgentChildRowModel): string {
  if (row.detail?.kind !== 'operation' || row.displayState === 'monitoring') {
    return ''
  }
  const agentType = row.agentType?.trim() ?? ''
  return agentType === '' ||
    agentType === 'unknown' ||
    agentType === 'default' ||
    agentType === row.name.trim() ||
    agentType === agentChildRowName(row).trim()
    ? ''
    : agentType
}

export function agentChildRowText(row: AgentChildRowModel, now: number): AgentChildRowText {
  return agentChildRowLeadTrail(row, agentChildRowName(row), agentChildRowDetailText(row, now))
}
