import type { NativeChatToolResultBlock } from '../../../native-chat-types'
import type { BrzaShellSegment } from './brza-shell-segments'

const GH_KINDS = {
  pr: { label: 'PR', urlPath: 'pull' },
  issue: { label: 'Issue', urlPath: 'issues' }
} as const

type GhKind = keyof typeof GH_KINDS

/** The PR or issue a `gh` call names: its number and URL from the output, its title when known. */
export type GhReference = { kind: GhKind; number: string; url: string; title: string | null }

// Non-TTY `gh … view` prints `title:\t…`; `--json title` prints `"title":"…"`.
const PLAIN_TITLE = /^title:\t(.+)$/m
const JSON_TITLE = /"title"\s*:\s*("(?:[^"\\]|\\.)*")/

function ghKind(segment: BrzaShellSegment): GhKind | null {
  const [program, kind] = segment.argv
  return program === 'gh' && (kind === 'pr' || kind === 'issue') ? kind : null
}

export function isGhReferenceSegment(segment: BrzaShellSegment): boolean {
  return ghKind(segment) !== null
}

function titleFlag(args: readonly string[]): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index]
    const value =
      word === '--title' || word === '-t'
        ? args[index + 1]
        : word.startsWith('--title=')
          ? word.slice('--title='.length)
          : undefined
    if (value !== undefined) {
      return value.trim() || null
    }
  }
  return null
}

function outputTitle(output: string): string | null {
  const plain = PLAIN_TITLE.exec(output)?.[1].trim()
  if (plain) {
    return plain
  }
  const json = JSON_TITLE.exec(output)?.[1]
  if (!json) {
    return null
  }
  try {
    const title: unknown = JSON.parse(json)
    return typeof title === 'string' && title.trim() ? title.trim() : null
  } catch {
    return null
  }
}

/** Null until the output carries the PR or issue URL. */
export function ghReference(
  segments: readonly BrzaShellSegment[],
  result?: NativeChatToolResultBlock
): GhReference | null {
  const segment = segments.find(isGhReferenceSegment)
  const kind = segment ? ghKind(segment) : null
  if (!segment || !kind || !result || result.isError) {
    return null
  }
  const url = new RegExp(
    `https?://[^\\s/"]+/[^\\s/"]+/[^\\s/"]+/${GH_KINDS[kind].urlPath}/(\\d+)`
  ).exec(result.output)
  if (!url) {
    return null
  }
  const title = titleFlag(segment.argv.slice(2)) ?? outputTitle(result.output)
  return { kind, number: url[1], url: url[0], title }
}

export function ghReferenceTitle(reference: GhReference): string {
  const name = `${GH_KINDS[reference.kind].label} #${reference.number}`
  return reference.title ? `${name} — ${reference.title}` : name
}
