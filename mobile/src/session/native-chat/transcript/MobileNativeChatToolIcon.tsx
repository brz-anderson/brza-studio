import {
  Bot,
  Brain,
  Eye,
  Folder,
  Globe,
  ListChecks,
  MessageSquareMore,
  Pencil,
  Plug,
  Search,
  SquareTerminal,
  Wrench,
  type LucideIcon
} from 'lucide-react-native'
import type { NativeChatToolIconName } from '../../../../../src/shared/native-chat/tools/native-chat-tool-icon'
import { BRZA_MOBILE_TOOL_GLYPHS } from './brza/brza-mobile-tool-glyphs'

const GLYPHS: Record<NativeChatToolIconName, LucideIcon> = {
  eye: Eye,
  search: Search,
  folder: Folder,
  'square-terminal': SquareTerminal,
  pencil: Pencil,
  globe: Globe,
  plug: Plug,
  bot: Bot,
  'list-checks': ListChecks,
  wrench: Wrench,
  'message-square-more': MessageSquareMore,
  brain: Brain,
  ...BRZA_MOBILE_TOOL_GLYPHS
}

export function MobileNativeChatToolGlyph({
  name,
  size,
  color
}: {
  name: NativeChatToolIconName
  size: number
  color: string
}): React.JSX.Element {
  const Glyph = GLYPHS[name]
  return <Glyph size={size} color={color} strokeWidth={2} />
}
