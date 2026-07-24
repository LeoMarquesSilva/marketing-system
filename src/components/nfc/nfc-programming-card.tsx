"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Clipboard, ExternalLink, RadioTower, Smartphone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NfcToast, type NfcToastValue } from "@/components/nfc/nfc-toast";

interface WebNdefRecord {
  recordType: "url" | "text" | "smart-poster";
  data: string | WebNdefRecord[];
  lang?: string;
}

interface WebNdefReader {
  write(message: { records: WebNdefRecord[] }): Promise<void>;
}

type NdefReaderConstructor = new () => WebNdefReader;

export function NfcProgrammingCard({
  permanentUrl,
  tagName,
}: {
  permanentUrl: string;
  tagName: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [webNfcSupported, setWebNfcSupported] = useState(false);
  const [writing, setWriting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<NfcToastValue | null>(null);
  const byteLength =
    new TextEncoder().encode(permanentUrl).length +
    new TextEncoder().encode(tagName).length +
    28;

  useEffect(() => {
    setWebNfcSupported("NDEFReader" in window);
    QRCode.toDataURL(permanentUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: { dark: "#04202f", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [permanentUrl]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(permanentUrl);
    setCopied(true);
    setToast({ type: "success", message: "URL permanente copiada." });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const writeNfc = async () => {
    const constructor = (window as unknown as { NDEFReader?: NdefReaderConstructor }).NDEFReader;
    if (!constructor) {
      setToast({ type: "error", message: "Este navegador não oferece suporte a Web NFC." });
      return;
    }
    setWriting(true);
    try {
      const writer = new constructor();
      setToast({ type: "success", message: "Aproxime e mantenha a etiqueta junto ao celular." });
      await writer.write({
        records: [
          {
            recordType: "smart-poster",
            data: [
              { recordType: "url", data: permanentUrl },
              { recordType: "text", data: tagName, lang: "pt-BR" },
            ],
          },
        ],
      });
      setToast({
        type: "success",
        message: `“${tagName}” foi gravada com nome e URL. A etiqueta continua regravável.`,
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setToast({
        type: "error",
        message:
          name === "NotAllowedError"
            ? "Permissão de NFC negada. Autorize o acesso e tente novamente."
            : name === "NotSupportedError"
              ? "A etiqueta ou o dispositivo não é compatível com esta gravação."
              : "Não foi possível gravar. Aproxime a etiqueta e tente novamente.",
      });
    } finally {
      setWriting(false);
    }
  };

  return (
    <>
      <Card className="gap-4 py-5">
        <CardHeader className="border-b px-5">
          <CardTitle className="flex items-center gap-2 text-base">
            <RadioTower className="h-5 w-5 text-[#347796]" />
            Programar etiqueta
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 px-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-sm font-medium">URL permanente</p>
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-[#dce9eb] bg-[#f7fafb] px-3 py-2.5 font-mono text-xs text-[#285f7a]">
                  {permanentUrl}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={copyUrl} aria-label="Copiar URL permanente">
                  {copied ? <Check /> : <Clipboard />}
                </Button>
                <Button asChild type="button" variant="outline" size="icon">
                  <a href={permanentUrl} target="_blank" rel="noreferrer" aria-label="Testar URL">
                    <ExternalLink />
                  </a>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Nome exibido por leitores compatíveis: <strong className="text-foreground">{tagName}</strong>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[#dce9eb] bg-white p-3">
                <p className="text-xs text-muted-foreground">Tamanho estimado</p>
                <p className="mt-1 font-mono text-lg font-semibold">~{byteLength} bytes</p>
                <p className="mt-1 text-xs text-muted-foreground">Compatível com tags NDEF que tenham espaço suficiente.</p>
              </div>
              <div className="rounded-md border border-[#dce9eb] bg-white p-3">
                <p className="text-xs text-muted-foreground">Web NFC neste navegador</p>
                <p className={`mt-1 text-sm font-semibold ${webNfcSupported ? "text-emerald-700" : "text-amber-700"}`}>
                  {webNfcSupported ? "Disponível" : "Não disponível"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {webNfcSupported ? "Gravação direta pode ser solicitada." : "Use o aplicativo NFC Tools."}
                </p>
              </div>
            </div>

            <div className="rounded-md border border-[#dce9eb] bg-[#f7fafb] p-4">
              <p className="text-sm font-semibold">Gravar com NFC Tools</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                <li>Copie a URL permanente acima.</li>
                <li>No NFC Tools, escolha Escrever → Adicionar registro → URL/URI.</li>
                <li>Cole a URL, toque em Escrever e aproxime a etiqueta.</li>
                <li>Teste a etiqueta antes de fixá-la no local definitivo.</li>
              </ol>
            </div>

            {webNfcSupported ? (
              <Button type="button" onClick={writeNfc} disabled={writing}>
                <Smartphone />
                {writing ? "Aproxime a etiqueta..." : "Gravar diretamente pelo celular"}
              </Button>
            ) : (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                <Smartphone className="mt-1 h-4 w-4 shrink-0" />
                No iPhone ou em navegadores sem suporte a Web NFC, copie esta URL e grave-a na etiqueta usando o aplicativo NFC Tools, escolhendo Escrever &gt; Adicionar registro &gt; URL/URI.
              </div>
            )}

            <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Não bloqueie a etiqueta como somente leitura. O ORQESTRAI já mantém a URL estável; deixar a tag regravável facilita manutenção física futura.
            </div>
          </div>

          <div className="flex flex-col items-center justify-start">
            <div className="rounded-md border border-[#dce9eb] bg-white p-3 shadow-sm">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code da URL permanente da etiqueta" className="h-56 w-56" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center bg-[#f7fafb] text-xs text-muted-foreground">
                  Gerando QR Code...
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">Use o QR Code para testar ou como alternativa visual à leitura NFC.</p>
          </div>
        </CardContent>
      </Card>
      <NfcToast value={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
