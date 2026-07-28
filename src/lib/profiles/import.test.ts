import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildImportPreview, parseCollaboratorWorkbook } from "@/lib/profiles/import";
import type { ImportExistingProfile, ImportUserCandidate } from "@/lib/profiles/types";

/**
 * Fixture com o mesmo formato da planilha real de colaboradores, incluindo a
 * coluna "DATA DE NASC." — que precisa ser ignorada pelo parser — e a coluna
 * "DT. ADMISSÃO", que vira candidata a `joinedOn`.
 */
const HEADER = [
  "CadastroNovo",
  "GRUPO EMPRESA2",
  "EMPRESA",
  "CNPJ/CPF",
  "E-MAIL EMPRESA",
  "TIPO",
  "SETOR EMPRESA",
  "NÚMERO DE COLABORADORES EMPRESA",
  "SITE EMPRESA",
  "LINKEDIN EMPRESA",
  "TELEFONE EMPRESA",
  "ESTADO EMPRESA",
  "CIDADE EMPRESA",
  "Colaborador Ativo?",
  "NOME",
  "ÁREA",
  "CARGO",
  "DT. ADMISSÃO",
  "TELEFONE",
  "DATA DE NASC.",
  "E-MAIL",
  "Tag",
];

function row(values: {
  ativo: string;
  nome: string;
  area: string;
  cargo: string;
  admissao?: Date | null;
  telefone?: string | null;
  nascimento?: Date | null;
  email: string;
}) {
  const line = new Array(HEADER.length).fill(null);
  line[13] = values.ativo;
  line[14] = values.nome;
  line[15] = values.area;
  line[16] = values.cargo;
  line[17] = values.admissao ?? null;
  line[18] = values.telefone ?? null;
  line[19] = values.nascimento ?? null;
  line[20] = values.email;
  return line;
}

function buildWorkbook(rows: unknown[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([HEADER, ...rows], { cellDates: true });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const out = XLSX.write(book, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}

const BIRTH_DATE = new Date(Date.UTC(1985, 3, 2));

const fixture = buildWorkbook([
  row({
    ativo: "SIM",
    nome: "Letícia Rodrigues",
    area: "Tributário",
    cargo: "Sócia",
    admissao: new Date(Date.UTC(2019, 2, 1)),
    telefone: "(19) 99999-9999",
    nascimento: BIRTH_DATE,
    email: "leticia.rodrigues@bismarchipires.com.br",
  }),
  row({
    ativo: "NÃO",
    nome: "João Gonçalves",
    area: "Cível",
    cargo: "Advogado",
    admissao: new Date(Date.UTC(2018, 0, 15)),
    nascimento: BIRTH_DATE,
    email: "joao.goncalves@bismarchipires.com.br",
  }),
  row({
    ativo: "SIM",
    nome: "Fantasma Sem Cadastro",
    area: "Trabalhista",
    cargo: "Estagiário",
    nascimento: BIRTH_DATE,
    email: "ninguem@bismarchipires.com.br",
  }),
  // E-mail com vírgula no domínio: existe na planilha real e não pode ser
  // "corrigido" por adivinhação — precisa aparecer como não correspondido.
  row({
    ativo: "SIM",
    nome: "Email Torto",
    area: "Cível",
    cargo: "Advogado",
    email: "email.torto@bismarchipires,com.br",
  }),
]);

const users: ImportUserCandidate[] = [
  { id: "u-leticia", email: "leticia.rodrigues@bismarchipires.com.br", name: "Letícia Rodrigues" },
  { id: "u-joao", email: "joao.goncalves@bismarchipires.com.br", name: "João Gonçalves" },
];

describe("parseCollaboratorWorkbook — privacidade", () => {
  it("nunca devolve data de nascimento", () => {
    const rows = parseCollaboratorWorkbook(fixture);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("1985");
    expect(serialized).not.toContain("birth");
    expect(serialized).not.toContain("ascimento");
    for (const parsed of rows) {
      expect(parsed).not.toHaveProperty("birthDate");
      expect(parsed).not.toHaveProperty("dataNascimento");
    }
  });

  it("não devolve nenhum campo além do contrato de importação", () => {
    const [first] = parseCollaboratorWorkbook(fixture);
    expect(Object.keys(first).sort()).toEqual(
      ["area", "email", "joinedOn", "name", "phone", "role", "sourceIsActive"].sort()
    );
  });
});

describe("parseCollaboratorWorkbook — leitura", () => {
  it("lê todas as linhas de dados", () => {
    expect(parseCollaboratorWorkbook(fixture)).toHaveLength(4);
  });

  it("preserva acentos de nome, área e cargo", () => {
    const [leticia] = parseCollaboratorWorkbook(fixture);
    expect(leticia.name).toBe("Letícia Rodrigues");
    expect(leticia.role).toBe("Sócia");
    expect(leticia.area).toBe("Tributário");
  });

  it("normaliza o e-mail para minúsculas sem espaços", () => {
    const [leticia] = parseCollaboratorWorkbook(fixture);
    expect(leticia.email).toBe("leticia.rodrigues@bismarchipires.com.br");
  });

  it("converte a data de admissão para AAAA-MM-DD", () => {
    const [leticia] = parseCollaboratorWorkbook(fixture);
    expect(leticia.joinedOn).toBe("2019-03-01");
  });

  it("marca atividade da planilha apenas como informação", () => {
    const rows = parseCollaboratorWorkbook(fixture);
    expect(rows[0].sourceIsActive).toBe(true);
    expect(rows[1].sourceIsActive).toBe(false);
  });

  it("devolve null quando a admissão está ausente", () => {
    const rows = parseCollaboratorWorkbook(fixture);
    expect(rows[2].joinedOn).toBeNull();
  });
});

describe("buildImportPreview — reconciliação", () => {
  it("classifica criação, inativo, não correspondido", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);
    const byEmail = new Map(preview.rows.map((r) => [r.email, r]));

    expect(byEmail.get("leticia.rodrigues@bismarchipires.com.br")?.outcome).toBe("create");
    expect(byEmail.get("joao.goncalves@bismarchipires.com.br")?.outcome).toBe("inactiveSource");
    expect(byEmail.get("ninguem@bismarchipires.com.br")?.outcome).toBe("unmatched");
  });

  it("não tenta adivinhar e-mail malformado", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);
    const torto = preview.rows.find((r) => r.email.includes("bismarchipires,com.br"));
    expect(torto?.outcome).toBe("unmatched");
    expect(torto?.userId).toBeNull();
  });

  it("deixa linha inativa desmarcada por padrão", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);
    const inativo = preview.rows.find((r) => r.email.startsWith("joao"));
    expect(inativo?.selectedByDefault).toBe(false);
  });

  it("deixa criação de colaborador ativo marcada por padrão", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);
    const ativo = preview.rows.find((r) => r.email.startsWith("leticia"));
    expect(ativo?.selectedByDefault).toBe(true);
  });

  it("nunca propõe mudar atividade, papel ou permissão do usuário", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);
    const fields = preview.rows.flatMap((r) => r.differences.map((d) => d.field));
    expect(fields).not.toContain("isActive");
    expect(fields).not.toContain("role_system");
    expect(fields).not.toContain("permissions");
    expect(JSON.stringify(preview)).not.toContain("is_active");
  });

  it("conta cada grupo", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);
    expect(preview.counts.total).toBe(4);
    expect(preview.counts.create).toBe(1);
    expect(preview.counts.inactiveSource).toBe(1);
    expect(preview.counts.unmatched).toBe(2);
  });
});

describe("buildImportPreview — idempotência e diferenças", () => {
  const existing: ImportExistingProfile[] = [
    {
      userId: "u-leticia",
      slug: "leticia-rodrigues",
      professionalEmail: "leticia.rodrigues@bismarchipires.com.br",
      professionalPhone: "(19) 99999-9999",
      joinedOn: "2019-03-01",
      displayName: "Letícia Rodrigues",
      role: "Sócia",
      practiceArea: "Tributário",
    },
  ];

  it("marca como inalterado quando nada mudou", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, existing);
    const leticia = preview.rows.find((r) => r.email.startsWith("leticia"));
    expect(leticia?.outcome).toBe("unchanged");
    expect(leticia?.differences).toEqual([]);
  });

  it("reaplicar o mesmo arquivo não propõe nenhuma criação", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, existing);
    expect(preview.counts.create).toBe(0);
  });

  it("aponta diferença campo a campo quando o cargo muda", () => {
    const preview = buildImportPreview(
      parseCollaboratorWorkbook(fixture),
      users,
      [{ ...existing[0], role: "Advogada" }]
    );
    const leticia = preview.rows.find((r) => r.email.startsWith("leticia"));
    expect(leticia?.outcome).toBe("update");
    const roleDiff = leticia?.differences.find((d) => d.field === "role");
    expect(roleDiff?.current).toBe("Advogada");
    expect(roleDiff?.incoming).toBe("Sócia");
  });

  it("linha atualizada começa marcada", () => {
    const preview = buildImportPreview(
      parseCollaboratorWorkbook(fixture),
      users,
      [{ ...existing[0], role: "Advogada" }]
    );
    const leticia = preview.rows.find((r) => r.email.startsWith("leticia"));
    expect(leticia?.selectedByDefault).toBe(true);
  });
});

describe("buildImportPreview — duplicidade e slug", () => {
  it("bloqueia e-mail corporativo repetido na mesma planilha", () => {
    const duplicated = buildWorkbook([
      row({
        ativo: "SIM",
        nome: "Letícia Rodrigues",
        area: "Tributário",
        cargo: "Sócia",
        email: "leticia.rodrigues@bismarchipires.com.br",
      }),
      row({
        ativo: "SIM",
        nome: "Letícia Duplicada",
        area: "Cível",
        cargo: "Advogada",
        email: "LETICIA.RODRIGUES@bismarchipires.com.br",
      }),
    ]);
    const preview = buildImportPreview(parseCollaboratorWorkbook(duplicated), users, []);
    expect(preview.counts.duplicate).toBe(1);
    expect(preview.rows.filter((r) => r.outcome === "duplicate")).toHaveLength(1);
    // A duplicata nunca vem marcada para aplicar.
    expect(preview.rows.find((r) => r.outcome === "duplicate")?.selectedByDefault).toBe(false);
  });

  it("propõe sufixo determinístico quando o slug já existe", () => {
    const outro: ImportUserCandidate[] = [
      ...users,
      { id: "u-outra", email: "outra.leticia@bismarchipires.com.br", name: "Letícia Rodrigues" },
    ];
    const workbook = buildWorkbook([
      row({
        ativo: "SIM",
        nome: "Letícia Rodrigues",
        area: "Cível",
        cargo: "Advogada",
        email: "outra.leticia@bismarchipires.com.br",
      }),
    ]);
    const preview = buildImportPreview(parseCollaboratorWorkbook(workbook), outro, [
      {
        userId: "u-leticia",
        slug: "leticia-rodrigues",
        professionalEmail: null,
        professionalPhone: null,
        joinedOn: null,
        displayName: "Letícia Rodrigues",
        role: null,
        practiceArea: null,
      },
    ]);
    expect(preview.rows[0].slug).toBe("leticia-rodrigues-2");
  });
});
