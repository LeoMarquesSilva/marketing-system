import json
import sys
import time

from browser_harness.admin import ensure_daemon
from browser_harness.helpers import (
    capture_screenshot,
    cdp,
    goto_url,
    js,
    list_tabs,
    new_tab,
    press_key,
    switch_tab,
    wait_for_element,
    wait_for_load,
)


sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ensure_daemon()

LOCAL_URL = "http://localhost:3000/minhas-fotos"
SESSION_KEY = "minhas-fotos-tutorial-pending"

tab = next(
    (candidate for candidate in list_tabs() if candidate["url"].startswith(LOCAL_URL)),
    None,
)
if tab is None:
    tab = new_tab(LOCAL_URL)
switch_tab(tab)
wait_for_load()

results = {"url": LOCAL_URL, "checks": {}, "steps": [], "screenshots": []}

# Caso sem fotos: intercepta somente o GET da galeria antes do React iniciar.
js(f"sessionStorage.removeItem({json.dumps(SESSION_KEY)})")
injected = cdp(
    "Page.addScriptToEvaluateOnNewDocument",
    source="""
(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    const method = (init?.method ?? (typeof input === "string" ? "GET" : input?.method) ?? "GET").toUpperCase();
    if (method === "GET" && url === "/api/collaborator-photos") {
      return new Response(JSON.stringify({ photos: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const response = await originalFetch(input, init);
    if (
      method === "GET"
      && url.includes(".supabase.co/rest/v1/users?")
      && url.includes("minhas_fotos_tutorial_completed_at")
      && response.ok
    ) {
      const payload = await response.clone().json();
      const rows = Array.isArray(payload) ? payload : [payload];
      const patched = rows.map((row) => ({
        ...row,
        minhas_fotos_tutorial_completed_at: null,
      }));
      return new Response(JSON.stringify(Array.isArray(payload) ? patched : patched[0]), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
  };
})();
""",
)
goto_url(f"{LOCAL_URL}?audit=empty")
wait_for_load()
wait_for_element('[data-tour="mf-gallery"]', timeout=30)
time.sleep(1)
results["checks"]["empty_gallery"] = js(
    """
({
  emptyMessage: document.body.innerText.includes("Ainda não há fotos da sessão"),
  tourOpen: Boolean(document.querySelector('[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]')),
  cards: document.querySelectorAll('[data-tour="mf-gallery"] article').length,
})
"""
)

identifier = injected.get("identifier") if isinstance(injected, dict) else None
if identifier:
    cdp("Page.removeScriptToEvaluateOnNewDocument", identifier=identifier)

# Caso real com fotos: o perfil ainda não concluiu o tour.
first_access_injected = cdp(
    "Page.addScriptToEvaluateOnNewDocument",
    source="""
(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    const method = (init?.method ?? (typeof input === "string" ? "GET" : input?.method) ?? "GET").toUpperCase();
    const response = await originalFetch(input, init);
    if (
      method === "GET"
      && url.includes(".supabase.co/rest/v1/users?")
      && url.includes("minhas_fotos_tutorial_completed_at")
      && response.ok
    ) {
      const payload = await response.clone().json();
      const rows = Array.isArray(payload) ? payload : [payload];
      const patched = rows.map((row) => ({
        ...row,
        minhas_fotos_tutorial_completed_at: null,
      }));
      return new Response(JSON.stringify(Array.isArray(payload) ? patched : patched[0]), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
  };
})();
""",
)
goto_url(LOCAL_URL)
wait_for_load()
wait_for_element('[data-tour="mf-gallery"] article', timeout=30)
wait_for_element('[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]', timeout=30)
time.sleep(0.5)
first_access_identifier = (
    first_access_injected.get("identifier") if isinstance(first_access_injected, dict) else None
)
if first_access_identifier:
    cdp(
        "Page.removeScriptToEvaluateOnNewDocument",
        identifier=first_access_identifier,
    )
results["checks"]["automatic_open"] = js(
    """
({
  tourOpen: Boolean(document.querySelector('[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]')),
  cards: document.querySelectorAll('[data-tour="mf-gallery"] article').length,
  counter: document.querySelector('[role="dialog"] p')?.textContent?.trim() ?? null,
  availableTargets: [
    "mf-header",
    "mf-gallery",
    "mf-session",
    "mf-usage-options",
    "mf-official-usage",
    "mf-actions",
  ].filter((target) => Boolean(document.querySelector(`[data-tour="${target}"]`))),
})
"""
)
results["screenshots"].append(capture_screenshot())

clicked_conclude = False
for _ in range(10):
    current = js(
        """
(() => {
  const dialog = document.querySelector('[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]');
  if (!dialog) return null;
  const title = dialog.querySelector('#minhas-fotos-tour-title')?.textContent?.trim() ?? null;
  const body = dialog.querySelector('#minhas-fotos-tour-description')?.textContent?.trim() ?? null;
  const counter = [...dialog.querySelectorAll("p")]
    .map((node) => node.textContent?.trim() ?? "")
    .find((text) => /^Passo \\d+ de \\d+$/.test(text)) ?? null;
  const nextLabel = [...dialog.querySelectorAll("button")]
    .map((button) => button.textContent?.trim() ?? "")
    .find((text) => text === "Próximo" || text === "Concluir") ?? null;
  return { title, body, counter, nextLabel };
})()
"""
    )
    if current is None:
        break
    results["steps"].append(current)
    if current.get("nextLabel") == "Concluir":
        js(
            """
(() => {
  const dialog = document.querySelector('[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]');
  const button = [...dialog.querySelectorAll("button")]
    .find((item) => item.textContent?.trim() === "Concluir");
  button?.click();
})()
"""
        )
        clicked_conclude = True
        break
    js(
        """
(() => {
  const dialog = document.querySelector('[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]');
  const button = [...dialog.querySelectorAll("button")]
    .find((item) => item.textContent?.trim() === "Próximo");
  button?.click();
})()
"""
    )
    time.sleep(0.55)

time.sleep(1.5)
results["checks"]["completion_closed"] = {
    "clickedConclude": clicked_conclude,
    "tourClosed": not bool(
        js(
            'Boolean(document.querySelector(\'[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]\'))'
        )
    ),
}
print("CHECKPOINT:" + json.dumps(results, ensure_ascii=False, default=str), flush=True)

# Persistência: após recarregar, não deve reabrir automaticamente.
goto_url(LOCAL_URL)
wait_for_load()
wait_for_element('[data-tour="mf-gallery"] article', timeout=30)
time.sleep(1)
results["checks"]["persisted_after_reload"] = not bool(
    js('Boolean(document.querySelector(\'[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]\'))')
)

# Reabertura manual e fechamento por Escape.
js(
    """
(() => {
  const button = [...document.querySelectorAll("button")]
    .find((item) => item.textContent?.trim() === "Ver guia");
  button?.click();
})()
"""
)
wait_for_element('[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]', timeout=10)
time.sleep(0.5)
results["checks"]["manual_reopen"] = bool(
    js('Boolean(document.querySelector(\'[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]\'))')
)
results["screenshots"].append(capture_screenshot())
press_key("Escape")
time.sleep(0.5)
results["checks"]["escape_closes"] = not bool(
    js('Boolean(document.querySelector(\'[role="dialog"][aria-labelledby="minhas-fotos-tour-title"]\'))')
)

results["checks"]["copy"] = js(
    """
(async () => {
  const visible = document.body.innerText;
  const response = await fetch("/api/collaborator-photos/usage-types", { credentials: "include" });
  const payload = response.ok ? await response.json() : null;
  const protectedUsage = payload?.usageTypes?.find((usage) => usage.slug === "oficial") ?? null;
  return {
    hasFullVisibleLabel: visible.includes("Foto dos sistemas do escritório")
      || visible.includes("foto dos sistemas do escritório"),
    hasCompactVisibleLabel: visible.includes("Sistemas do escritório"),
    hasLegacyVisibleLabel: /(^|\\s)Oficial($|\\s|[.,:;])/m.test(visible),
    apiStatus: response.status,
    protectedUsage,
  };
})()
"""
)

print(json.dumps(results, ensure_ascii=False, indent=2, default=str))
