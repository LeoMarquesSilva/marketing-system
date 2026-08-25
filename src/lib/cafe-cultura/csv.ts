import type { CafeAdminParticipant } from "./types";

function cell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
function expectationLabel(value: CafeAdminParticipant["expectationStatus"]): string {
  if (value === "excused_absence") return "Ausência justificada";
  if (value === "excluded") return "Excluído";
  return "Confirmado";
}

export function buildCafeAttendanceCsv(participants: CafeAdminParticipant[]): string {
  const header = ["Nome", "E-mail", "Área", "Situação", "Presença", "Horário"].join(";");
  const rows = participants.map((participant) =>
    [
      participant.name,
      participant.email ?? "",
      participant.department ?? "",
      expectationLabel(participant.expectationStatus),
      participant.checkinAt ? "Presente" : "Não registrada",
      participant.checkinAt
        ? new Intl.DateTimeFormat("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          }).format(new Date(participant.checkinAt))
        : "",
    ]
      .map(cell)
      .join(";")
  );
  return `\uFEFF${[header, ...rows].join("\r\n")}\r\n`;
}
