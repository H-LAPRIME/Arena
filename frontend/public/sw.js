// Service Worker - gere l'affichage des notifications push et le clic dessus

self.addEventListener("push", (event) => {
  let data = { title: "Efootball Arena", body: "Nouvelle notification", url: "/admin/claims" };
  try {
    data = event.data.json();
  } catch (e) {
    // fallback si le payload n'est pas du JSON
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/next.svg",
      badge: "/next.svg",
      data: { url: data.url || "/admin/claims" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/admin/claims";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si un onglet du site est deja ouvert, on le focus et on navigue dessus
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Sinon on ouvre un nouvel onglet
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
