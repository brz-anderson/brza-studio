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
  type LucideIcon
} from 'lucide-react-native'
import {
  BRZA_BRAND_LOGO_FALLBACK_ICONS,
  type BrzaLucideIconName,
  type BrzaToolIconName
} from '../../../../../../src/shared/native-chat/tools/brza/brza-tool-categories'

const BRZA_LUCIDE_GLYPHS: Record<BrzaLucideIconName, LucideIcon> = {
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
  'pen-tool': PenTool
}

/** Brand logos are desktop-only (R29.4): mobile draws each one's lucide fallback. */
export const BRZA_MOBILE_TOOL_GLYPHS: Record<BrzaToolIconName, LucideIcon> = {
  ...BRZA_LUCIDE_GLYPHS,
  'git-logo': BRZA_LUCIDE_GLYPHS[BRZA_BRAND_LOGO_FALLBACK_ICONS['git-logo']],
  'github-logo': BRZA_LUCIDE_GLYPHS[BRZA_BRAND_LOGO_FALLBACK_ICONS['github-logo']],
  'jira-logo': BRZA_LUCIDE_GLYPHS[BRZA_BRAND_LOGO_FALLBACK_ICONS['jira-logo']],
  'brza-logo': BRZA_LUCIDE_GLYPHS[BRZA_BRAND_LOGO_FALLBACK_ICONS['brza-logo']]
}
