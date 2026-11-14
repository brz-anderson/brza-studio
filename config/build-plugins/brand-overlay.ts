import { relative, sep } from 'node:path'
import type { Plugin } from 'vite'
import { productNameFiles, replaceProductName } from '../brand-overlay.mjs'

function repoPath(id: string): string {
  const file = id.split('?')[0]
  return relative(process.cwd(), file).split(sep).join('/')
}

/** Restores the product name in modules whose git text matches upstream. */
export function brandOverlayPlugin(): Plugin {
  return {
    name: 'brza-brand-overlay',
    enforce: 'pre',
    transform(code, id) {
      if (!productNameFiles.has(repoPath(id)) || !code.includes('Orca')) {
        return null
      }
      return { code: replaceProductName(code) }
    }
  }
}
