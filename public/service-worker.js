// public/service-worker.js
//
// Tombstone service worker.
//
// This app used to register a no-op passthrough service worker here
// (`respondWith(fetch(event.request))`). It provided no benefit, it clobbered
// the next-pwa (workbox) service worker in production by competing for the same
// "/" scope, and in dev it turned a transient cold-compile fetch into a hard
// "site can't be reached" on freshly-added routes.
//
// The manual registration has been removed (next-pwa now owns registration).
// Browsers that still have the old worker registered will fetch this file on
// their next update check, install it, and it will unregister itself and reload
// any open tabs — cleanly retiring the old worker without a manual unregister.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});
