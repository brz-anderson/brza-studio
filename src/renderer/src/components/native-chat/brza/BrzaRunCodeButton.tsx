import { useContext } from 'react'
import { Play } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { NativeChatMarkdownImageOwnerContext } from '../media/images/native-chat-markdown-image-owner'
import {
  isRunnableShellLanguage,
  runCodeInNewTerminalTab,
  shellCommandFromCodeBlock
} from './brza-run-code-in-terminal'

/** Sits beside Copy on shell fences; runs the block in a new terminal of the chat's worktree. */
export function BrzaRunCodeButton({
  code,
  language
}: {
  code: string
  language?: string
}): React.JSX.Element | null {
  const t = useTranslate()
  const context = useContext(NativeChatMarkdownImageOwnerContext)?.fileLinkContext
  if (!context || !language || !isRunnableShellLanguage(language)) {
    return null
  }
  const label = t('brza.native-chat.runInTerminal', 'Run in terminal')
  return (
    <button
      type="button"
      onClick={() =>
        runCodeInNewTerminalTab({
          command: shellCommandFromCodeBlock(code, language),
          worktreeId: context.worktreeId,
          sourceTabId: context.sourceTabId,
          cwd: context.worktreePath
        })
      }
      aria-label={label}
      title={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-chat-foreground-faint transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Play className="size-3.5" />
    </button>
  )
}
