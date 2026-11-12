import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const CHAT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['chat', 'list'],
    summary: 'List agent chats with their workspace, state and last reply',
    usage: 'orca chat list [--worktree <name-or-id>] [--state <state>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'state'],
    notes: [
      'Lists the top-level chats Orca shows as agent tabs. Terminal agents are read with `orca terminal`.',
      '--state keeps chats in one state, such as working, done, blocked or waiting.'
    ],
    examples: ['orca chat list --json', 'orca chat list --state working']
  },
  {
    path: ['chat', 'read'],
    summary: 'Read the latest messages of an agent chat',
    usage:
      'orca chat read --session <id-or-handle> [--limit <n>] [--cursor <epoch:sequence>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session', 'limit', 'cursor'],
    notes: [
      '--session takes the session id or handle from `orca chat list` or `orca agent launch`.',
      '--limit is the number of entries shown (messages, tool calls, approvals and questions); the default is 20 and the maximum 100.',
      '--cursor reads changes after the cursor, including new revisions; it returns nextCursor and hasNewer. It cannot be combined with --limit.',
      'A cursor_reset exits 2 and returns the newest entries with a new nextCursor. Read without --cursor if the cursor resets again.',
      'Approvals and questions waiting for an answer are marked "waiting for you".'
    ],
    examples: [
      'orca chat read --session codex_1234 --limit 10',
      'orca chat read --session codex_1234 --cursor e:42 --json'
    ]
  },
  {
    path: ['chat', 'send'],
    summary: 'Send a message to an agent chat',
    usage: 'orca chat send --session <id-or-handle> --text <text> [--operation <id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session', 'text', 'operation'],
    notes: [
      'Sends the text as your message, as if typed in the chat.',
      'While the agent is working, hosts with a message queue hold the message until the turn ends; the result says "queued".',
      'Exit 0 when accepted or queued, 1 when refused or rejected, and 3 when pending or unknown. On 3, do not resend; retry with the same --operation or read the chat.',
      '--operation retries with the operation printed by a previous send. With the same text and delivery, the host returns the recorded result without sending again; different text is refused. Trailing whitespace is ignored.',
      'Operation ids have 13 timestamp digits, a hyphen and 32 lowercase hexadecimal digits. An unseen id is admitted as a new send only within 24 hours; older unseen ids are refused. An unknown operation stays unknown on replay.',
      'Delivery depends on the host capability queued-messages.v2 and enters the payload fingerprint. If that capability changes between attempts, replay is refused with operationIdReused.',
      'A queued result reports queuePosition, nextQueuedMessageId and held_by: question, working or null. queuePaused is true when the queue is stopped.',
      'A chat that restarted since it was read refuses the send; read it again and resend.'
    ],
    examples: [
      'orca chat send --session codex_1234 --text "Run the tests, then summarize failures"'
    ]
  },
  {
    path: ['chat', 'rename'],
    summary: 'Rename a chat tab',
    usage: 'orca chat rename [--session <id>] --name <text> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session', 'name'],
    notes: [
      '--session takes the chat session id `orca agent launch` prints. Run inside a chat, it defaults to that chat; with --environment it is required.',
      'The name shows in the tab, the sidebar, Session History and on paired phones, the same as renaming the tab by hand.'
    ],
    examples: [
      'orca chat rename --name "Migrate auth to OAuth"',
      'orca chat rename --session <sessionId> --name "Release notes" --json'
    ]
  }
]
