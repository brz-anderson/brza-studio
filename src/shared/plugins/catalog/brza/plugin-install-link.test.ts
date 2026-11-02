import { describe, expect, it } from 'vitest'
import { isRoutedOrcaDeepLink } from '../../../../main/startup/orca-deep-link-url'
import {
  isPluginInstallLinkArgument,
  parsePluginInstallLink,
  pluginInstallLinkFromArguments
} from '../plugin-install-link'

// BrzA Studio registers brza-studio:// with the OS; orca:// links from the upstream directory still parse.
describe('plugin install links under both schemes', () => {
  it.each(['orca', 'brza-studio'])('parses a %s:// link the same way', (scheme) => {
    expect(parsePluginInstallLink(`${scheme}://plugins/acme.dusk`)).toEqual({
      pluginKey: 'acme.dusk',
      catalog: { kind: 'official' }
    })
    expect(parsePluginInstallLink(`${scheme}://plugins/acme.dusk?catalog=community`)).toMatchObject(
      { pluginKey: 'acme.dusk', catalog: { kind: 'community' } }
    )
  })

  it('still rejects what is malformed under either scheme', () => {
    expect(parsePluginInstallLink('brza-studio://plugins/not valid')).toBeNull()
    expect(parsePluginInstallLink('brza-studio://plugins/acme.dusk?x=1')).toBeNull()
    expect(parsePluginInstallLink('brza-studio://skills/share/abc')).toBeNull()
    expect(parsePluginInstallLink('other://plugins/acme.dusk')).toBeNull()
  })

  it('recognises a brza-studio:// plugin link in argv and routes it on macOS', () => {
    const link = 'brza-studio://plugins/acme.dusk?catalog=community'
    expect(isPluginInstallLinkArgument(link)).toBe(true)
    expect(isPluginInstallLinkArgument('brza-studio://pluginsx')).toBe(false)
    expect(pluginInstallLinkFromArguments(['/app', '--flag', link])).toBe(link)
    expect(isRoutedOrcaDeepLink(link)).toBe(true)
    expect(isRoutedOrcaDeepLink('orca://plugins/acme.dusk')).toBe(true)
  })
})
