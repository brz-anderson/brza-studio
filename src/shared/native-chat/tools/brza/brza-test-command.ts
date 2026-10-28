import { stripAnsiEscapeSequences } from '../../../ansi-escape-sequences'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'
import type { BrzaShellSegment } from './brza-shell-segments'

type TestRunner = 'vitest' | 'jest' | 'pytest' | 'flutter test'
type TestCounts = { passed: number; failed: number }

/** Portuguese by decision (R40.3); the title is shared with mobile, outside the renderer catalog. */
const TEST_RESULT_COPY = {
  passedOne: 'passou',
  passedMany: 'passaram',
  failedOne: 'falhou',
  failedMany: 'falharam'
} as const

const PACKAGE_RUNNERS = new Set(['pnpm', 'npm', 'yarn', 'bun', 'npx', 'pnpx', 'bunx'])
const PACKAGE_OPTIONS_WITH_VALUE = new Set([
  '--filter',
  '-F',
  '-C',
  '--dir',
  '--prefix',
  '--workspace'
])
const PACKAGE_RUN_VERBS = new Set(['run', 'exec', 'dlx'])
const DIRECT_RUNNERS = new Set<string>(['vitest', 'jest', 'pytest'])
const RUN_VITEST_SCRIPT = /(?:^|[\\/])run-vitest\.mjs$/

function countWords(text: string): TestCounts {
  const sum = (pattern: RegExp): number =>
    [...text.matchAll(pattern)].reduce((total, match) => total + Number(match[1]), 0)
  return { passed: sum(/(\d+) passed/g), failed: sum(/(\d+) (?:failed|errors?)\b/g) }
}

// Each runner's closing summary; a head-only output (over 16 KiB) has none.
const TEST_FOOTERS: readonly {
  runner: TestRunner
  counts: (output: string) => TestCounts | null
}[] = [
  {
    runner: 'vitest',
    counts: (output) => {
      const line = /^\s*Tests {2,}(.+?)\s*\(\d+\)\s*$/m.exec(output)
      return line ? countWords(line[1]) : null
    }
  },
  {
    runner: 'jest',
    counts: (output) => {
      const line = /^Tests:\s+(.+)$/m.exec(output)
      return line ? countWords(line[1]) : null
    }
  },
  {
    runner: 'pytest',
    counts: (output) => {
      const line = /^=*\s*(\d+ \w+(?:, \d+ \w+)*) in [\d.]+s\b/m.exec(output)
      return line ? countWords(line[1]) : null
    }
  },
  {
    runner: 'flutter test',
    counts: (output) => {
      const line = [
        ...output.matchAll(
          /^\d+:\d+ \+(\d+)(?: ~\d+)?(?: -(\d+))?: (?:All tests passed!|Some tests failed\.)/gm
        )
      ].at(-1)
      return line ? { passed: Number(line[1]), failed: Number(line[2] ?? 0) } : null
    }
  }
]

/** The words a package manager runs, past its own options and `run`/`exec`. */
function packageRunWord(argv: readonly string[]): string | null {
  for (let index = 1; index < argv.length; index += 1) {
    const word = argv[index]
    if (PACKAGE_OPTIONS_WITH_VALUE.has(word)) {
      index += 1
    } else if (!word.startsWith('-') && !PACKAGE_RUN_VERBS.has(word)) {
      return word
    }
  }
  return null
}

/** What a test segment runs: the runner when the command names it, else the package script. */
function testSegmentRun(
  segment: BrzaShellSegment
): { runner: TestRunner; label?: undefined } | { runner: null; label: string } | null {
  const [program, first, second] = segment.argv
  if (DIRECT_RUNNERS.has(program)) {
    return { runner: program === 'jest' ? 'jest' : program === 'pytest' ? 'pytest' : 'vitest' }
  }
  if (program === 'flutter' && first === 'test') {
    return { runner: 'flutter test' }
  }
  if (/^python[\d.]*$/.test(program) && first === '-m' && second === 'pytest') {
    return { runner: 'pytest' }
  }
  if (program === 'node' && segment.argv.some((word) => RUN_VITEST_SCRIPT.test(word))) {
    return { runner: 'vitest' }
  }
  if (!PACKAGE_RUNNERS.has(program)) {
    return null
  }
  const word = packageRunWord(segment.argv)
  if (word === 'vitest' || word === 'jest' || (word !== null && RUN_VITEST_SCRIPT.test(word))) {
    return { runner: word === 'jest' ? 'jest' : 'vitest' }
  }
  return word !== null && /^test(?::|$)/.test(word)
    ? { runner: null, label: `${program} ${word}` }
    : null
}

export function isTestSegment(segment: BrzaShellSegment): boolean {
  return testSegmentRun(segment) !== null
}

function countsText({ passed, failed }: TestCounts): string {
  const parts: string[] = []
  if (passed > 0) {
    parts.push(
      `${passed} ${passed === 1 ? TEST_RESULT_COPY.passedOne : TEST_RESULT_COPY.passedMany}`
    )
  }
  if (failed > 0) {
    parts.push(
      `${failed} ${failed === 1 ? TEST_RESULT_COPY.failedOne : TEST_RESULT_COPY.failedMany}`
    )
  }
  return parts.join(', ')
}

/** `<runner> — 12 passaram, 1 falhou` from the footer, else passed/failed from the exit (R38.2). */
export function testRunTitle(
  segments: readonly BrzaShellSegment[],
  result: NativeChatToolResultBlock | undefined,
  call: NativeChatToolCallBlock
): string | null {
  const run = segments.map(testSegmentRun).find((found) => found !== null)
  if (!run) {
    return null
  }
  const output = result && stripAnsiEscapeSequences(result.output)
  if (output) {
    const footers = TEST_FOOTERS.filter(
      (footer) => run.runner === null || footer.runner === run.runner
    )
    for (const footer of footers) {
      const counts = footer.counts(output)
      if (counts && counts.passed + counts.failed > 0) {
        return `${footer.runner} — ${countsText(counts)}`
      }
    }
  }
  // Claude reports no exit code, only isError.
  const exited = call.exitCode !== undefined
  if (result === undefined && !exited && call.state !== 'failed') {
    return null
  }
  const failed =
    result?.isError === true || (exited && call.exitCode !== 0) || call.state === 'failed'
  const status = failed ? TEST_RESULT_COPY.failedOne : TEST_RESULT_COPY.passedOne
  return `${run.runner ?? run.label} — ${status}`
}
