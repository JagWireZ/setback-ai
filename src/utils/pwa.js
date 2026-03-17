import { useEffect, useState } from 'react'

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function usePwaInstall() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null)
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplayMode())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const displayModeMediaQuery = window.matchMedia?.('(display-mode: standalone)')

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPromptEvent(event)
    }

    const handleInstalled = () => {
      setInstallPromptEvent(null)
      setIsInstalled(true)
    }

    const handleDisplayModeChange = () => {
      setIsInstalled(isStandaloneDisplayMode())
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    displayModeMediaQuery?.addEventListener?.('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      displayModeMediaQuery?.removeEventListener?.('change', handleDisplayModeChange)
    }
  }, [])

  const promptToInstall = async () => {
    if (!installPromptEvent) {
      return false
    }

    await installPromptEvent.prompt()
    const outcome = await installPromptEvent.userChoice

    if (outcome?.outcome !== 'accepted') {
      return false
    }

    setInstallPromptEvent(null)
    return true
  }

  return {
    canInstall: Boolean(installPromptEvent) && !isInstalled,
    isInstalled,
    promptToInstall,
  }
}
