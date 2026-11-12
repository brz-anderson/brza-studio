import { randomUUID } from 'node:crypto'
import type {
  AgentSessionHistoryResult,
  AgentSessionMutationResult,
  AgentSessionSendResult
} from '../../shared/agent-session/agent-session-wire'
import { AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY } from '../../shared/agent-session/agent-session-runtime-capabilities'
import { AGENT_SESSION_HISTORY_MAX_LIMIT } from '../../shared/agent-session/agent-session-wire'
import type { RuntimeWorktreePsResult } from '../../shared/runtime-worktree-contracts'
import { createStructuredAgentSessionOperationId } from '../../shared/agent-session/lifecycle/structured-agent-session-mutation'
import {
  structuredAgentSessionMessageSendMutation,
  structuredAgentSessionSendBody
} from '../../shared/agent-session/requests/structured-agent-session-send-mutation'
import {
  chatTranscript,
  formatChatList,
  formatChatRead,
  listChatSessions,
  parseChatSessionSelector
} from '../chat-sessions'
import type { CommandHandler } from '../dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getPresentStringFlag,
  getRequiredStringFlag
} from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { formatChatCursor, parseChatCursor } from '../brza/chat-cursor'
import { observePendingChatSend } from '../brza/chat-send-observation'
import { isChatHistoryTransportError } from '../brza/chat-history-transport'
import { formatChatSendRetry } from '../brza/chat-send-retry'
import { chatQueueHold } from '../brza/chat-queue-hold'
import { chatSendOutcome } from '../brza/chat-send-outcome'
import { parseChatOperationId } from '../brza/chat-operation-id'
import { CHAT_RENAME_HANDLERS } from './chat-rename'

const DEFAULT_READ_LIMIT = 20
const MAX_READ_LIMIT = 100
// Why: provider status frames and turn markers share the journal with the conversation, so the
// read fetches more rows than it shows to return the requested number of readable entries.
const HISTORY_ROWS_PER_ENTRY = 4
const MAX_HISTORY_ROWS = AGENT_SESSION_HISTORY_MAX_LIMIT

type HistoryResult = AgentSessionHistoryResult

function readSession(flags: Map<string, string | boolean>): string {
  return parseChatSessionSelector(getRequiredStringFlag(flags, 'session'))
}

export const CHAT_HANDLERS: Record<string, CommandHandler> = {
  ...CHAT_RENAME_HANDLERS,
  'chat list': async ({ flags, client, json }) => {
    const result = await client.call<RuntimeWorktreePsResult>('worktree.ps', {})
    const worktree = getOptionalStringFlag(flags, 'worktree')
    const chats = listChatSessions(result.result.worktrees).filter(
      (chat) => worktree === undefined || chat.worktree === worktree || chat.worktreeId === worktree
    )
    const state = getOptionalStringFlag(flags, 'state')
    printResult(
      { ...result, result: { chats: chats.filter((chat) => !state || chat.state === state) } },
      json,
      formatChatList
    )
  },
  'chat read': async ({ flags, client, json }) => {
    const session = readSession(flags)
    const cursorValue = getOptionalStringFlag(flags, 'cursor')
    const providedLimit = getOptionalPositiveIntegerFlag(flags, 'limit')
    if (cursorValue !== undefined) {
      if (providedLimit !== undefined) {
        throw new RuntimeClientError('invalid_argument', '--cursor cannot be used with --limit.')
      }
      const cursor = parseChatCursor(cursorValue)
      const result = await client.call<HistoryResult>('agentSession.history', {
        sessionId: session,
        direction: 'after',
        cursor,
        limit: MAX_HISTORY_ROWS
      })
      const page = result.result.page
      const cursorReset = result.result.ok ? undefined : result.result.reset
      const readResult = {
        session,
        entries: chatTranscript(page.items),
        removedItemIds: page.removedItemIds,
        nextCursor: formatChatCursor(
          cursorReset
            ? (page.liveCursor ?? page.window?.newest ?? { epoch: page.epoch, sequence: 0 })
            : (page.window?.nextCursor ?? page.liveCursor ?? { epoch: page.epoch, sequence: 0 })
        ),
        hasNewer: cursorReset ? false : page.hasNewer,
        ...(cursorReset ? { cursor_reset: cursorReset } : {})
      }
      if (cursorReset) {
        console.error(
          `cursor_reset: ${cursorReset}: the cursor no longer applies; showing the newest entries`
        )
      }
      printResult({ ...result, result: readResult }, json, formatChatRead)
      if (cursorReset) {
        process.exitCode = 2
      }
      return
    }
    const limit = providedLimit ?? DEFAULT_READ_LIMIT
    if (limit > MAX_READ_LIMIT) {
      throw new RuntimeClientError('invalid_argument', `--limit must be at most ${MAX_READ_LIMIT}.`)
    }
    const result = await client.call<HistoryResult>('agentSession.history', {
      sessionId: session,
      direction: 'tail',
      limit: Math.min(limit * HISTORY_ROWS_PER_ENTRY, MAX_HISTORY_ROWS)
    })
    // Why: status frames and turn markers can outweigh the readable rows on a page, so
    // page backward until the requested entry count is met or the journal is exhausted.
    let page = result.result.page
    const firstTailCursor = page.liveCursor ??
      page.window?.newest ?? { epoch: page.epoch, sequence: 0 }
    let entries = chatTranscript(page.items)
    while (entries.length < limit && page.hasOlder && page.window.oldest) {
      const cursor = page.window.oldest
      const older = await client.call<HistoryResult>('agentSession.history', {
        sessionId: session,
        direction: 'before',
        cursor,
        limit: MAX_HISTORY_ROWS
      })
      // Why: a stale or ahead cursor returns a reset carrying a fresh tail page; that
      // page replaces the window instead of extending it, then paging resumes from it.
      if (!older.result.ok) {
        page = older.result.page
        entries = chatTranscript(page.items)
        continue
      }
      const olderPage = older.result.page
      // An empty page reports the request cursor back; stop rather than loop on it.
      if (
        olderPage.window.oldest?.epoch === cursor.epoch &&
        olderPage.window.oldest?.sequence === cursor.sequence
      ) {
        break
      }
      entries = [...chatTranscript(olderPage.items), ...entries]
      page = olderPage
    }
    printResult(
      {
        ...result,
        result: {
          session,
          entries: entries.slice(-limit),
          removedItemIds: [],
          nextCursor: formatChatCursor(firstTailCursor),
          hasNewer: false
        }
      },
      json,
      formatChatRead
    )
  },
  'chat send': async ({ flags, client, json }) => {
    const session = readSession(flags)
    const text = getRequiredStringFlag(flags, 'text')
    if (text.trim().length === 0) {
      throw new RuntimeClientError('invalid_argument', '--text must not be empty.')
    }
    const operationValue = getPresentStringFlag(flags, 'operation')
    const clientOperationId =
      operationValue === undefined
        ? createStructuredAgentSessionOperationId(randomUUID)
        : parseChatOperationId(operationValue)
    const status = await client.getCliStatus()
    if (!status.result.runtime.reachable) {
      throw new RuntimeClientError(
        'runtime_unavailable',
        'Orca could not reach the execution host, so nothing was sent. Retry once it is reachable.'
      )
    }
    // Why: a chat that is mid-turn holds a queued message until the turn ends instead of
    // steering it; an older host without the queue receives an ordinary send.
    const queue =
      status.result.runtime.capabilities?.includes(
        AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY
      ) === true
    // The send is fenced to the session's current runtime, so a restarted chat refuses it.
    const history = await client.call<HistoryResult>('agentSession.history', {
      sessionId: session,
      direction: 'tail',
      limit: 1
    })
    const fence = history.result.page.fence
    if (fence === undefined) {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'This Orca host does not report the chat fence needed to send. Update Orca on the execution host.'
      )
    }
    const mutation = structuredAgentSessionMessageSendMutation({
      sessionId: session,
      clientOperationId,
      expectedRuntimeFence: fence,
      body: structuredAgentSessionSendBody(text, []),
      ...(queue ? { delivery: 'queue-if-active' as const } : {})
    })
    const operation = mutation.envelope.clientOperationId
    let result: Awaited<
      ReturnType<typeof client.call<AgentSessionMutationResult<AgentSessionSendResult>>>
    >
    try {
      result = await client.call<AgentSessionMutationResult<AgentSessionSendResult>>(
        'agentSession.send',
        mutation
      )
    } catch (error) {
      if (!(error instanceof RuntimeClientError) || error.code !== 'runtime_timeout') {
        throw error
      }
      const uncertain = {
        ...history,
        result: {
          session,
          operation,
          replayed: false,
          delivery: 'unknown' as const,
          submission: { state: 'unknown' as const, reason: error.message },
          clientMessageId: null
        }
      }
      printResult(uncertain, json, () => formatChatSendRetry(session, text, operation))
      process.exitCode = 3
      return
    }
    let submissionResult: AgentSessionMutationResult<AgentSessionSendResult> = result.result
    submissionResult = await observePendingChatSend(client, session, submissionResult)
    const outcome = chatSendOutcome(submissionResult)
    const value = submissionResult.ok ? submissionResult.value : undefined
    let queuePage: HistoryResult['page'] | undefined
    if (value && 'queued' in value) {
      try {
        const queuedHistory = await client.call<HistoryResult>('agentSession.history', {
          sessionId: session,
          direction: 'tail',
          limit: 1
        })
        queuePage = queuedHistory.result.page
      } catch (error) {
        if (!isChatHistoryTransportError(error)) {
          throw error
        }
      }
    }
    const visibleOutcome = { delivery: outcome.delivery, submission: outcome.submission }
    printResult(
      {
        ...result,
        result: {
          session,
          operation,
          replayed:
            submissionResult.ok && 'replayed' in result.result ? result.result.replayed : false,
          ...visibleOutcome,
          clientMessageId: value?.clientMessageId ?? null,
          ...(value && 'queued' in value
            ? {
                queuePosition: value.queued.position,
                ...(queuePage
                  ? {
                      nextQueuedMessageId: queuePage.nextQueuedMessageId ?? null,
                      held_by: chatQueueHold(queuePage),
                      ...(queuePage.queuePause ? { queuePaused: true } : {})
                    }
                  : { queueMetadataUnavailable: true })
              }
            : {}),
          ...(!submissionResult.ok ? { refusal: submissionResult.refusal } : {})
        }
      },
      json,
      (sent) => `Chat send ${sent.submission.state} for ${sent.session}.`
    )
    process.exitCode = outcome.exitCode
  }
}
