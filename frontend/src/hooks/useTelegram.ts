import { useEffect, useCallback } from 'react'
import WebApp from '@twa-dev/sdk'

/** Initialize Telegram WebApp on mount. */
export function useTelegramReady() {
  useEffect(() => {
    WebApp.ready()
  }, [])
}

/** Show/hide the Telegram BackButton and attach a handler. */
export function useBackButton(onBack: () => void) {
  const handler = useCallback(onBack, [onBack])

  useEffect(() => {
    WebApp.BackButton.show()
    WebApp.BackButton.onClick(handler)
    return () => {
      WebApp.BackButton.offClick(handler)
      WebApp.BackButton.hide()
    }
  }, [handler])
}

/** Expose Telegram theme colors as CSS variables. */
export function useTelegramTheme() {
  useEffect(() => {
    const p = WebApp.themeParams as unknown as Record<string, string>
    if (!p) return
    const root = document.documentElement
    if (p.bg_color) root.style.setProperty('--tg-theme-bg-color', p.bg_color)
    if (p.text_color) root.style.setProperty('--tg-theme-text-color', p.text_color)
    if (p.button_color) root.style.setProperty('--tg-theme-button-color', p.button_color)
  }, [])
}
