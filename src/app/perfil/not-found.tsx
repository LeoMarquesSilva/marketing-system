import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
      }}
    >
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 12 }}>
          Bismarchi | Pires
        </p>
        <h1 style={{ fontSize: "1.75rem", marginTop: "0.75rem" }}>
          Perfil indisponível
        </h1>
        <p style={{ marginTop: "1rem", lineHeight: 1.6, color: "#444" }}>
          Este perfil profissional não está ativo ou não foi encontrado. Se você
          chegou por um cartão ou link antigo, o endereço pode ter sido
          atualizado. Em caso de dúvida, entre em contato com o escritório.
        </p>
        <p style={{ marginTop: "1.75rem" }}>
          <Link href="https://bismarchipires.com.br">Visitar o site institucional</Link>
        </p>
      </div>
    </main>
  );
}
