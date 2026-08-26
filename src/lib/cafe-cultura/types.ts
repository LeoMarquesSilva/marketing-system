export type CafeExpectationStatus = "confirmed" | "excused_absence" | "excluded";
export type CafeExpectationSource = "automatic_roster" | "responsum" | "admin";
export type CafeCheckinSource = "nfc" | "qr" | "admin";
export type CafeWindowState = "before" | "open" | "closed";

export interface CafeWindow {
  opensAt: string;
  closesAt: string;
}

export interface CafeCurrentView {
  event: {
    id: string;
    name: string;
    eventDate: string;
    location: string | null;
    attendanceCutoffAt: string | null;
    checkinOpensAt: string;
    checkinClosesAt: string;
  };
  collaborator: {
    id: string;
    name: string;
    avatarUrl: string | null;
    expectationStatus: CafeExpectationStatus;
    checkinAt: string | null;
  };
  windowState: CafeWindowState;
}

export interface CafeAdminParticipant {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  department: string | null;
  avatarUrl: string | null;
  expectationStatus: CafeExpectationStatus;
  expectationSource: CafeExpectationSource;
  checkinAt: string | null;
  checkinSource: CafeCheckinSource | null;
  responsumTicketCount: number;
}

export interface CafeAdminData {
  event: CafeCurrentView["event"];
  summary: {
    total: number;
    expected: number;
    excused: number;
    excluded: number;
    present: number;
    pending: number;
  };
  participants: CafeAdminParticipant[];
  lastSync: {
    status: "running" | "success" | "error";
    ticketsFound: number;
    participantsUpdated: number;
    unmatchedTickets: number;
    startedAt: string;
    finishedAt: string | null;
  } | null;
}

export interface CafeAdminEdition {
  id: string;
  name: string;
  eventDate: string;
  location: string | null;
  attendanceCutoffAt: string | null;
  checkinOpensAt: string;
  checkinClosesAt: string;
  summary: CafeAdminData["summary"];
}
