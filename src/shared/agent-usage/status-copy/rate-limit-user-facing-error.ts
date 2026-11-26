import { KNOWN_RATE_LIMIT_ERRORS } from './rate-limit-user-facing-error-catalog'
import type { UsageCopyTranslate } from './usage-copy-translate'

export function formatRateLimitUserFacingError(
  raw: string | null | undefined,
  t: UsageCopyTranslate
): string {
  if (!raw?.trim()) {
    return ''
  }
  const message = raw.trim()
  // Why: the Grok fetcher emits "BrzA Studio"; the catalog keeps the upstream "Orca" spelling.
  const comparable = message.replace(/BrzA Studio/g, 'Orca')
  const invalidWorkspace = message.match(/^Invalid workspace ID format:(.*)$/i)
  if (invalidWorkspace) {
    return `${t('auto.lib.rateLimits.errors.opencodeInvalidWorkspaceId', 'Invalid workspace ID format')}:${invalidWorkspace[1]}`
  }
  for (const known of KNOWN_RATE_LIMIT_ERRORS) {
    if (typeof known.test === 'string') {
      if (comparable === known.test) {
        return t(known.key, known.fallback)
      }
      // Why: macOS Tailscale DNS hint appends after the base English error.
      if (comparable.startsWith(`${known.test} `)) {
        return `${t(known.key, known.fallback)}${comparable.slice(known.test.length)}`
      }
      continue
    }
    const match = comparable.match(known.test)
    if (match) {
      return t(known.key, known.fallback, known.vars?.(match))
    }
  }
  return message
}
