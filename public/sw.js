/* QuikForm service worker — Web Push delivery only.
//
// No fetch handling, no caching: this worker exists solely so a
// new-court-mail push can reach the user when the app is closed.
// On push it shows the notification from the payload (sender only,
// never mail content); on click it focuses an existing QuikForm
// tab on the inbox or opens it.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "New court mail";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "quikform-court-mail",
    renotify: true,
    data: { url: data.url || "/dashboard/inbox" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath =
    (event.notification.data && event.notification.data.url) || "/dashboard/inbox";
  const targetUrl = new URL(targetPath, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            if ("navigate" in client) {
              return client.navigate(targetUrl).then((c) => c && c.focus());
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
