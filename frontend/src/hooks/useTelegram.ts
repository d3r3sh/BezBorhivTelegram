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

