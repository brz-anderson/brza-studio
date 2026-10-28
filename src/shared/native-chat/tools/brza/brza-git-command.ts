import type { NativeChatToolResultBlock } from '../../../native-chat-types'
import type { BrzaShellSegment } from './brza-shell-segments'

// Global options that take the next word as their value, as in `git -C app commit`.
const GIT_OPTIONS_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--config-env'
])
// `git commit` prints `[branch (root-commit) abc1234] subject` before the file stats.
const GIT_COMMIT_SUMMARY = /^\[(?:[^\]\n]*\s)?([0-9a-f]{7,40})\] (.+)$/m
// Agents pass multi-line messages as `-m "$(cat <<'EOF' … EOF)"`.
const HEREDOC_MESSAGE = /^\$\(\s*cat\s*<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*)$/

function gitSubcommandArgs(segment: BrzaShellSegment, name: string): readonly string[] | null {
  const { argv } = segment
  if (argv[0] !== 'git') {
    return null
  }
  for (let index = 1; index < argv.length; index += 1) {
    const word = argv[index]
    if (GIT_OPTIONS_WITH_VALUE.has(word)) {
      index += 1
    } else if (!word.startsWith('-')) {
      return word === name ? argv.slice(index + 1) : null
    }
  }
  return null
}

export function isGitCommitSegment(segment: BrzaShellSegment): boolean {
  return gitSubcommandArgs(segment, 'commit') !== null
}

function firstLine(text: string, stopAt?: string): string | null {
  const line = text
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part.length > 0)
  return line === undefined || line === stopAt ? null : line
}

function messageSubject(message: string): string | null {
  const heredoc = HEREDOC_MESSAGE.exec(message.trim())
  return heredoc ? firstLine(heredoc[3], heredoc[2]) : firstLine(message)
}

/** The first line of the first `-m`/`--message`, which git makes the subject. */
function commitMessageSubject(args: readonly string[]): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index]
    let message: string | undefined
    if (word === '--message' || /^-[a-zA-Z]*m$/.test(word)) {
      message = args[index + 1]
    } else if (word.startsWith('--message=')) {
      message = word.slice('--message='.length)
    } else if (/^-m./.test(word)) {
      message = word.slice(2)
    }
    if (message !== undefined) {
      return messageSubject(message)
    }
  }
  return null
}

function commitSummary(result?: NativeChatToolResultBlock): RegExpExecArray | null {
  return result && !result.isError ? GIT_COMMIT_SUMMARY.exec(result.output) : null
}

/** The subject git printed, else the one the command passes; null without a commit. */
export function gitCommitSubject(
  segments: readonly BrzaShellSegment[],
  result?: NativeChatToolResultBlock
): string | null {
  const args = segments
    .map((segment) => gitSubcommandArgs(segment, 'commit'))
    .find((found) => found !== null)
  if (!args) {
    return null
  }
  return commitSummary(result)?.[2].trim() || commitMessageSubject(args)
}

/** The short hash a successful `git commit` printed. */
export function gitCommitHash(
  segments: readonly BrzaShellSegment[],
  result?: NativeChatToolResultBlock
): string | null {
  return segments.some(isGitCommitSegment) ? (commitSummary(result)?.[1] ?? null) : null
}
