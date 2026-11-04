import { RuntimeClientError } from '../runtime-client'

export const CHAT_OPERATION_ID_PATTERN = /^\d{13}-[0-9a-f]{32}$/

export function parseChatOperationId(value: string): string {
  if (CHAT_OPERATION_ID_PATTERN.exec(value)?.[0] !== value) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--operation must contain 13 timestamp digits, a hyphen and 32 lowercase hexadecimal digits.'
    )
  }
  return value
}
