import { describe, expect, it, vi } from 'vitest'

vi.mock('lucide-react-native', () => ({
  BookOpen: 'BookOpen',
  FileText: 'FileText',
  Flame: 'Flame',
  FlaskConical: 'FlaskConical',
  GitBranch: 'GitBranch',
  GitCommitHorizontal: 'GitCommitHorizontal',
  GitPullRequest: 'GitPullRequest',
  Hammer: 'Hammer',
  Package: 'Package',
  PenTool: 'PenTool',
  Sparkles: 'Sparkles',
  SquareKanban: 'SquareKanban'
}))

import { BRZA_MOBILE_TOOL_GLYPHS } from './brza-mobile-tool-glyphs'

describe('BRZA_MOBILE_TOOL_GLYPHS', () => {
  it('draws each desktop brand logo as its lucide fallback (X10)', () => {
    expect(BRZA_MOBILE_TOOL_GLYPHS['git-logo']).toBe('GitBranch')
    expect(BRZA_MOBILE_TOOL_GLYPHS['github-logo']).toBe('GitPullRequest')
    expect(BRZA_MOBILE_TOOL_GLYPHS['jira-logo']).toBe('SquareKanban')
  })
})
