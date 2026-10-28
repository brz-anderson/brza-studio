import type { BrzaToolIconName } from './brza-tool-categories'
import type { BrzaShellSegment } from './brza-shell-segments'

const PACKAGE_RUNNERS = new Set(['pnpm', 'npm', 'yarn', 'bun', 'npx', 'pnpx', 'bunx'])
const PACKAGE_MANAGERS = new Set(['pnpm', 'npm', 'yarn', 'bun'])
const PACKAGE_OPTIONS_WITH_VALUE = new Set([
  '--filter',
  '-F',
  '-C',
  '--dir',
  '--prefix',
  '--workspace'
])
const PACKAGE_RUN_VERBS = new Set(['run', 'exec', 'dlx'])
const INSTALL_WORDS = new Set(['install', 'i', 'ci', 'add'])
const BUILD_SCRIPT = /^build(?::|$)/

/** The script or binary a package manager runs, past its own options and `run`/`exec`. */
export function packageRunWord(segment: BrzaShellSegment): string | null {
  const { argv } = segment
  if (!PACKAGE_RUNNERS.has(argv[0])) {
    return null
  }
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

/** Package on install, add and `pub get`; Hammer on a build (R43.1); null for anything else. */
export function packageSegmentIconName(segment: BrzaShellSegment): BrzaToolIconName | null {
  const [program, first, second] = segment.argv
  if (program === 'flutter' || program === 'dart') {
    if (first === 'pub' && (second === 'get' || second === 'add')) {
      return 'package'
    }
    return program === 'flutter' && first === 'build' ? 'hammer' : null
  }
  if (!PACKAGE_MANAGERS.has(program)) {
    return null
  }
  const word = packageRunWord(segment)
  if (word === null) {
    return null
  }
  return INSTALL_WORDS.has(word) ? 'package' : BUILD_SCRIPT.test(word) ? 'hammer' : null
}

export function isPackageSegment(segment: BrzaShellSegment): boolean {
  return packageSegmentIconName(segment) !== null
}
