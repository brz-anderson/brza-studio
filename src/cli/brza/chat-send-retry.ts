import { quoteStartupArg } from '../../shared/agent-launch/startup/tui-agent-startup-shell'

export function formatChatSendRetry(session: string, text: string, operation: string): string {
  const shell = process.platform === 'win32' ? 'powershell' : 'posix'
  return `retry without resending: orca chat send --session ${quoteStartupArg(session, shell)} --text ${quoteStartupArg(text, shell)} --operation ${quoteStartupArg(operation, shell)}`
}
