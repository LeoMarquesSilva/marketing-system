"use client";

/**
 * Tab com embed do board Miro original da pesquisa de clima.
 * Permite visualizar o material fonte enquanto usa o sistema.
 */
export function ClimaMiroTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Board Miro original</h2>
        <p className="text-sm text-muted-foreground">
          Visualização do board da pesquisa de clima no Miro. Use o zoom ou os controles no canto para navegar.
        </p>
      </div>

      <div className="rounded-xl border overflow-hidden bg-muted/30">
        <iframe
          width="100%"
          height="600"
          src="https://miro.com/app/live-embed/uXjVKlZq5G8=/?embedMode=view_only_without_ui&moveToViewport=-4340,-1337,4646,2204&embedId=138357851931"
          frameBorder="0"
          scrolling="no"
          allow="fullscreen; clipboard-read; clipboard-write"
          allowFullScreen
          title="Board Miro - Pesquisa de Clima"
          className="min-h-[500px] w-full"
        />
      </div>
    </div>
  );
}
