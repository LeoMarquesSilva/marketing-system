import { describe, expect, it } from "vitest";
import {
  participantColor,
  participantInitials,
  participantLabel,
  startsParticipantRun,
} from "./whatsapp-participant";

const base = { from_me: false, participant_phone: null, message_timestamp: "2026-11-03T17:05:43.000Z" };

describe("quem escreveu no grupo", () => {
  it("usa o nome, senão o telefone, senão Participante", () => {
    expect(participantLabel({ participant_name: "Samuel Willian", participant_phone: null })).toBe("Samuel Willian");
    expect(participantLabel({ participant_name: " ", participant_phone: null })).toBe("Participante");
    expect(participantLabel({ participant_name: null, participant_phone: "5519999990000" })).not.toBe("Participante");
  });

  it("tira as iniciais mesmo com símbolos no nome", () => {
    expect(participantInitials("Ricardo V.P. ∴")).toBe("RP");
    expect(participantInitials("Isadora")).toBe("I");
    expect(participantInitials("")).toBe("?");
  });

  it("dá sempre a mesma cor para a mesma pessoa", () => {
    expect(participantColor("samuel willian")).toEqual(participantColor("samuel willian"));
  });

  it("mostra o nome só na primeira mensagem de cada sequência", () => {
    const samuel1 = { ...base, participant_name: "Samuel Willian" };
    const samuel2 = { ...base, participant_name: "Samuel Willian", message_timestamp: "2026-11-03T17:05:46.000Z" };
    const isadora = { ...base, participant_name: "Isadora", message_timestamp: "2026-11-03T17:08:23.000Z" };
    expect(startsParticipantRun(undefined, samuel1)).toBe(true);
    expect(startsParticipantRun(samuel1, samuel2)).toBe(false);
    expect(startsParticipantRun(samuel2, isadora)).toBe(true);
    expect(startsParticipantRun({ ...samuel2, from_me: true }, isadora)).toBe(true);
    expect(startsParticipantRun(samuel1, { ...samuel2, message_timestamp: "2026-11-04T12:00:00.000Z" })).toBe(true);
    expect(startsParticipantRun(samuel1, { ...samuel2, from_me: true })).toBe(false);
  });
});
