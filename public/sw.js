// PadelTrack service worker: shows phone notifications and opens the right
// page when one is tapped. Registered by src/components/shared/PushToggle.tsx.
self.addEventListener('push', event => {
  let data = { title: 'PadelTrack', body: '', url: '/' }
  try { data = { ...data, ...event.data.json() } } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const open = windows.find(w => w.url.startsWith(self.location.origin))
      if (open) return open.navigate(url).then(w => (w || open).focus())
      return self.clients.openWindow(url)
    })
  )
})
