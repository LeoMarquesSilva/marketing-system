const ROOT_FOLDER_ID = "1ZPiAhWn93pgBZz41VIgPUZiXVkKyA4b9";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

async function listFolder(folderId) {
  const response = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`);
  if (!response.ok) {
    throw new Error(`Drive retornou HTTP ${response.status} para a pasta ${folderId}.`);
  }

  const html = await response.text();
  const items = [];
  const pattern =
    /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
  for (const match of html.matchAll(pattern)) {
    const href = decodeHtml(match[2]);
    items.push({
      id: match[1],
      name: decodeHtml(match[3].replace(/<[^>]+>/g, "")).trim(),
      mimeType: href.includes("/drive/folders/") ? FOLDER_MIME : "application/octet-stream",
      size: null,
    });
  }

  return items;
}

const rootItems = await listFolder(ROOT_FOLDER_ID);
const peopleFolders = rootItems.filter((item) => item.mimeType === FOLDER_MIME);
const result = [];

for (const person of peopleFolders) {
  const children = await listFolder(person.id);
  const jpgFolder = children.find(
    (item) => item.mimeType === FOLDER_MIME && item.name.trim().toLowerCase() === "jpg"
  );
  const jpgFiles = jpgFolder
    ? (await listFolder(jpgFolder.id)).filter((item) => item.mimeType !== FOLDER_MIME)
    : [];

  result.push({
    driveName: person.name,
    folderId: person.id,
    jpgFolderId: jpgFolder?.id ?? null,
    files: jpgFiles,
  });
}

if (process.argv.includes("--summary")) {
  const folders = result.map((item) => ({
    driveName: item.driveName,
    hasJpgFolder: Boolean(item.jpgFolderId),
    fileCount: item.files.length,
    bytes: item.files.reduce((total, file) => total + (file.size ?? 0), 0),
  }));
  console.log(
    JSON.stringify(
      {
        folderCount: folders.length,
        fileCount: folders.reduce((total, item) => total + item.fileCount, 0),
        bytes: folders.reduce((total, item) => total + item.bytes, 0),
        folders,
      },
      null,
      2
    )
  );
} else {
  console.log(JSON.stringify(result, null, 2));
}
