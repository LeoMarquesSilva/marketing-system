import json
import sys

from browser_harness.admin import ensure_daemon
from browser_harness.helpers import js, list_tabs, switch_tab


sys.stdout.reconfigure(encoding="utf-8", errors="replace")
WAGNER_USER_ID = "89431fec-abb1-4a6a-beab-120dabff6f56"

ensure_daemon()
local_tab = next(
    tab for tab in list_tabs() if tab["url"].startswith("http://localhost:3000/fotos-colaboradores")
)
switch_tab(local_tab)

result = js(
    f"""
    (async () => {{
      const userId = {json.dumps(WAGNER_USER_ID)};
      const galleryResponse = await fetch(
        `/api/collaborator-photos?userId=${{encodeURIComponent(userId)}}`,
        {{ credentials: "include" }}
      );
      if (!galleryResponse.ok) {{
        throw new Error(await galleryResponse.text());
      }}
      const gallery = await galleryResponse.json();
      const deleted = [];
      for (const photo of gallery.photos ?? []) {{
        const response = await fetch(`/api/collaborator-photos/${{photo.id}}`, {{
          method: "DELETE",
          credentials: "include",
        }});
        if (!response.ok) {{
          throw new Error(`Falha ao excluir ${{photo.id}}: ${{await response.text()}}`);
        }}
        deleted.push(photo.id);
      }}
      return {{ deleted }};
    }})()
    """
)

print(json.dumps(result, ensure_ascii=False, indent=2))
