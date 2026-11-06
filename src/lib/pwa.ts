/**
 * ORQESTRAI como app instalável (PWA). O manifesto fica em src/app/manifest.ts,
 * o service worker em public/sw.js (o mesmo dos avisos de lead do WhatsApp: um
 * service worker só por site) e o botão "Instalar o ORQESTRAI" no menu da conta.
 *
 * Arquivo sem "use client": o layout (servidor) importa o script de captura.
 */

/** Service worker único do site: página offline + push dos avisos de lead. */
export const APP_SERVICE_WORKER_URL = "/sw.js";

/** Avisa a página que o convite de instalação mudou (chegou, foi usado ou o app foi instalado). */
export const EVENTO_INSTALACAO = "orqestrai:instalacao";

/** Evento do Chrome/Edge que permite abrir a janela de instalação pelo nosso botão. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    /** Convite de instalação guardado pelo CAPTURA_INSTALACAO_SCRIPT. */
    __orqestraiInstalar?: BeforeInstallPromptEvent | null;
  }
}

/**
 * Roda antes do React (next/script beforeInteractive): o navegador pode mandar o
 * beforeinstallprompt cedo, antes da sidebar existir, e ele não se repete.
 * preventDefault tira a barrinha automática do Android; quem oferece é o botão.
 */
export const CAPTURA_INSTALACAO_SCRIPT = `(function(){
if (window.__orqestraiCapturaInstalacao) return;
window.__orqestraiCapturaInstalacao = true;
function avisar(){ window.dispatchEvent(new Event(${JSON.stringify(EVENTO_INSTALACAO)})); }
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__orqestraiInstalar = e;
  avisar();
});
window.addEventListener("appinstalled", function () {
  window.__orqestraiInstalar = null;
  avisar();
});
})();`;

/** Já está rodando como app instalado (janela própria ou tela de início)? */
export function rodandoComoApp(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneIos = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneIos || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Navegadores que instalam mas não têm o beforeinstallprompt: a pessoa segue
 * as instruções do modal. iPhone/iPad (qualquer navegador usa o WebKit) e
 * Safari do Mac (17 em diante, "Adicionar ao Dock").
 */
export type InstrucaoManual = "ios" | "safari-mac";

export function instrucaoManualDeInstalacao(): InstrucaoManual | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const toque = navigator.maxTouchPoints > 1;
  // iPadOS se apresenta como Mac; o toque denuncia.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && toque)) return "ios";
  const safariMac =
    /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/.test(ua);
  const versao = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
  if (safariMac && versao >= 17) return "safari-mac";
  return null;
}

/** Registra o service worker do site; o push dos avisos de lead usa o mesmo. */
export function registrarServiceWorkerDoApp(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(APP_SERVICE_WORKER_URL, { scope: "/" });
}
