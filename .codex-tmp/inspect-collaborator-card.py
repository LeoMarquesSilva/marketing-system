from browser_harness.admin import ensure_daemon
from browser_harness.helpers import js, list_tabs, switch_tab

ensure_daemon()
local_tab = next(
    tab for tab in list_tabs() if tab["url"].startswith("http://localhost:3000/fotos-colaboradores")
)
switch_tab(local_tab)

print(
    js(
        """
        (() => {
          const label = [...document.querySelectorAll("*")].find(
            (element) =>
              element.childElementCount === 0 &&
              element.textContent?.trim() === "Ana Clara Borba Tavares"
          );
          return label?.closest("[class]")?.parentElement?.parentElement?.outerHTML?.slice(0, 6000);
        })()
        """
    )
)
