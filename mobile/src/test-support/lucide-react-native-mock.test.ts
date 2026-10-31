import { expect, it, vi } from 'vitest'
import { lucideMock } from './lucide-react-native-mock'

vi.mock('lucide-react-native', async () =>
  (await import('./lucide-react-native-mock')).lucideMock()
)

it('answers a named import of any icon with its own name', async () => {
  const icons: Record<string, unknown> = await import('lucide-react-native')
  expect(icons.Bot).toBe('Bot')
  expect(icons.GlyphThatDoesNotExistYet).toBe('GlyphThatDoesNotExistYet')
})

it('is not mistaken for a thenable or an interop wrapper', () => {
  const mock = lucideMock()
  expect('then' in mock).toBe(false)
  expect(mock.then).toBeUndefined()
  expect('__esModule' in mock).toBe(false)
  expect(mock.createLucideIcon).toBeUndefined()
})

it('lets a test give one icon a value of its own', () => {
  const Copy = (): null => null
  const mock = lucideMock({ Copy })
  expect(mock.Copy).toBe(Copy)
  expect(mock.Bot).toBe('Bot')
  expect(Object.keys(mock)).toEqual(['Copy'])
})
