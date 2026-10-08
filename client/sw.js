// Service worker: Web Push display + notification click routing.
// ponytail: no fetch handler on purpose — nothing is cached offline.
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(data.title || 'Juego de la Papa', {
            body: data.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: data.url || 'papa-online',
            data: { url: data.url || '/' },
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        (async () => {
            const clientList = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            return self.clients.openWindow(event.notification.data?.url || '/');
        })(),
    );
});
