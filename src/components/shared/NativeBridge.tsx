'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { App } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNativeApp, saveToken } from '@/lib/native'

// Runs only inside the iPhone app: hides the splash screen once the site has
// loaded, keeps the status bar light on the dark header, opens the right page
// when a notification or a padeltrack.co.uk link is tapped, and refreshes this
// phone's notification token on each launch.
export default function NativeBridge() {
  const router = useRouter()

  useEffect(() => {
    if (!isNativeApp()) return
    void SplashScreen.hide()
    void StatusBar.setStyle({ style: Style.Dark })

    // Only paths on this site; anything else is ignored.
    const open = (raw: unknown) => {
      if (typeof raw !== 'string') return
      try {
        const u = new URL(raw, window.location.origin)
        if (u.origin === window.location.origin || /(^|\.)padeltrack\.co\.uk$/.test(u.hostname)) router.push(u.pathname + u.search)
      } catch {}
    }
    const handles = [
      PushNotifications.addListener('pushNotificationActionPerformed', e => open(e.notification.data?.url)),
      App.addListener('appUrlOpen', e => open(e.url)),
      PushNotifications.addListener('registration', t => void saveToken(t.value)),
    ]
    void PushNotifications.checkPermissions().then(p => { if (p.receive === 'granted') void PushNotifications.register() })
    return () => { handles.forEach(h => void h.then(x => x.remove())) }
  }, [router])

  return null
}
