// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NativeChatAwaitingInputRow } from './NativeChatAwaitingInputRow'
import { NativeChatDisclosureContext } from './native-chat-disclosure-store'

const OPEN_STORE = { read: () => true, write: () => {}, runScroll: new Map() }

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function renderOpen(ui: React.JSX.Element): void {
  act(() => {
    root.render(
      <NativeChatDisclosureContext.Provider value={OPEN_STORE}>
        {ui}
      </NativeChatDisclosureContext.Provider>
    )
  })
}

describe('NativeChatAwaitingInputRow question text color', () => {
  it('highlights a closed row question with the accent of a chosen option', () => {
    act(() => {
      root.render(
        <NativeChatAwaitingInputRow
          subject={{ kind: 'question', text: 'Qual caminho?' }}
          pending={false}
        />
      )
    })
    const span = [...container.querySelectorAll('span')].find(
      (s) => s.textContent === 'Qual caminho?'
    )
    expect(span?.className).toContain('text-primary')
    expect(span?.className).not.toContain('text-chat-foreground')
  })

  it('highlights the opened question', () => {
    renderOpen(
      <NativeChatAwaitingInputRow
        subject={{ kind: 'question', text: 'Qual caminho?' }}
        pending
        disclosureKey="k"
      />
    )
    const p = container.querySelector('p')
    expect(p?.className).toContain('text-primary')
    expect(p?.className).not.toContain('text-chat-foreground')
  })

  it('highlights the question list and keeps the faint marker', () => {
    renderOpen(
      <NativeChatAwaitingInputRow
        subject={{ kind: 'questions', questions: ['A?', 'B?'] }}
        pending
        disclosureKey="k"
      />
    )
    const ol = container.querySelector('ol')
    expect(ol?.className).toContain('text-primary')
    expect(ol?.className).not.toMatch(/(^|\s)text-chat-foreground(\s|$)/)
    expect(ol?.className).toContain('marker:text-chat-foreground-faint')
  })
})
