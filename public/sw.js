/*
 * Service worker do ORQESTRAI: um só para o site todo (escopo "/").
 *
 * 1. App instalável (PWA): se a navegação falha por falta de internet, mostra a
 *    página offline. Nada de cache de API nem de páginas com dados: o sistema é
 *    todo logado e em tempo real. O único arquivo guardado é /offline.html.
 * 2. Avisos de lead do WhatsApp: recebe o push que a Edge Function
 *    evolution-webhook manda quando chega mensagem de lead.
 *
 * Service worker não toca áudio: com uma aba do sistema aberta, quem toca o som é
 * a página (src/components/layout/whatsapp-lead-notifications.tsx). Sem aba
 * aberta, o próprio aviso do sistema operacional faz o barulho.
 *
 * Navegadores que registraram o nome antigo (/whatsapp-push-sw.js) caem aqui
 * pelo importScripts daquele arquivo até a página registrar /sw.js.
 */

const OFFLINE_CACHE = "orqestrai-offline-v1";
const OFFLINE_URL = "/offline.html";
const ICON = "/pwa/icon-192.png";
const BADGE = "/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-dark.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(OFFLINE_CACHE);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        // Sem a página offline o service worker instala igual: o push não pode parar.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => nome.startsWith("orqestrai-") && nome !== OFFLINE_CACHE)
          .map((nome) => caches.delete(nome))
      );
      // A navegação começa junto com o service worker, sem esperar ele acordar.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

/** Só navegações (abrir/recarregar página). Resto (API, arquivos) vai direto à rede. */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        return await fetch(request);
      } catch {
        const offline = await caches.match(OFFLINE_URL);
        return (
          offline ||
          new Response("Sem conexão com a internet. Confira a rede e tente de novo.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })()
  );
});

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
        badge: BADGE,
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
