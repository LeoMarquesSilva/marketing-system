/**
 * Cartão "mensagens do time" (1080 × 1350, o formato de post do Instagram e do
 * LinkedIn), desenhado no navegador para o aniversariante compartilhar junto
 * com a arte. Cores e caixa baixa da identidade Bismarchi | Pires.
 */

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const NAVY = "#0D1E2E";
const GOLD = "#E1B16D";

export interface CardMessage {
  name: string;
  department: string | null;
  body: string;
  avatarUrl: string | null;
}

export interface CardInput {
  firstName: string;
  /** "aniversário" ou "5 anos de casa". */
  occasion: string;
  /** "12 de novembro de 2026". */
  dateLabel: string;
  messages: CardMessage[];
  /** Valores mais reconhecidos pelo time (selo + nome), no máximo três. */
  values: Array<{ label: string; sealSrc: string }>;
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** Quebra o texto em linhas que cabem na largura; passa do limite, a última termina em reticências. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  const used = lines.join(" ").length;
  if (used < text.replace(/\s+/g, " ").trim().length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Desenha o cartão no canvas (que precisa ter 1080 × 1350). */
export async function drawMessagesCard(canvas: HTMLCanvasElement, input: CardInput): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;

  const [phoenix, avatars, seals] = await Promise.all([
    loadImage("/fenix.png", false),
    Promise.all(input.messages.map((message) => (message.avatarUrl ? loadImage(message.avatarUrl, true) : Promise.resolve(null)))),
    Promise.all(input.values.map((value) => loadImage(value.sealSrc, false))),
  ]);

  // Fundo marinho com um clarão no canto e os fios dourados.
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const glow = ctx.createRadialGradient(CARD_WIDTH, 0, 0, CARD_WIDTH, 0, 900);
  glow.addColorStop(0, "rgba(40, 95, 122, 0.55)");
  glow.addColorStop(1, "rgba(13, 30, 46, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.lineWidth = 2;
  for (const [alpha, offset] of [
    [0.55, 0],
    [0.35, 46],
    [0.2, 92],
  ] as const) {
    ctx.strokeStyle = `rgba(225, 177, 109, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(560 + offset, -20);
    ctx.bezierCurveTo(700 + offset, 150, 900 + offset, 230, CARD_WIDTH + 40, 220 - offset / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-40, CARD_HEIGHT - 150 + offset);
    ctx.bezierCurveTo(260, CARD_HEIGHT - 230 + offset, 520, CARD_HEIGHT - 60 + offset, CARD_WIDTH + 40, CARD_HEIGHT - 250 + offset);
    ctx.stroke();
  }

  // Marca.
  ctx.textBaseline = "alphabetic";
  let brandX = 80;
  if (phoenix) {
    const height = 72;
    const width = (phoenix.naturalWidth / phoenix.naturalHeight) * height;
    ctx.drawImage(phoenix, 80, 70, width, height);
    brandX = 80 + width + 22;
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = font(600, 30);
  ctx.fillText("bismarchi | pires", brandX, 118);

  // Título.
  ctx.font = font(300, 62);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("mensagens do time", 80, 262);
  ctx.font = font(700, 74);
  ctx.fillStyle = GOLD;
  ctx.fillText(`para ${input.firstName}`, 80, 346);
  ctx.fillRect(80, 378, 72, 3);
  ctx.font = font(400, 28);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(`${input.occasion} · ${input.dateLabel}`, 176, 390);

  // Mensagens.
  const hasValues = input.values.length > 0;
  const bottomLimit = hasValues ? 1040 : 1200;
  const maxLines = input.messages.length >= 4 ? 2 : input.messages.length === 3 ? 3 : 5;
  const cardX = 80;
  const cardWidth = CARD_WIDTH - 160;
  const textX = cardX + 36 + 88 + 28;
  const textWidth = cardX + cardWidth - 36 - textX;
  let y = 440;
  input.messages.forEach((message, index) => {
    ctx.font = font(400, 30);
    const lines = wrapText(ctx, message.body, textWidth, maxLines);
    const height = Math.max(36 + 44 + lines.length * 42 + 30, 36 + 88 + 36);
    if (y + height > bottomLimit) return;

    roundedRect(ctx, cardX, y, cardWidth, height, 26);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(225,177,109,0.28)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Foto (ou iniciais) em círculo com aro dourado.
    const centerX = cardX + 36 + 44;
    const centerY = y + 36 + 44;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 44, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const avatar = avatars[index];
    if (avatar) {
      const scale = Math.max(88 / avatar.naturalWidth, 88 / avatar.naturalHeight);
      const width = avatar.naturalWidth * scale;
      const heightImage = avatar.naturalHeight * scale;
      ctx.drawImage(avatar, centerX - width / 2, centerY - heightImage / 2, width, heightImage);
    } else {
      ctx.fillStyle = "#16324a";
      ctx.fillRect(centerX - 44, centerY - 44, 88, 88);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(600, 32);
      ctx.textAlign = "center";
      ctx.fillText(initials(message.name), centerX, centerY + 11);
      ctx.textAlign = "left";
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 45, 0, Math.PI * 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = font(700, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(message.name, textX, y + 36 + 28);
    if (message.department) {
      const nameWidth = ctx.measureText(message.name).width;
      ctx.font = font(400, 24);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(`· ${message.department}`, textX + nameWidth + 12, y + 36 + 28);
    }
    ctx.font = font(400, 30);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    lines.forEach((line, lineIndex) => ctx.fillText(line, textX, y + 36 + 28 + 46 + lineIndex * 42));

    y += height + 22;
  });

  // Valores que o time reconheceu.
  if (hasValues) {
    ctx.font = font(400, 26);
    ctx.fillStyle = GOLD;
    ctx.fillText(`o time reconhece em ${input.firstName}`, 80, 1096);
    let x = 80;
    input.values.forEach((value, index) => {
      const seal = seals[index];
      if (seal) ctx.drawImage(seal, x, 1116, 104, 104);
      ctx.font = font(600, 24);
      ctx.fillStyle = "#ffffff";
      const words = value.label.split(" ");
      const half = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, half).join(" "), x + 118, 1160);
      ctx.fillText(words.slice(half).join(" "), x + 118, 1192);
      x += 310;
    });
  }

  // Rodapé.
  ctx.font = font(500, 28);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("@bismarchipires", 80, CARD_HEIGHT - 62);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = font(400, 26);
  ctx.fillText("#SomosÚnicos", CARD_WIDTH - 80, CARD_HEIGHT - 62);
  ctx.textAlign = "left";
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      // Canvas "contaminado" por imagem de outro domínio sem permissão: não dá para exportar.
      resolve(null);
    }
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
