import { runsOrcaCliCommand } from '../../../orca-browser-cli-commands'
import type { BrzaToolCategoryDefinition } from './brza-tool-categories'
import { isGitCommitSegment } from './brza-git-command'
import { isGhReferenceSegment } from './brza-gh-command'

/** Heaviest first: in a compound command, the first category any segment matches wins (R37.1). */
export const BRZA_SHELL_CATEGORIES = [
  { category: 'gh', iconName: 'git-pull-request', matchesCommand: isGhReferenceSegment },
  {
    category: 'git',
    iconName: 'git-logo',
    matchesCommand: ({ argv }) => argv[0] === 'git',
    segmentIconName: (segment) => (isGitCommitSegment(segment) ? 'git-commit-horizontal' : null)
  },
  {
    category: 'brzaCli',
    iconName: 'brza-logo',
    // `brza`, or `orca` on the terminal PATH.
    matchesCommand: ({ text }) => runsOrcaCliCommand(text)
  }
] as const satisfies readonly BrzaToolCategoryDefinition[]
