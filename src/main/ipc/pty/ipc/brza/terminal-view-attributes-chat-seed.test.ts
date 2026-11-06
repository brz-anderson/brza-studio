import { afterEach, describe, expect, it } from 'vitest'
import { getDefaultSettings } from '../../../../../shared/constants'
import type { TerminalOscColorQueryReplyColors } from '../../../../../shared/terminal/protocol/queries/terminal-osc-color-reply'
import { LocalPtyProvider } from '../../../../providers/local-pty/local-pty-provider'
import { _resetTerminalViewAttributesForTest } from '../../../../runtime/terminal/view/terminal-view-attribute-store'
import {
  _resetColorQueryReplyColorsForTest,
  getLocalPtyProvider,
  setLocalPtyProvider
} from '../../provider/registry'
import { installTerminalViewAttributesIpc } from '../terminal-view-attributes-ipc'

class RecordingProvider extends LocalPtyProvider {
  readonly pushes: TerminalOscColorQueryReplyColors[] = []

  override setColorQueryReplyColors(colors: TerminalOscColorQueryReplyColors): void {
    this.pushes.push(colors)
  }
}

describe('seeding PTY owner colours while the terminal follows the chat', () => {
  const originalLocal = getLocalPtyProvider()
  const settings = { ...getDefaultSettings('/tmp'), theme: 'dark' as const }

  afterEach(() => {
    _resetTerminalViewAttributesForTest()
    _resetColorQueryReplyColorsForTest()
    setLocalPtyProvider(originalLocal)
  })

  it('seeds the chat canvas', () => {
    const owner = new RecordingProvider()
    setLocalPtyProvider(owner)

    installTerminalViewAttributesIpc({
      getSettings: () => ({ ...settings, terminalFollowsChatTheme: true })
    })

    expect(owner.pushes).toEqual([{ foreground: '#fafafa', background: '#161616' }])
  })

  it('seeds the saved terminal theme when it does not follow the chat', () => {
    const owner = new RecordingProvider()
    setLocalPtyProvider(owner)

    installTerminalViewAttributesIpc({
      getSettings: () => ({ ...settings, terminalFollowsChatTheme: false })
    })

    expect(owner.pushes).toEqual([{ foreground: '#ffffff', background: '#282c34' }])
  })
})
