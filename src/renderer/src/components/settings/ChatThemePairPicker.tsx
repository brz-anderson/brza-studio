import { useState } from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { NATIVE_CHAT_THEME_BRZA_DEFAULT } from '../../../../shared/native-chat-appearance-settings'
import {
  resolveNativeChatThemePair,
  type NativeChatThemePair
} from '../../../../shared/native-chat-theme'
import { getAvailableTerminalThemeOptions, type TerminalThemeOption } from '@/lib/terminal-theme'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useSystemPrefersDark } from '../terminal-pane/use-system-prefers-dark'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSwitchRow,
  ThemePicker
} from './SettingsFormControls'

type ThemeTarget = 'dark' | 'light'

export type ChatThemePairPickerProps = {
  title: string
  description: string
  pair: Required<NativeChatThemePair>
  settings: Pick<GlobalSettings, 'theme' | 'terminalCustomThemes'>
  onChange: (updates: NativeChatThemePair) => void
  disabled?: boolean
}

/** The chat theme catalog (the BrzA default plus the terminal themes) as a dark and light pair. */
export function ChatThemePairPicker({
  title,
  description,
  pair,
  settings,
  onChange,
  disabled = false
}: ChatThemePairPickerProps): React.JSX.Element {
  const systemPrefersDark = useSystemPrefersDark()
  const appMode =
    settings.theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : settings.theme
  const [target, setTarget] = useState<ThemeTarget>(appMode)
  const [query, setQuery] = useState('')
  const isLightTarget = target === 'light'
  const showPicker = !isLightTarget || pair.useSeparateLightTheme
  const defaultPreview = resolveNativeChatThemePair(
    undefined,
    { ...settings, theme: target },
    target === 'dark'
  )
  const themeOptions: TerminalThemeOption[] = [
    {
      value: NATIVE_CHAT_THEME_BRZA_DEFAULT,
      label: translate('settings.appearance.chat.themeDefault', 'BrzA default'),
      group: 'built-in',
      previewTheme: { ...defaultPreview.palette, background: defaultPreview.canvas }
    },
    ...getAvailableTerminalThemeOptions(settings)
  ]
  const pickerTitle = isLightTarget
    ? translate('settings.appearance.chat.themeLight', 'Light theme')
    : translate('settings.appearance.chat.themeDark', 'Dark theme')
  const pickerDescription = isLightTarget
    ? translate(
        'settings.appearance.chat.themeLightDescription',
        'Used while BrzA Studio is in light mode.'
      )
    : translate(
        'settings.appearance.chat.themeDarkDescription',
        'Used in dark mode, and in light mode without a separate light theme.'
      )

  return (
    <div
      className={cn('space-y-3 py-3', disabled && 'pointer-events-none opacity-50')}
      aria-disabled={disabled || undefined}
      inert={disabled}
    >
      <SettingsRow
        label={title}
        description={description}
        control={
          <SettingsSegmentedControl
            value={target}
            onChange={setTarget}
            ariaLabel={title}
            options={[
              {
                value: 'dark',
                label: translate(
                  'auto.components.settings.TerminalThemeSections.target_dark',
                  'Dark'
                )
              },
              {
                value: 'light',
                label: translate(
                  'auto.components.settings.TerminalThemeSections.target_light',
                  'Light'
                )
              }
            ]}
          />
        }
      />
      {isLightTarget ? (
        <SettingsSwitchRow
          label={translate('settings.appearance.chat.separateLightTheme', 'Separate light theme')}
          description={translate(
            'settings.appearance.chat.separateLightThemeDescription',
            'Off uses the dark theme in light mode too.'
          )}
          checked={pair.useSeparateLightTheme}
          onChange={() => onChange({ useSeparateLightTheme: !pair.useSeparateLightTheme })}
        />
      ) : null}
      {showPicker ? (
        <ThemePicker
          label={pickerTitle}
          description={pickerDescription}
          selectedTheme={isLightTarget ? pair.themeLight : pair.themeDark}
          themeOptions={themeOptions}
          query={query}
          onQueryChange={setQuery}
          onSelectTheme={(theme) =>
            onChange(isLightTarget ? { themeLight: theme } : { themeDark: theme })
          }
        />
      ) : null}
    </div>
  )
}
