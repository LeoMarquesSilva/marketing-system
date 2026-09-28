"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play, RotateCcw, Volume2 } from "lucide-react";

type PlayState =
  | "starting"
  | "playing"
  /** Navegador só liberou autoplay mudo: pede um toque para ligar o som. */
  | "muted"
  /** Nem mudo tocou (ex.: modo economia do iPhone): pede um toque para começar. */
  | "blocked"
  | "ended"
  | "error";

/**
 * Vídeo em tela cheia aberto pela etiqueta NFC. Tenta tocar com som; se o navegador
 * bloquear (regra de autoplay dos celulares), começa mudo e um toque liga o som
 * voltando ao início, para ninguém perder a primeira fala.
 */
export function NfcVideoExperience({
  videoUrl,
  title,
  description,
}: {
  videoUrl: string;
  title?: string;
  description?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayState>("starting");
  const [buffering, setBuffering] = useState(true);
  const [showTitle, setShowTitle] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    (async () => {
      try {
        video.muted = false;
        await video.play();
        if (!cancelled) setState("playing");
      } catch {
        try {
          video.muted = true;
          await video.play();
          if (!cancelled) setState("muted");
        } catch {
          if (!cancelled) setState("blocked");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // O título some sozinho depois que o vídeo engrena.
  useEffect(() => {
    if (state !== "playing" && state !== "muted") return;
    const timer = window.setTimeout(() => setShowTitle(false), 5000);
    return () => window.clearTimeout(timer);
  }, [state]);

  function playFromStartWithSound() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    setShowTitle(false);
    void video
      .play()
      .then(() => setState("playing"))
      .catch(() => setState("blocked"));
  }

  const needsTap = state === "muted" || state === "blocked" || state === "ended";

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-black text-white">
      <video
        ref={videoRef}
        src={videoUrl}
        className="h-full w-full object-contain"
        playsInline
        preload="auto"
        controls={state === "playing"}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => setState("ended")}
        onError={() => setState("error")}
      />

      {showTitle && (title || description) && state !== "error" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent px-5 pb-16 pt-[calc(1.25rem+env(safe-area-inset-top))] text-center">
          {title && <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>}
          {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/80">{description}</p>}
        </div>
      )}

      {buffering && !needsTap && state !== "error" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="h-10 w-10 animate-spin text-white/80" aria-label="Carregando vídeo" />
        </div>
      )}

      {needsTap && (
        <button
          type="button"
          onClick={playFromStartWithSound}
          className="absolute inset-0 flex items-end justify-center bg-black/25 pb-[calc(3.5rem+env(safe-area-inset-bottom))] outline-none"
          aria-label={state === "muted" ? "Ouvir com som desde o início" : "Assistir ao vídeo"}
        >
          <span className="flex items-center gap-3 rounded-full bg-white px-6 py-4 text-base font-semibold text-[#04202f] shadow-2xl">
            {state === "muted" ? (
              <>
                <Volume2 className="h-6 w-6" aria-hidden="true" />
                Toque para ouvir
              </>
            ) : state === "ended" ? (
              <>
                <RotateCcw className="h-6 w-6" aria-hidden="true" />
                Assistir de novo
              </>
            ) : (
              <>
                <Play className="h-6 w-6" fill="currentColor" aria-hidden="true" />
                Assistir
              </>
            )}
          </span>
        </button>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold">Não foi possível carregar o vídeo</p>
          <p className="max-w-sm text-sm text-white/70">Confira a conexão e tente de novo.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#04202f]"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </main>
  );
}
