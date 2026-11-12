// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatApprovalCard } from '../prompts/NativeChatApprovalCard'

afterEach(cleanup)

describe('the approval card folded to a strip (P69/P70)', () => {
  it('with both cancel and collapse, shows the X and the chevron, and Escape collapses', () => {
    const onCancel = vi.fn()
    const onCollapse = vi.fn()
    render(
      <TooltipProvider>
        <NativeChatApprovalCard
          approval={{ title: 'Allow command?', options: [{ label: 'Allow', send: 'allow' }] }}
          onChoose={() => {}}
          onCancel={onCancel}
          onCollapse={onCollapse}
        />
      </TooltipProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(onCollapse).toHaveBeenCalledOnce()
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Escape' })
    expect(onCollapse).toHaveBeenCalledTimes(2)
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
