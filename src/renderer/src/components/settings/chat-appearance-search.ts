import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translateSearchKeyword } from './settings-search-keywords'
import type { SettingsSearchEntry } from './settings-search'
import { formatPrimaryShortcutLabel } from '@/hooks/useShortcutLabel'

export const getChatContrastEntriesByKey = createLocalizedCatalog(
  () =>
    ({
      theme: {
        title: translate('settings.appearance.chat.theme', 'Theme'),
        description: translate(
          'settings.appearance.chat.themeDescription',
          'Colors of the chat: the BrzA default, or any terminal theme.'
        ),
        keywords: [
          translate('settings.appearance.chat.title', 'Chat'),
          ...translateSearchKeyword('settings.appearance.chat.themeKeywordColors', 'colors'),
          ...translateSearchKeyword('settings.appearance.chat.themeKeywordDark', 'dark'),
          ...translateSearchKeyword('settings.appearance.chat.themeKeywordLight', 'light')
        ],
        targetSectionId: 'chat-theme'
      },
      contrast: {
        title: translate('settings.appearance.chat.contrast', 'Contrast'),
        description: translate(
          'settings.appearance.chat.contrastDescription',
          'How bright chat text is against the background. The right end matches the older, brighter look.'
        ),
        targetSectionId: 'chat-contrast'
      }
    }) satisfies Record<string, SettingsSearchEntry>
)

export function getChatContrastSearchEntries(): SettingsSearchEntry[] {
  return Object.values(getChatContrastEntriesByKey())
}

const getChatAppearanceCatalog = createLocalizedCatalog(
  () =>
    ({
      fontFamily: {
        targetSectionId: 'chat-font-family',
        title: translate('settings.appearance.chat.fontFamily', 'Font family'),
        description: translate(
          'settings.appearance.chat.fontFamilyDescription',
          'Font used for messages, activity, and the message box.'
        ),
        keywords: [
          ...translateSearchKeyword('settings.appearance.chat.title', 'Chat'),
          ...translateSearchKeyword('settings.appearance.chat.fontFamily', 'Font family'),
          ...translateSearchKeyword('settings.appearance.chat.fontKeywordTypeface', 'typeface'),
          ...translateSearchKeyword('settings.appearance.chat.fontKeywordTypography', 'typography')
        ]
      },
      textSize: {
        targetSectionId: 'chat-text-size',
        title: translate('settings.appearance.chat.textSize', 'Text size'),
        keywords: [translate('settings.appearance.chat.title', 'Chat')]
      },
      codeTextSize: {
        targetSectionId: 'chat-code-text-size',
        title: translate('settings.appearance.chat.codeTextSize', 'Code text size'),
        description: translate(
          'settings.appearance.chat.codeTextSizeDescription',
          'Code blocks, inline code, commands and tool output.'
        ),
        keywords: [translate('settings.appearance.chat.title', 'Chat')]
      },
      width: {
        targetSectionId: 'chat-width',
        title: translate('settings.appearance.chat.width', 'Width'),
        description: translate(
          'settings.appearance.chat.widthDescription',
          'How wide messages and the message box can grow in a wide pane.'
        ),
        keywords: [
          translate('settings.appearance.chat.title', 'Chat'),
          ...getChatWidthOptions().map((option) => option.label)
        ]
      },
      reset: {
        targetSectionId: 'chat-reset',
        title: translate('settings.appearance.chat.resetAppearance', 'Reset chat appearance'),
        description: translate(
          'settings.appearance.chat.resetDescription',
          'Restore the defaults above.'
        )
      }
    }) satisfies Record<string, SettingsSearchEntry>
)

export function getChatAppearanceEntriesByKey(shortcuts?: { increase: string; decrease: string }) {
  const entries = getChatAppearanceCatalog()
  return {
    ...entries,
    textSize: {
      ...entries.textSize,
      description: translate(
        'settings.appearance.chat.textSizeDescription',
        'Messages, tool activity and the message box. {{increase}} / {{decrease}} in a chat change this too.',
        {
          increase: shortcuts?.increase ?? formatPrimaryShortcutLabel('zoom.in'),
          decrease: shortcuts?.decrease ?? formatPrimaryShortcutLabel('zoom.out')
        }
      )
    }
  }
}

export function getChatAppearanceSearchEntries(): SettingsSearchEntry[] {
  return [
    { title: translate('auto.components.settings.Settings.2b4474780a', 'Appearance') },
    ...Object.values(getChatAppearanceEntriesByKey()),
    ...getChatContrastSearchEntries()
  ]
}

export function getChatWidthOptions() {
  return [
    {
      value: 'comfortable',
      label: translate('settings.appearance.chat.comfortable', 'Comfortable')
    },
    { value: 'wide', label: translate('settings.appearance.chat.wide', 'Wide') },
    { value: 'full', label: translate('settings.appearance.chat.full', 'Full') }
  ] as const
}
