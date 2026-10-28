import {
  COMMAND_TOKEN_SCAN_MAX_CHARS,
  getCommandTokenPathBasename
} from '../../../command-token-scanner'
import { tokenizeCommandLine } from '../../../agent-command-line-entrypoint'
import { splitUnquotedSegments } from '../../../orca-browser-cli-commands'

/** One command of a shell line: its text, and its words without leading `VAR=x`, the program
 * reduced to its lowercased name (`/usr/bin/git.exe` → `git`). */
export type BrzaShellSegment = { text: string; argv: readonly string[] }

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const WINDOWS_LAUNCHER_SUFFIX = /\.(?:cmd|exe|bat)$/i

/** The commands a shell line runs, split at `&&`, `||`, `;`, `|` and newlines outside quotes. */
export function brzaShellSegments(command: string): BrzaShellSegment[] {
  const scanned = command.slice(0, COMMAND_TOKEN_SCAN_MAX_CHARS)
  return splitUnquotedSegments(scanned).flatMap((segment) => {
    const tokens = tokenizeCommandLine(segment)
    let index = 0
    while (index < tokens.length && ENV_ASSIGNMENT.test(tokens[index])) {
      index += 1
    }
    if (index >= tokens.length) {
      return []
    }
    const program = getCommandTokenPathBasename(tokens[index])
      .replace(WINDOWS_LAUNCHER_SUFFIX, '')
      .toLowerCase()
    return [{ text: segment.trim(), argv: [program, ...tokens.slice(index + 1)] }]
  })
}
