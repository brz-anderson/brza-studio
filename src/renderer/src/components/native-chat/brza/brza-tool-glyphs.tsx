import { forwardRef } from 'react'
import {
  BookOpen,
  Flame,
  FlaskConical,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Hammer,
  Package,
  PenTool,
  Sparkles,
  SquareKanban,
  type LucideIcon,
  type LucideProps
} from 'lucide-react'
import type { BrzaToolIconName } from '../../../../../shared/native-chat/tools/brza/brza-tool-categories'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { JiraIcon } from '@/components/icons/JiraIcon'
import { BrzaGitLogo } from './BrzaGitLogo'

/** Fits a className-only brand logo into the lucide-typed glyph table; the slot never takes a ref. */
function brandGlyph(Logo: (props: { className?: string }) => React.JSX.Element): LucideIcon {
  return forwardRef<SVGSVGElement, LucideProps>(function BrandGlyph({ className }, _ref) {
    return <Logo className={className} />
  })
}

/** Desktop glyphs for BrzA icon ids; brand ids draw the logo, which mobile replaces with a lucide fallback. */
export const BRZA_TOOL_GLYPHS: Record<BrzaToolIconName, LucideIcon> = {
  'git-branch': GitBranch,
  'git-commit-horizontal': GitCommitHorizontal,
  'git-pull-request': GitPullRequest,
  'flask-conical': FlaskConical,
  package: Package,
  hammer: Hammer,
  sparkles: Sparkles,
  flame: Flame,
  'book-open': BookOpen,
  'square-kanban': SquareKanban,
  'pen-tool': PenTool,
  'git-logo': brandGlyph(BrzaGitLogo),
  'github-logo': brandGlyph(GitHubIcon),
  'jira-logo': brandGlyph(JiraIcon)
}
