import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Why: a global replace would rewrite the thousands of intentional "Orca" mentions
// (upstream docs, protocol notes, skill guides). Only files whose entire fork diff
// is this one substitution are listed, and only when Vite or Vitest is what loads
// them. The CLI emitter and the WSL guest esbuild read source as-is.
const UPSTREAM_PRODUCT_NAME = 'Orca'
const PRODUCT_NAME = 'BrzA Studio'

// Vite inlines this module into electron.vite.config.ts, so import.meta.dirname
// becomes that bundle's folder. Fall back to the repo config directory.
function overlayFile(name) {
  const candidates = [join(import.meta.dirname, name), join(process.cwd(), 'config', name)]
  const found = candidates.find((path) => existsSync(path))
  if (!found) {
    throw new Error(`brand overlay file not found: ${name}`)
  }
  return found
}

export const productNameFiles = new Set(
  JSON.parse(readFileSync(overlayFile('brand-overlay-files.json'), 'utf8'))
)

export function replaceProductName(source) {
  return source.replaceAll(UPSTREAM_PRODUCT_NAME, PRODUCT_NAME)
}
