import {
  NATIONALITY_OPTIONS,
  type HrQualification,
  type TreatmentGender,
} from "@/lib/rh/qualifications/types";
import { formatCEP, formatCPF } from "@/lib/masks-br";

type QualificationTextInput = Partial<
  Pick<
    HrQualification,
    | "full_name"
    | "nationality"
    | "marital_status"
    | "profession"
    | "treatment_gender"
    | "cpf"
    | "rg"
    | "rg_issuer"
    | "oab_number"
    | "oab_uf"
    | "cep"
    | "street"
    | "number"
    | "complement"
    | "district"
    | "city"
    | "state"
  >
>;

const MARITAL_FEMININE: Record<string, string> = {
  solteiro: "solteira",
  casado: "casada",
  divorciado: "divorciada",
  viuvo: "viúva",
  uniao_estavel: "em união estável",
};

const MARITAL_MASCULINE: Record<string, string> = {
  solteiro: "solteiro",
  casado: "casado",
  divorciado: "divorciado",
  viuvo: "viúvo",
  uniao_estavel: "em união estável",
};

function flex(
  gender: TreatmentGender | null | undefined,
  feminine: string,
  masculine: string
): string {
  return gender === "m" ? masculine : feminine;
}

function maritalLabel(
  status: string | null | undefined,
  gender: TreatmentGender | null | undefined
): string | null {
  if (!status) return null;
  const key = status.toLowerCase().trim();
  const map = gender === "m" ? MARITAL_MASCULINE : MARITAL_FEMININE;
  return map[key] ?? status;
}

function professionLabel(
  profession: string | null | undefined,
  gender: TreatmentGender | null | undefined
): string | null {
  if (!profession) return null;
  const p = profession.trim();
  if (!p) return null;
  // Flexão simples para "advogado(a)"
  if (/^advogad[oa]$/i.test(p)) {
    return gender === "m" ? "advogado" : "advogada";
  }
  return p.toLowerCase();
}

function nationalityLabel(
  nationality: string,
  gender: TreatmentGender | null | undefined
): string {
  const normalized = nationality.toLowerCase().trim();
  const option = NATIONALITY_OPTIONS.find((item) => item.value === normalized);
  if (!option) return normalized;
  return gender === "m" ? option.masculine : option.feminine;
}

/**
 * Gera o parágrafo de qualificação jurídica a partir dos campos preenchidos.
 * Trechos sem dado são omitidos sem pontuação órfã.
 */
export function buildQualificationText(q: QualificationTextInput): string {
  const gender = q.treatment_gender;
  const parts: string[] = [];

  const name = (q.full_name ?? "").trim();
  if (name) parts.push(name.toUpperCase());

  const nationality = (q.nationality ?? "").trim();
  if (nationality) {
    parts.push(nationalityLabel(nationality, gender));
  }

  const marital = maritalLabel(q.marital_status, gender);
  if (marital) parts.push(marital);

  const profession = professionLabel(q.profession, gender);
  if (profession) parts.push(profession);

  const oabNumber = (q.oab_number ?? "").trim();
  const oabUf = (q.oab_uf ?? "").trim().toUpperCase();
  if (oabNumber) {
    const inscrita = flex(gender, "inscrita", "inscrito");
    const ufPart = oabUf ? `OAB/${oabUf}` : "OAB";
    parts.push(`${inscrita} na ${ufPart} ${oabNumber}`);
  }

  const rg = (q.rg ?? "").trim();
  if (rg) {
    const portadora = flex(gender, "portadora", "portador");
    const issuer = (q.rg_issuer ?? "").trim();
    parts.push(
      issuer
        ? `${portadora} do RG nº ${rg}, ${issuer}`
        : `${portadora} do RG nº ${rg}`
    );
  }

  const cpf = formatCPF(q.cpf);
  if (cpf) {
    const inscrita = flex(gender, "inscrita", "inscrito");
    parts.push(`${inscrita} no CPF sob o nº ${cpf}`);
  }

  const street = (q.street ?? "").trim();
  const number = (q.number ?? "").trim();
  const complement = (q.complement ?? "").trim();
  const district = (q.district ?? "").trim();
  const city = (q.city ?? "").trim();
  const state = (q.state ?? "").trim().toUpperCase();
  const cep = formatCEP(q.cep);

  if (street || city) {
    const residente = flex(gender, "residente e domiciliada", "residente e domiciliado");
    const addressBits: string[] = [];
    if (street) {
      let line = `na ${street}`;
      if (number) line += `, nº ${number}`;
      if (complement) line += `, ${complement}`;
      addressBits.push(line);
    }
    if (district) addressBits.push(`Bairro ${district}`);
    if (cep) addressBits.push(`CEP ${cep}`);
    if (city) {
      addressBits.push(state ? `${city}/${state}` : city);
    } else if (state) {
      addressBits.push(state);
    }
    parts.push(`${residente} ${addressBits.join(", ")}`);
  }

  if (parts.length === 0) return "";
  return `${parts.join(", ")};`;
}
