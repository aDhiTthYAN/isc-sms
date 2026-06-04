importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCj95Mv7stlz-owyiaj4yo_0DH3qzS4l0E",
  authDomain: "isc-sms-test.firebaseapp.com",
  projectId: "isc-sms-test",
  storageBucket: "isc-sms-test.firebasestorage.app",
  messagingSenderId: "4958345315",
  appId: "1:4958345315:web:77c9a7543fb5ae31f74056",
});

const messaging = firebase.messaging();

// Show notification when app is in background
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'ISC Notification', {
    body: body || '',
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
  });
});

// Open app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
