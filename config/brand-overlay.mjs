import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Why: a global replace would rewrite the thousands of intentional "Orca" mentions
// (upstream docs, protocol notes, skill guides). Only files whose entire fork diff
// is this one substitution are listed, and only when Vite or Vitest is what loads
// them. The CLI emitter and the WSL guest esbuild read source as-is.
const UPSTREAM_PRODUCT_NAME = 'Orca'
const PRODUCT_NAME = 'BrzA Studio'

const overlayDir = import.meta.dirname

export const productNameFiles = new Set(
  JSON.parse(readFileSync(join(overlayDir, 'brand-overlay-files.json'), 'utf8'))
)

export function replaceProductName(source) {
  return source.replaceAll(UPSTREAM_PRODUCT_NAME, PRODUCT_NAME)
}
