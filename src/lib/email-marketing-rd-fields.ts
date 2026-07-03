/**
 * Labels legíveis para campos importados do RD Station Marketing.
 * Chaves em custom_fields usam prefixo rd_ (ex.: rd_cnpj ← cf_cnpj).
 */

const RD_FIELD_LABELS: Record<string, string> = {
  rd_uuid: "UUID no RD Station",
  rd_cnpj: "CNPJ / CPF",
  rd_grupo_empresa: "Grupo empresa",
  rd_cidade_empresa: "Cidade",
  rd_estado_empresa: "Estado",
  rd_e_mail_empresa: "E-mail da empresa",
  rd_e_mail_lead: "E-mail lead",
  rd_dono_do_lead: "Dono do lead",
  rd_cargo_e_book: "Cargo",
  rd_area: "Área",
  rd_setor_empresa: "Setor",
  rd_linkedin_empresa: "LinkedIn",
  rd_socio_gestor: "Sócio gestor",
  rd_parceiro_estrategico: "Parceiro estratégico",
  rd_tamanho: "Tamanho",
  rd_tipo: "Tipo",
  rd_valor_contrato: "Valor contrato",
  rd_estagio_do_funil: "Estágio do funil",
  rd_numero_de_colaboradores: "Número de colaboradores",
  rd_tempo_de_empresa: "Tempo de empresa",
  rd_data_de_admissao: "Data de admissão",
  rd_mensagem_site: "Mensagem",
  rd_assunto: "Assunto",
  rd_legal_bases: "Bases legais",
};

const HIDDEN_RD_KEYS = new Set(["rd_uuid"]);

export function rdFieldLabel(key: string): string {
  if (RD_FIELD_LABELS[key]) return RD_FIELD_LABELS[key];
  if (key.startsWith("rd_")) {
    return key
      .slice(3)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return key.replace(/_/g, " ");
}

export function formatRdFieldValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "object" && value[0] !== null && "category" in value[0]) {
      return (value as { category: string; status: string; type: string }[])
        .map((b) => {
          const cat =
            b.category === "communications"
              ? "Comunicações"
              : b.category === "data_processing"
                ? "Tratamento de dados"
                : b.category;
          const status =
            b.status === "granted" ? "Concedida" : b.status === "declined" ? "Recusada" : b.status;
          return `${cat}: ${status}`;
        })
        .join(" · ");
    }
    return value.map((v) => formatRdFieldValue(v)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export interface RdDisplayField {
  key: string;
  label: string;
  value: string;
}

/** Campos do contato prontos para exibição (ordenados, sem metadados internos). */
export function contactRdDisplayFields(customFields: Record<string, unknown>): RdDisplayField[] {
  const entries = Object.entries(customFields)
    .filter(([key, value]) => !HIDDEN_RD_KEYS.has(key) && value != null && value !== "" && value !== "[]")
    .map(([key, value]) => ({
      key,
      label: rdFieldLabel(key),
      value: formatRdFieldValue(value),
    }))
    .filter((f) => f.value !== "—");

  const priority = [
    "rd_grupo_empresa",
    "rd_cnpj",
    "rd_cidade_empresa",
    "rd_estado_empresa",
    "rd_e_mail_empresa",
    "rd_dono_do_lead",
    "rd_cargo_e_book",
    "rd_area",
    "rd_setor_empresa",
    "rd_linkedin_empresa",
    "rd_legal_bases",
  ];

  return entries.sort((a, b) => {
    const ai = priority.indexOf(a.key);
    const bi = priority.indexOf(b.key);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label, "pt-BR");
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
