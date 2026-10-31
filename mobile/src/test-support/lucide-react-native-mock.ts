// A stand-in for 'lucide-react-native' that answers for any icon, so a test's mock does not go stale when a
// component starts importing a new glyph. An icon is its own name as a host element type ('Bot' renders
// <Bot />), which lets a test find it with `String(node.type) === 'Bot'` or findAllByHostType.
//
// Use it through a dynamic import, because `vi.mock` is hoisted above the file's imports:
//   vi.mock('lucide-react-native', async () => (await import('<path>/test-support/lucide-react-native-mock')).lucideMock())
// A test that needs a particular icon to render something else passes it: `lucideMock({ Copy: () => null })`.
export function lucideMock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const isIconName = (key: string | symbol): key is string =>
    typeof key === 'string' && /^[A-Z]/.test(key)
  return new Proxy(
    { ...overrides },
    {
      // Vitest's own mock module throws on a key the factory did not return, and asks `in` before reading.
      has: (target, key) => key in target || isIconName(key),
      get: (target, key) =>
        typeof key === 'string' && key in target ? target[key] : isIconName(key) ? key : undefined
    }
  )
}
