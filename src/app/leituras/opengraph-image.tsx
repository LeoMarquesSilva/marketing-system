import { ImageResponse } from "next/og";

export const alt = "Leituras que formam trajetórias — Bismarchi | Pires";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#f3eee7",
          color: "#102536",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 82% 18%, rgba(202, 163, 92, 0.34), transparent 28%), linear-gradient(120deg, transparent 0 67%, rgba(16, 37, 54, 0.045) 67% 68%, transparent 68%)",
          }}
        />

        <div
          style={{
            width: 54,
            height: "100%",
            display: "flex",
            background: "#caa35c",
          }}
        />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px 58px 74px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 62,
                height: 62,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 31,
                border: "2px solid #caa35c",
                color: "#caa35c",
                fontFamily: "Arial, sans-serif",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              BP
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Arial, sans-serif",
                letterSpacing: "0.08em",
              }}
            >
              <span style={{ fontSize: 23, fontWeight: 700 }}>BISMARCHI | PIRES</span>
              <span style={{ marginTop: 5, fontSize: 13, color: "#5e6b74" }}>
                SOCIEDADE DE ADVOGADOS
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: 710, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#a77d36",
                }}
              >
                Uma seleção para quem está começando no Direito
              </div>
              <div
                style={{
                  marginTop: 21,
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 69,
                  lineHeight: 0.98,
                  letterSpacing: "-0.045em",
                }}
              >
                <span>Leituras que formam</span>
                <span style={{ color: "#a77d36", fontStyle: "italic" }}>trajetórias.</span>
              </div>
              <div
                style={{
                  marginTop: 28,
                  width: 650,
                  display: "flex",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 22,
                  lineHeight: 1.38,
                  color: "#52616b",
                }}
              >
                Livros escolhidos pelos profissionais do Bismarchi | Pires e as histórias por
                trás de cada indicação.
              </div>
            </div>

            <div
              style={{
                width: 250,
                height: 306,
                marginLeft: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "34px 26px 29px",
                color: "#f5efe5",
                background: "#102536",
                border: "7px solid #e7dccb",
                boxShadow: "18px 18px 0 #caa35c",
                transform: "rotate(3deg)",
              }}
            >
              <span
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 16,
                  letterSpacing: "0.2em",
                  color: "#d4b476",
                }}
              >
                LEITURAS
              </span>
              <span style={{ display: "flex", fontSize: 30, lineHeight: 1.08 }}>
                QUE FORMAM TRAJETÓRIAS
              </span>
              <span
                style={{
                  display: "flex",
                  height: 3,
                  width: 80,
                  background: "#caa35c",
                }}
              />
              <span style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
                Bismarchi | Pires
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
