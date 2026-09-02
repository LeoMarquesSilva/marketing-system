/** Regras de calendário útil (piloto: sáb/dom recuam). */

export function parseISODate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function backUtil(d: Date): Date {
  const x = new Date(d);
  while (x.getDay() === 0 || x.getDay() === 6) {
    x.setDate(x.getDate() - 1);
  }
  return x;
}

export function prevBiz(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return backUtil(x);
}

/** N dias úteis antes da âncora (recua FDS). */
export function backNUtil(anchor: Date, n: number): Date {
  let x = new Date(anchor);
  for (let i = 0; i < n; i++) {
    x = prevBiz(x);
  }
  return x;
}

export function addHours(time: string, hours: number): string {
  const [hh, mm] = time.split(":").map(Number);
  const total = hh * 60 + (mm || 0) + hours * 60;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Protocolar UNA: D-2 úteis; se cair no FATAL (= prev_biz(AUD)) usa FATAL-1 útil. */
export function unaProtocolarDate(audISO: string): string {
  const aud = parseISODate(audISO);
  const fatal = prevBiz(aud);
  let prot = backNUtil(aud, 2);
  if (toISODate(prot) === toISODate(fatal)) {
    prot = prevBiz(fatal);
  }
  return toISODate(prot);
}

export function unaDefesaDate(audISO: string): string {
  return toISODate(backNUtil(parseISODate(audISO), 4));
}

export function fatalProtocolarDate(fatalISO: string): string {
  return toISODate(prevBiz(parseISODate(fatalISO)));
}
