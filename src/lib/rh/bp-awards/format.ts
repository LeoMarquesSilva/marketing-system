/** Datas do BP Awards sempre no horário de Brasília (sem horário de verão desde 2019). */

const TIME_ZONE = "America/Sao_Paulo";
const BRASILIA_OFFSET = "-03:00";

/** "14 de novembro". */
export function formatAwardDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: TIME_ZONE }).format(new Date(iso));
}

/** "14 de novembro, às 18h" / "às 18h30". */
export function formatAwardDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${formatAwardDate(iso)}, às ${hour}h${minute === "00" ? "" : minute}`;
}

/** ISO → valor de `<input type="datetime-local">` no horário de Brasília. */
export function toBrasiliaInput(iso: string | null): string {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: TIME_ZONE,
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Valor de `<input type="datetime-local">` (horário de Brasília) → ISO com fuso. */
export function fromBrasiliaInput(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00${BRASILIA_OFFSET}` : null;
}

const SUPABASE_PUBLIC_OBJECT = /^(https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1)\/object\/public\/(.+)$/i;

/**
 * Foto em tamanho de tela: as institucionais do bucket têm 4000 px (~4,5 MB);
 * o Supabase devolve a versão recortada e reduzida (~4 KB). Outras origens passam direto.
 */
export function awardPhotoUrl(url: string | null, pixels: number): string | null {
  if (!url) return null;
  const match = url.match(SUPABASE_PUBLIC_OBJECT);
  if (!match) return url;
  const [path, query = ""] = match[2].split("?");
  const params = new URLSearchParams(query);
  params.set("width", String(pixels));
  params.set("height", String(pixels));
  params.set("resize", "cover");
  params.set("quality", "75");
  return `${match[1]}/render/image/public/${path}?${params.toString()}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
