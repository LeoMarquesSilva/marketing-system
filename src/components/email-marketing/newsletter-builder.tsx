"use client";

import { useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronLeft,
  ImagePlus,
  Layers,
  Link2,
  Loader2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { uploadEmailMarketingImage } from "@/lib/storage-buckets";
import {
  FONT_SIZE_LABEL,
  FONT_SIZE_PX,
  type CtaStyle,
  type FontSizePreset,
  type NewsletterArticle,
  type NewsletterTrabalhistaData,
  type TextAlign,
  type TextBlockStyle,
} from "@/lib/newsletter-trabalhista-template";

type ArticleField = "image" | "title" | "summary" | "cta";
type BlockId =
  | "cover"
  | "heading"
  | "intro"
  | "closing"
  | "contact-button"
  | `article-${number}-${ArticleField}`;

interface NewsletterBuilderProps {
  data: NewsletterTrabalhistaData;
  onChange: (data: NewsletterTrabalhistaData) => void;
  onEditionChange?: (editionLabel: string) => void;
  storageScopeId: string;
  maxWidth: number;
}

const BRAND_COLORS = [
  { label: "Preto", value: "#000000" },
  { label: "Cinza", value: "#555555" },
  { label: "Índigo ORQESTRAI", value: "#48466e" },
  { label: "Azul escuro", value: "#04202f" },
  { label: "Vermelho", value: "#dc2626" },
];

function parseArticleBlock(id: string | null): { index: number; field: ArticleField } | null {
  if (!id) return null;
  const m = id.match(/^article-(\d+)-(image|title|summary|cta)$/);
  if (!m) return null;
  return { index: Number(m[1]), field: m[2] as ArticleField };
}

function textStyleToReactCss(style: TextBlockStyle): React.CSSProperties {
  return {
    color: style.color,
    fontSize: FONT_SIZE_PX[style.fontSize],
    fontWeight: style.bold ? 700 : 400,
    textAlign: style.align,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  };
}

function patchArticle(
  data: NewsletterTrabalhistaData,
  index: number,
  patch: Partial<NewsletterArticle>
): NewsletterTrabalhistaData {
  return {
    ...data,
    articles: data.articles.map((a, i) => (i === index ? { ...a, ...patch } : a)),
  };
}

function SelectableBlock({
  selected,
  label,
  onSelect,
  children,
  className,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative outline-none cursor-pointer transition-shadow rounded-[2px]",
        "hover:shadow-[0_0_0_2px_rgba(102,58,224,0.35)_inset]",
        selected && "shadow-[0_0_0_2px_#48466e_inset]",
        className
      )}
    >
      {selected && (
        <span className="pointer-events-none absolute -top-2 left-2 z-10 rounded bg-[#48466e] px-1.5 py-0.5 text-xs font-semibold uppercase text-white shadow">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Type; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function AlignToggle({ value, onChange }: { value: TextAlign; onChange: (v: TextAlign) => void }) {
  const options: { value: TextAlign; icon: typeof AlignLeft }[] = [
    { value: "left", icon: AlignLeft },
    { value: "center", icon: AlignCenter },
    { value: "right", icon: AlignRight },
  ];
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="icon-xs"
          variant={value === opt.value ? "secondary" : "outline"}
          onClick={() => onChange(opt.value)}
        >
          <opt.icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  );
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {BRAND_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className={cn(
            "h-6 w-6 shrink-0 rounded-full border-2 transition-transform",
            value.toLowerCase() === c.value.toLowerCase()
              ? "border-primary scale-110"
              : "border-transparent hover:scale-105"
          )}
          style={{ backgroundColor: c.value }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
        title="Cor personalizada"
      />
    </div>
  );
}

function TextStylePanel({
  label,
  value,
  style,
  multiline = false,
  placeholder,
  onValueChange,
  onStyleChange,
}: {
  label: string;
  value: string;
  style: TextBlockStyle;
  multiline?: boolean;
  placeholder?: string;
  onValueChange: (v: string) => void;
  onStyleChange: (s: TextBlockStyle) => void;
}) {
  return (
    <div className="space-y-4 p-4">
      <SectionTitle icon={Type}>{label}</SectionTitle>

      <div className="space-y-1.5">
        <Label className="text-xs">Texto</Label>
        {multiline ? (
          <Textarea
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-24 text-sm"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
            className="text-sm"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Negrito</Label>
        <Button
          type="button"
          size="sm"
          variant={style.bold ? "secondary" : "outline"}
          className="font-bold"
          onClick={() => onStyleChange({ ...style, bold: !style.bold })}
        >
          B Negrito
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Alinhamento</Label>
        <AlignToggle value={style.align} onChange={(align) => onStyleChange({ ...style, align })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tamanho da fonte</Label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FONT_SIZE_LABEL) as FontSizePreset[]).map((preset) => (
            <Button
              key={preset}
              type="button"
              size="xs"
              variant={style.fontSize === preset ? "secondary" : "outline"}
              onClick={() => onStyleChange({ ...style, fontSize: preset })}
            >
              {FONT_SIZE_LABEL[preset]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Cor do texto</Label>
        <ColorSwatches value={style.color} onChange={(color) => onStyleChange({ ...style, color })} />
      </div>
    </div>
  );
}

function ImagePanel({
  label,
  src,
  alt,
  linkUrl,
  uploading,
  onUpload,
  onAltChange,
  onLinkChange,
  extra,
}: {
  label: string;
  src: string;
  alt: string;
  linkUrl?: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onAltChange?: (v: string) => void;
  onLinkChange?: (v: string) => void;
  extra?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4 p-4">
      <SectionTitle icon={ImagePlus}>{label}</SectionTitle>

      <div className="overflow-hidden rounded-md border bg-muted/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block h-32 w-full object-cover" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        {uploading ? "Enviando…" : "Selecionar nova imagem"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload(file);
        }}
      />

      {onAltChange && (
        <div className="space-y-1.5">
          <Label className="text-xs">Texto alternativo</Label>
          <Input value={alt} onChange={(e) => onAltChange(e.target.value)} placeholder="Descrição da imagem" />
        </div>
      )}

      {onLinkChange && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Link2 className="h-3 w-3" /> Link ao clicar na imagem
          </Label>
          <Input value={linkUrl ?? ""} onChange={(e) => onLinkChange(e.target.value)} placeholder="https://" />
        </div>
      )}

      {extra}
    </div>
  );
}

function CtaPanel({
  label,
  value,
  url,
  ctaStyle,
  ctaColor,
  fixedButton = false,
  onValueChange,
  onUrlChange,
  onStyleChange,
  onColorChange,
}: {
  label: string;
  value: string;
  url: string;
  ctaStyle: CtaStyle;
  ctaColor: string;
  fixedButton?: boolean;
  onValueChange: (v: string) => void;
  onUrlChange: (v: string) => void;
  onStyleChange?: (v: CtaStyle) => void;
  onColorChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4 p-4">
      <SectionTitle icon={Link2}>{label}</SectionTitle>

      <div className="space-y-1.5">
        <Label className="text-xs">Texto</Label>
        <Input value={value} onChange={(e) => onValueChange(e.target.value)} placeholder="Saiba mais" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">URL de destino</Label>
        <Input value={url} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://" />
      </div>

      {!fixedButton && onStyleChange && (
        <div className="space-y-1.5">
          <Label className="text-xs">Estilo</Label>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={ctaStyle === "link" ? "secondary" : "outline"}
              onClick={() => onStyleChange("link")}
            >
              Link de texto
            </Button>
            <Button
              type="button"
              size="sm"
              variant={ctaStyle === "button" ? "secondary" : "outline"}
              onClick={() => onStyleChange("button")}
            >
              Botão preenchido
            </Button>
          </div>
        </div>
      )}

      {(fixedButton || ctaStyle === "button") && (
        <div className="space-y-1.5">
          <Label className="text-xs">Cor do botão</Label>
          <ColorSwatches value={ctaColor} onChange={onColorChange} />
        </div>
      )}
      {!fixedButton && ctaStyle === "link" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Cor do link</Label>
          <ColorSwatches value={ctaColor} onChange={onColorChange} />
        </div>
      )}
    </div>
  );
}

function LayersList({
  articleCount,
  selected,
  onSelect,
}: {
  articleCount: number;
  selected: BlockId | null;
  onSelect: (id: BlockId) => void;
}) {
  const items: { id: BlockId; label: string }[] = [
    { id: "cover", label: "Imagem de capa" },
    { id: "heading", label: "Título da edição" },
    { id: "intro", label: "Texto introdutório" },
  ];
  for (let i = 0; i < articleCount; i++) {
    items.push(
      { id: `article-${i}-image`, label: `Notícia ${i + 1} — Imagem` },
      { id: `article-${i}-title`, label: `Notícia ${i + 1} — Título` },
      { id: `article-${i}-summary`, label: `Notícia ${i + 1} — Resumo` },
      { id: `article-${i}-cta`, label: `Notícia ${i + 1} — Link/Botão` }
    );
  }
  items.push({ id: "closing", label: "Texto de encerramento" }, { id: "contact-button", label: "Botão de contato" });

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        Blocos do e-mail
      </div>
      <p className="mb-2 px-1 text-[11px] text-muted-foreground">
        Clique em um bloco na lista ou diretamente no e-mail ao lado para editar.
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
              selected === item.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NewsletterBuilder({
  data,
  onChange,
  onEditionChange,
  storageScopeId,
  maxWidth,
}: NewsletterBuilderProps) {
  const [selected, setSelected] = useState<BlockId | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadImage = async (key: string, file: File, applyUrl: (url: string) => void) => {
    setUploadingKey(key);
    setUploadError(null);
    try {
      const { publicUrl } = await uploadEmailMarketingImage(storageScopeId, "newsletter", file);
      applyUrl(publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Falha ao enviar imagem.");
    } finally {
      setUploadingKey(null);
    }
  };

  const update = (patch: Partial<NewsletterTrabalhistaData>) => onChange({ ...data, ...patch });
  const updateArticle = (index: number, patch: Partial<NewsletterArticle>) =>
    onChange(patchArticle(data, index, patch));

  const parsedArticle = parseArticleBlock(selected);
  const article = parsedArticle ? data.articles[parsedArticle.index] : null;

  let panel: React.ReactNode = null;
  if (selected === "cover") {
    panel = (
      <ImagePanel
        label="Imagem de capa"
        src={data.coverImageUrl}
        alt="Capa da newsletter"
        linkUrl={data.coverLinkUrl}
        uploading={uploadingKey === "cover"}
        onUpload={(file) => void uploadImage("cover", file, (url) => update({ coverImageUrl: url }))}
        onLinkChange={(coverLinkUrl) => update({ coverLinkUrl })}
      />
    );
  } else if (selected === "heading") {
    panel = (
      <TextStylePanel
        label="Título da edição"
        value={data.editionLabel}
        style={data.editionLabelStyle}
        onValueChange={(editionLabel) => {
          update({ editionLabel });
          onEditionChange?.(editionLabel);
        }}
        onStyleChange={(editionLabelStyle) => update({ editionLabelStyle })}
      />
    );
  } else if (selected === "intro") {
    panel = (
      <TextStylePanel
        label="Texto introdutório"
        value={data.intro}
        style={data.introStyle}
        multiline
        placeholder="Texto introdutório"
        onValueChange={(intro) => update({ intro })}
        onStyleChange={(introStyle) => update({ introStyle })}
      />
    );
  } else if (selected === "closing") {
    panel = (
      <TextStylePanel
        label="Texto de encerramento"
        value={data.closingText}
        style={data.closingTextStyle}
        multiline
        placeholder="Texto de encerramento"
        onValueChange={(closingText) => update({ closingText })}
        onStyleChange={(closingTextStyle) => update({ closingTextStyle })}
      />
    );
  } else if (selected === "contact-button") {
    panel = (
      <CtaPanel
        label="Botão de contato"
        value={data.contactButtonLabel}
        url={data.whatsappUrl}
        ctaStyle="button"
        ctaColor={data.contactButtonColor}
        fixedButton
        onValueChange={(contactButtonLabel) => update({ contactButtonLabel })}
        onUrlChange={(whatsappUrl) => update({ whatsappUrl })}
        onColorChange={(contactButtonColor) => update({ contactButtonColor })}
      />
    );
  } else if (parsedArticle && article) {
    const { index, field } = parsedArticle;
    const patch = (p: Partial<NewsletterArticle>) => updateArticle(index, p);
    if (field === "image") {
      panel = (
        <ImagePanel
          label={`Notícia ${index + 1} — Imagem`}
          src={article.imageUrl}
          alt={article.imageAlt}
          linkUrl={article.linkUrl}
          uploading={uploadingKey === `article-${index}`}
          onUpload={(file) => void uploadImage(`article-${index}`, file, (url) => patch({ imageUrl: url }))}
          onAltChange={(imageAlt) => patch({ imageAlt })}
          extra={
            <div className="space-y-1.5">
              <Label className="text-xs">Posição da imagem</Label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={article.imageLeft ? "secondary" : "outline"}
                  onClick={() => patch({ imageLeft: true })}
                >
                  Esquerda
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!article.imageLeft ? "secondary" : "outline"}
                  onClick={() => patch({ imageLeft: false })}
                >
                  Direita
                </Button>
              </div>
            </div>
          }
        />
      );
    } else if (field === "title") {
      panel = (
        <TextStylePanel
          label={`Notícia ${index + 1} — Título`}
          value={article.title}
          style={article.titleStyle}
          onValueChange={(title) => patch({ title })}
          onStyleChange={(titleStyle) => patch({ titleStyle })}
        />
      );
    } else if (field === "summary") {
      panel = (
        <TextStylePanel
          label={`Notícia ${index + 1} — Resumo`}
          value={article.summary}
          style={article.summaryStyle}
          multiline
          onValueChange={(summary) => patch({ summary })}
          onStyleChange={(summaryStyle) => patch({ summaryStyle })}
        />
      );
    } else if (field === "cta") {
      panel = (
        <CtaPanel
          label={`Notícia ${index + 1} — Link/Botão`}
          value={article.linkLabel}
          url={article.linkUrl}
          ctaStyle={article.ctaStyle}
          ctaColor={article.ctaColor}
          onValueChange={(linkLabel) => patch({ linkLabel })}
          onUrlChange={(linkUrl) => patch({ linkUrl })}
          onStyleChange={(ctaStyle) => patch({ ctaStyle })}
          onColorChange={(ctaColor) => patch({ ctaColor })}
        />
      );
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[300px] shrink-0 flex-col border-r bg-background overflow-y-auto">
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Todos os blocos
          </button>
        )}
        {uploadError && (
          <p className="bg-destructive/10 px-4 py-2 text-xs text-destructive">{uploadError}</p>
        )}
        {selected && panel ? (
          panel
        ) : (
          <LayersList articleCount={data.articles.length} selected={selected} onSelect={setSelected} />
        )}
      </aside>

      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-muted/40 p-6"
        onClick={() => setSelected(null)}
      >
        <div
          className="mx-auto font-['Montserrat','Trebuchet_MS',sans-serif] shadow-lg"
          style={{ maxWidth, backgroundColor: "#04202f" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ backgroundColor: "#fcf9f5" }}>
            <SelectableBlock selected={selected === "cover"} label="Capa" onSelect={() => setSelected("cover")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.coverImageUrl} alt="Capa da newsletter" className="block w-full h-auto" draggable={false} />
            </SelectableBlock>

            <div className="px-[60px] pt-6 pb-4">
              <SelectableBlock
                selected={selected === "heading"}
                label="Título"
                onSelect={() => setSelected("heading")}
              >
                <h1 style={{ margin: 0, ...textStyleToReactCss(data.editionLabelStyle) }}>{data.editionLabel}</h1>
              </SelectableBlock>
              <SelectableBlock
                selected={selected === "intro"}
                label="Introdução"
                onSelect={() => setSelected("intro")}
                className="mt-4"
              >
                <p style={{ margin: 0, ...textStyleToReactCss(data.introStyle) }}>{data.intro}</p>
              </SelectableBlock>
            </div>

            <Divider />

            {data.articles.map((art, index) => (
              <div key={index}>
                <div className="px-[60px] py-4">
                  <div className="flex items-start gap-4" style={{ flexDirection: art.imageLeft ? "row" : "row-reverse" }}>
                    <div className="shrink-0" style={{ width: "42%" }}>
                      <SelectableBlock
                        selected={selected === `article-${index}-image`}
                        label="Imagem"
                        onSelect={() => setSelected(`article-${index}-image`)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={art.imageUrl}
                          alt={art.imageAlt || art.title}
                          className="block w-full max-w-[174px] h-auto mx-auto"
                          draggable={false}
                        />
                      </SelectableBlock>
                    </div>
                    <div className="min-w-0 flex-1 pt-2" style={{ width: "58%" }}>
                      <SelectableBlock
                        selected={selected === `article-${index}-title`}
                        label="Título"
                        onSelect={() => setSelected(`article-${index}-title`)}
                        className="mb-2"
                      >
                        <h2 style={{ margin: 0, ...textStyleToReactCss(art.titleStyle) }}>{art.title}</h2>
                      </SelectableBlock>
                      <SelectableBlock
                        selected={selected === `article-${index}-summary`}
                        label="Resumo"
                        onSelect={() => setSelected(`article-${index}-summary`)}
                        className="mb-2"
                      >
                        <p style={{ margin: 0, ...textStyleToReactCss(art.summaryStyle) }}>{art.summary}</p>
                      </SelectableBlock>
                      <SelectableBlock
                        selected={selected === `article-${index}-cta`}
                        label="Link/Botão"
                        onSelect={() => setSelected(`article-${index}-cta`)}
                        className="inline-block"
                      >
                        {art.ctaStyle === "button" ? (
                          <span
                            style={{
                              display: "inline-block",
                              backgroundColor: art.ctaColor,
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 14,
                              padding: "8px 18px",
                              borderRadius: 18,
                            }}
                          >
                            {art.linkLabel}
                          </span>
                        ) : (
                          <span style={{ color: art.ctaColor, fontWeight: 700, fontSize: 14 }}>{art.linkLabel}</span>
                        )}
                      </SelectableBlock>
                    </div>
                  </div>
                </div>
                {index < data.articles.length - 1 && <Divider />}
              </div>
            ))}

            <div className="px-[60px] py-6">
              <SelectableBlock
                selected={selected === "closing"}
                label="Encerramento"
                onSelect={() => setSelected("closing")}
              >
                <p style={{ margin: 0, ...textStyleToReactCss(data.closingTextStyle) }}>{data.closingText}</p>
              </SelectableBlock>
            </div>

            <Divider />

            <div className="px-[60px] py-4 text-center">
              <SelectableBlock
                selected={selected === "contact-button"}
                label="Botão"
                onSelect={() => setSelected("contact-button")}
                className="inline-block"
              >
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: data.contactButtonColor,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 16,
                    padding: "6px 20px",
                    borderRadius: 20,
                  }}
                >
                  {data.contactButtonLabel}
                </span>
              </SelectableBlock>
            </div>

            <div className="px-[60px] py-3 text-center flex justify-center gap-3">
              {["instagram", "linkedin", "youtube"].map((net) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={net}
                  src={`https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-black/${net}@2x.png`}
                  alt={net}
                  width={32}
                  height={32}
                  className="opacity-80"
                />
              ))}
            </div>

            <div className="px-[60px] py-4 text-center">
              <p style={{ margin: 0, color: "#8c8c8c", fontSize: 12, lineHeight: 1.4 }}>
                Enviado por Bismarchi | Pires Sociedade de Advogados
                <br />
                R. Cel. Quirino, 1266 - Cambuí, Campinas - SP, 13025-002
                <br />
                Caso não queira mais receber estes e-mails,{" "}
                <span style={{ textDecoration: "underline" }}>cancele sua inscrição</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="px-[60px] py-2">
      <hr style={{ border: "none", borderTop: "1px solid #E2E2E2", margin: 0 }} />
    </div>
  );
}
