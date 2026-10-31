import type { CapacitorConfig } from '@capacitor/cli'

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
  ios: {
    // The site pads itself for the notch and home bar (safe-area insets).
    contentInset: 'never',
    backgroundColor: '#18181b',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, launchAutoHide: false, backgroundColor: '#18181b', showSpinner: false },
    PushNotifications: { presentationOptions: ['banner', 'sound', 'badge'] },
  },
}

export default config
