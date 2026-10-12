// Sends a browser error to /api/errors for the admin page. In production,
// server-rendering errors reach the browser as a generic message plus a
// `digest` that matches the server-side entry.
export function reportError(error: Error & { digest?: string }) {
  fetch('/api/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: location.pathname }),
    keepalive: true,
  }).catch(() => {})
}
