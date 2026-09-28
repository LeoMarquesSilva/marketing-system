import json
import sys
import time

from browser_harness.admin import ensure_daemon
from browser_harness.helpers import goto_url, js, list_tabs, switch_tab, wait_for_element, wait_for_load


sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ensure_daemon()

results = []
tabs = [
    tab
    for tab in list_tabs()
    if "/fotos-colaboradores" in tab["url"]
    and (
        tab["url"].startswith("http://localhost:3000")
        or tab["url"].startswith("https://marketing-system-xi.vercel.app")
    )
]

for tab in tabs:
    switch_tab(tab)
    goto_url(tab["url"])
    wait_for_load()
    wait_for_element("article", timeout=20)
    time.sleep(3)
    result = js(
        """
        (async () => {
          const cards = [...document.querySelectorAll("article")].map((article) => {
            const name = article.querySelector('button[title="Abrir galeria"] p')
              ?.textContent?.trim() ?? null;
            const status = [...article.querySelectorAll("span")]
              .map((item) => item.textContent?.trim() ?? "")
              .find((text) => text === "Pendente" || /^\\d+ fotos?/.test(text)) ?? null;
            return { name, status };
          }).filter((item) => item.name);

          const response = await fetch("/api/collaborator-photos?summary=1", {
            credentials: "include",
            cache: "no-store",
          });
          const summary = response.ok ? await response.json() : null;
          const counts = Object.values(summary?.photoCountByUserId ?? {});
          return {
            url: location.href,
            responseStatus: response.status,
            domCards: cards.length,
            domWithPhotos: cards.filter((item) => /^\\d+ fotos?/.test(item.status ?? "")).length,
            domPending: cards.filter((item) => item.status === "Pendente").map((item) => item.name),
            apiUsersWithPhotos: counts.filter((count) => Number(count) > 0).length,
            apiPhotoTotal: counts.reduce((total, count) => total + Number(count), 0),
          };
        })()
        """
    )
    results.append(result)

print(json.dumps(results, ensure_ascii=False, indent=2))
