import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

// The iPhone app (ios/): a native shell that loads the live site, so web
// deploys reach the app without an App Store update. Native extras — push
// notifications, the share sheet, links opening in the app — are wired up in
// src/lib/native.ts and src/components/shared/NativeBridge.tsx.
//
// After changing this file or adding a plugin: npx cap sync ios
const config: CapacitorConfig = {
  appId: 'uk.co.padeltrack.app',
  appName: 'PadelTrack',
  // Only the offline screen ships in the app; everything else is the site.
  webDir: 'mobile/www',
  server: {
    url: 'https://www.padeltrack.co.uk',
    errorPath: 'offline.html',
  },
  // Lets the site tell the app from Safari (the middleware sends the app
  // straight to sign-in rather than the welcome page).
  appendUserAgent: 'PadelTrackApp',
  ios: {
    // The site pads itself for the notch and home bar (safe-area insets).
    contentInset: 'never',
    backgroundColor: '#18181b',
  },
  plugins: {
    // The logo stays up until the site has loaded and hides it (NativeBridge,
    // or the offline screen).
    SplashScreen: { launchShowDuration: 3000, launchAutoHide: false, backgroundColor: '#18181b', showSpinner: false },
    PushNotifications: { presentationOptions: ['banner', 'sound', 'badge'] },
    // The keyboard shrinks the page instead of pushing it up, so the header
    // stays below the clock and bottom bars sit just above the keyboard.
    Keyboard: { resize: KeyboardResize.Native, resizeOnFullScreen: true },
  },
}

export default config
