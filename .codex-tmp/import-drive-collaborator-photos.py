import argparse
import html
import json
import re
import shutil
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

from browser_harness.admin import ensure_daemon
from browser_harness.helpers import js, list_tabs, press_key, switch_tab, upload_file, wait_for_element


sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT_FOLDER_ID = "1ZPiAhWn93pgBZz41VIgPUZiXVkKyA4b9"
MAX_FILE_BYTES = 15 * 1024 * 1024
SKIPPED_DRIVE_FOLDERS = {
    "dia do advogado",
    "gustavo bismarchi",
    "leo mkt",
    "recepcionista 3",
    "ricardo pires",
    "socios",
}
NAME_OVERRIDES = {
    "adv wagner": "Wagner José Penereiro Armani",
}


def normalize(value):
    decomposed = unicodedata.normalize("NFD", value)
    plain = "".join(character for character in decomposed if unicodedata.category(character) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", plain.lower()).strip()


def fetch_text(url):
    for attempt in range(1, 6):
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read().decode("utf-8", errors="replace")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            if attempt == 5:
                raise
            delay = attempt * 5
            print(
                f"RETRY_LISTING|attempt={attempt}|wait={delay}s|{error}",
                flush=True,
            )
            time.sleep(delay)
    raise RuntimeError(f"Não foi possível ler a pasta: {url}")


def list_drive_folder(folder_id):
    markup = fetch_text(f"https://drive.google.com/embeddedfolderview?id={folder_id}#list")
    pattern = re.compile(
        r'<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?'
        r'<a href="([^"]+)"[\s\S]*?'
        r'<div class="flip-entry-title">([\s\S]*?)</div>'
    )
    items = []
    for item_id, href, raw_name in pattern.findall(markup):
        name = html.unescape(re.sub(r"<[^>]+>", "", raw_name)).strip()
        items.append(
            {
                "id": item_id,
                "name": name,
                "is_folder": "/drive/folders/" in html.unescape(href),
            }
        )
    return items


def build_drive_manifest(requested_person=None):
    manifest = []
    people = [person for person in list_drive_folder(ROOT_FOLDER_ID) if person["is_folder"]]
    if requested_person:
        exact = [
            person
            for person in people
            if normalize(person["name"]) == normalize(requested_person)
        ]
        if exact:
            people = exact

    for person in people:
        children = list_drive_folder(person["id"])
        jpg_folder = next(
            (
                item
                for item in children
                if item["is_folder"] and normalize(item["name"]) == "jpg"
            ),
            None,
        )
        files = []
        if jpg_folder:
            files = [
                item for item in list_drive_folder(jpg_folder["id"]) if not item["is_folder"]
            ]
        manifest.append({"drive_name": person["name"], "files": files})
    return manifest


def get_local_tab():
    return next(
        tab
        for tab in list_tabs()
        if tab["url"].startswith("http://localhost:3000/fotos-colaboradores")
    )


def get_app_names():
    return js(
        """
        [...document.querySelectorAll('button[title="Abrir galeria"]')]
          .map((button) => button.querySelector("p")?.textContent?.trim())
          .filter(Boolean)
        """
    )


def match_app_name(drive_name, app_names):
    normalized_drive = normalize(drive_name)
    if normalized_drive in NAME_OVERRIDES:
        return NAME_OVERRIDES[normalized_drive]
    if normalized_drive in SKIPPED_DRIVE_FOLDERS:
        return None

    drive_tokens = set(normalized_drive.split())
    matches = []
    for app_name in app_names:
        app_tokens = set(normalize(app_name).split())
        if drive_tokens <= app_tokens:
            matches.append(app_name)
    return matches[0] if len(matches) == 1 else None


def open_gallery(app_name):
    clicked = js(
        f"""
        (() => {{
          const target = {json.dumps(app_name)};
          const button = [...document.querySelectorAll('button[title="Abrir galeria"]')]
            .find((item) => item.querySelector("p")?.textContent?.trim() === target);
          if (!button) return false;
          button.click();
          return true;
        }})()
        """
    )
    if not clicked:
        raise RuntimeError(f"Cartão não encontrado: {app_name}")
    if not wait_for_element('input[type="file"][multiple]', timeout=20):
        raise RuntimeError(f"A galeria de {app_name} não abriu.")

    deadline = time.time() + 30
    while time.time() < deadline:
        ready = js(
            f"""
            (() => {{
              const dialog = document.querySelector('[role="dialog"]');
              const button = [...(dialog?.querySelectorAll("button") ?? [])]
                .find((item) => item.textContent?.includes("Subir fotos"));
              const expectedTitle = {json.dumps(f"Galeria de {app_name}")};
              const titleMatches = [...(dialog?.querySelectorAll("h1, h2") ?? [])]
                .some((item) => item.textContent?.trim() === expectedTitle);
              const finishedLoading = !dialog?.textContent?.includes("Carregando galeria");
              return Boolean(titleMatches && finishedLoading && button && !button.disabled);
            }})()
            """
        )
        if ready:
            return
        time.sleep(0.5)
    raise RuntimeError(f"A sessão de upload não ficou disponível para {app_name}.")


def gallery_count():
    value = js(
        """
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          const label = [...(dialog?.querySelectorAll("p") ?? [])]
            .map((item) => item.textContent?.trim() ?? "")
            .find((text) => /^\\d+ fotos?(?:\\s|·|$)/.test(text));
          const match = label?.match(/^(\\d+)/);
          return match ? Number(match[1]) : null;
        })()
        """
    )
    if value is None:
        raise RuntimeError("Não foi possível ler a quantidade atual da galeria.")
    return int(value)


def dialog_error():
    return js(
        """
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          return [...(dialog?.querySelectorAll('div[class*="border-destructive"]') ?? [])]
            .map((item) => item.textContent?.trim())
            .find(Boolean) ?? null;
        })()
        """
    )


def safe_download_name(index, original_name):
    extension = Path(original_name).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        extension = ".jpg"
    return f"{index:04d}{extension}"


def download_files(files, destination):
    downloaded = []
    for index, item in enumerate(files, start=1):
        path = destination / safe_download_name(index, item["name"])
        url = (
            "https://drive.usercontent.google.com/download"
            f"?id={item['id']}&export=download&confirm=t"
        )
        for attempt in range(1, 6):
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(request, timeout=120) as response, path.open(
                    "wb"
                ) as output:
                    content_type = response.headers.get("Content-Type", "")
                    if not content_type.startswith("image/"):
                        raise RuntimeError(
                            f"{item['name']}: o Drive retornou conteúdo inválido ({content_type})."
                        )
                    total = 0
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        total += len(chunk)
                        if total > MAX_FILE_BYTES:
                            raise RuntimeError(f"{item['name']}: arquivo maior que 15 MB.")
                        output.write(chunk)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
                path.unlink(missing_ok=True)
                if attempt == 5:
                    raise
                delay = attempt * 5
                print(
                    f"RETRY_DOWNLOAD|{item['name']}|attempt={attempt}|wait={delay}s|{error}",
                    flush=True,
                )
                time.sleep(delay)
        downloaded.append(str(path))
        print(f"DOWNLOAD|{index}/{len(files)}|{item['name']}", flush=True)
    return downloaded


def upload_person(drive_name, app_name, files):
    open_gallery(app_name)
    before = gallery_count()
    if before >= len(files):
        print(f"SKIP_EXISTING|{drive_name}|{app_name}|{before}/{len(files)}", flush=True)
        press_key("Escape")
        time.sleep(0.5)
        return

    remaining = files[before:]
    temporary = Path(tempfile.mkdtemp(prefix="orquestrai-fotos-"))
    try:
        print(
            f"START|{drive_name}|{app_name}|existing={before}|remaining={len(remaining)}",
            flush=True,
        )
        paths = download_files(remaining, temporary)
        upload_file('input[type="file"][multiple]', paths)

        expected = before + len(remaining)
        deadline = time.time() + max(300, len(remaining) * 30)
        while time.time() < deadline:
            error = dialog_error()
            if error:
                raise RuntimeError(error)
            current = gallery_count()
            print(f"UPLOAD|{drive_name}|{current}/{expected}", flush=True)
            if current >= expected:
                print(f"DONE|{drive_name}|{app_name}|{current}", flush=True)
                press_key("Escape")
                time.sleep(0.8)
                return
            time.sleep(3)
        raise TimeoutError(f"Tempo esgotado no upload de {drive_name}.")
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--person")
    args = parser.parse_args()

    ensure_daemon()
    switch_tab(get_local_tab())
    if js("Boolean(document.querySelector('[role=\"dialog\"]'))"):
        press_key("Escape")
        time.sleep(0.8)
    app_names = get_app_names()
    manifest = build_drive_manifest(args.person)

    selected = []
    skipped = []
    for item in manifest:
        app_name = match_app_name(item["drive_name"], app_names)
        if app_name:
            selected.append({**item, "app_name": app_name})
        else:
            skipped.append(item["drive_name"])

    if args.person:
        requested = normalize(args.person)
        selected = [
            item
            for item in selected
            if requested in {normalize(item["drive_name"]), normalize(item["app_name"])}
        ]
        if not selected:
            raise RuntimeError(f"Pessoa não encontrada: {args.person}")

    print(
        json.dumps(
            {
                "selected_folders": len(selected),
                "selected_files": sum(len(item["files"]) for item in selected),
                "skipped": skipped,
                "matches": [
                    {
                        "drive": item["drive_name"],
                        "app": item["app_name"],
                        "files": len(item["files"]),
                    }
                    for item in selected
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        flush=True,
    )

    if args.dry_run:
        return

    for item in selected:
        upload_person(
            item["drive_name"],
            item["app_name"],
            item["files"],
        )


if __name__ == "__main__":
    main()
