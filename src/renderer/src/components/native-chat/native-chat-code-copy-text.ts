/** The fence's own closing newline is not part of what the reader copies or runs. */
export function nativeChatCodeCopyText(code: string): string {
  return code.replace(/\r?\n$/, '')
}
