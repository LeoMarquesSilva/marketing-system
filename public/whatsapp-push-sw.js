/*
 * Service worker dos avisos de lead do WhatsApp (ORQESTRAI). Recebe o push que a
 * Edge Function evolution-webhook manda quando chega mensagem de lead.
 *
 * Service worker não toca áudio: com uma aba do sistema aberta, quem toca o som é
 * a página (src/components/layout/whatsapp-lead-notifications.tsx). Sem aba
 * aberta, o próprio aviso do sistema operacional faz o barulho.
 */

const ICON = "/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-dark.png";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** Pede à aba que toque o som e espera a resposta (aba sem clique ainda não toca). */
function askToChime(client, data) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), 1000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(Boolean(event.data && event.data.played));
    };
    client.postMessage({ ...data, type: "whatsapp-lead" }, [channel.port2]);
  });
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Mensagem no WhatsApp", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Uma aba só toca o som: com várias abertas, não toca várias vezes.
      const focused = windows.find((client) => client.focused);
      const target =
        focused || windows.find((client) => client.visibilityState === "visible") || windows[0];
      const played = target ? await askToChime(target, data) : false;

      // Aba em foco: a página já tocou o som e mostrou o aviso dela.
      if (played && focused) return;

      await self.registration.showNotification(data.title || "Mensagem no WhatsApp", {
        body: data.body || "",
        icon: ICON,
        badge: ICON,
        tag: data.conversationId ? `whatsapp-${data.conversationId}` : "whatsapp-lead",
        renotify: true,
        // O som já tocou pela página; sem aba, fica o som do sistema.
        silent: played,
        data: { url: data.url || "/trafego-pago" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/trafego-pago";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((c) => c.focused) || windows[0];
      if (client) {
        await client.focus();
        client.postMessage({ type: "whatsapp-open", url });
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
