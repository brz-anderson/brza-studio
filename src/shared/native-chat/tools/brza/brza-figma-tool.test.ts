import { describe, expect, it } from 'vitest'
import { nativeChatToolIconName } from '../native-chat-tool-icon'
import { nativeChatToolLineLabel } from '../native-chat-tool-line-label'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'

const identity = { server: 'plugin_figma_figma', tool: 'get_metadata' }

function figmaCall(tool: string, input: unknown): NativeChatToolCallBlock {
  return {
    type: 'tool-call',
    name: `mcp__plugin_figma_figma__${tool}`,
    input,
    state: 'completed',
    mcpIdentity: { ...identity, tool }
  }
}

function result(output: string, isError = false): NativeChatToolResultBlock {
  return { type: 'tool-result', output, isError }
}

describe('BrzA Figma tool line', () => {
  it('gives the Figma MCP the pen-tool icon', () => {
    expect(nativeChatToolIconName('mcp__plugin_figma_figma__get_metadata', identity)).toBe(
      'pen-tool'
    )
  })

  it('names the node from a get_metadata output', () => {
    const output =
      '<canvas id="0:1" name="Páginas"><frame id="1284:307" name="Login &amp; Cadastro" x="0" y="0"><text id="1:9" name="Título" /></frame></canvas>'
    const label = nativeChatToolLineLabel(
      figmaCall('get_metadata', { fileKey: 'abc', nodeId: '1284:307' }),
      result(output)
    )
    expect(label).toMatchObject({
      target: 'Login & Cadastro',
      title: 'Figma · Login & Cadastro',
      filePath: null
    })
  })

  it('names the node from a get_design_context output', () => {
    const output =
      'export default function Card() {\n  return <div className="flex" data-name="Card de preço" data-node-id="12:34"><span data-name="Rótulo" data-node-id="12:35" /></div>\n}'
    const label = nativeChatToolLineLabel(
      figmaCall('get_design_context', { nodeId: '12-34' }),
      result(output)
    )
    expect(label.title).toBe('Figma · Card de preço')
  })

  it('falls back to the nodeId when the output has no name', () => {
    const input = { fileKey: 'abc', nodeId: '1284:307' }
    for (const output of [undefined, result(''), result('Erro de rede', true)]) {
      const label = nativeChatToolLineLabel(figmaCall('get_screenshot', input), output)
      expect(label).toMatchObject({ target: '1284:307', title: 'Figma · 1284:307' })
    }
  })

  it('falls back to the default line with neither a name nor a nodeId', () => {
    const label = nativeChatToolLineLabel(figmaCall('whoami', {}), result('{"email":"a@b.c"}'))
    expect(label.title).not.toContain('Figma ·')
  })

  it('does not take the name of a node other than the one asked for', () => {
    const output = '<frame id="1:1" name="Outro"><frame id="2:2" name="Pedido" /></frame>'
    const label = nativeChatToolLineLabel(
      figmaCall('get_metadata', { nodeId: '2:2' }),
      result(output)
    )
    expect(label.title).toBe('Figma · Pedido')
  })
})
