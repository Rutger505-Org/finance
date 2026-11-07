/**
 * ABN AMRO statement export, TXT/TAB format: one transaction per line, 8
 * tab-separated columns without a header:
 *
 *   account  currency  date  balanceBefore  balanceAfter  valueDate  amount  description
 *
 * Dates are YYYYMMDD, amounts Dutch decimals ("-3,59"). The first seven
 * columns never contain spaces, so lines whose tabs were turned into spaces
 * (copied from a chat) parse too. Amounts here are cents.
 */

export interface StatementLine {
  /** 1-based line number in the input, for errors. */
  lineNumber: number;
  accountNumber: string;
  /** Booking date, YYYY-MM-DD. */
  date: string;
  balanceBefore: number;
  balanceAfter: number;
  /** Bank sign: negative is money out. */
  amount: number;
  description: string;
  details: StatementDetails;
}

export interface StatementDetails {
  /** BEA (card), GEA (cash), iDEAL/Wero, SEPA Overboeking, SEPA Incasso ... */
  type: string;
  /** Merchant or account holder. */
  name: string;
  iban: string | null;
  remittance: string | null;
  /** When the card or iDEAL payment happened, YYYY-MM-DDTHH:MM. */
  paidAt: string | null;
}

export class StatementError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join("\n"));
  }
}

/** "1.247,30" / "-3,59" → cents. */
function cents(text: string): number | null {
  if (!/^-?[\d.]+,\d{2}$/.test(text)) return null;
  return Math.round(Number(text.replaceAll(".", "").replace(",", ".")) * 100);
}

function isoDate(text: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Collapsed whitespace; empty becomes null. */
function clean(text: string | undefined): string | null {
  const value = text?.replace(/\s+/g, " ").trim();
  if (!value) return null;
  return value;
}

/** "dd.mm.yy/HH:MM" (card) or "dd-mm-yyyy HH:MM" (iDEAL reference). */
function paidAt(text: string): string | null {
  const card = /(\d{2})\.(\d{2})\.(\d{2})\/(\d{2}:\d{2})/.exec(text);
  if (card) return `20${card[3]}-${card[2]}-${card[1]}T${card[4]}`;
  const ideal = /(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2})/.exec(text);
  if (ideal) return `${ideal[3]}-${ideal[2]}-${ideal[1]}T${ideal[4]}`;
  return null;
}

const SLASH_KEYS = ["TRTP", "RTYP", "CSID", "NAME", "MARF", "REMI", "IBAN", "BIC", "EREF", "ORDP", "ID", "ADDR", "SWOC"];

/** "/TRTP/iDEAL/Wero/IBAN/NL.../NAME/Shop/REMI/.../EREF/..." */
function slashFields(description: string): Record<string, string> {
  const pattern = new RegExp(`/(${SLASH_KEYS.join("|")})/`, "g");
  const fields: Record<string, string> = {};
  const marks = [...description.matchAll(pattern)];
  marks.forEach((mark, index) => {
    const start = mark.index + mark[0].length;
    const end = index + 1 < marks.length ? marks[index + 1].index : description.length;
    fields[mark[1]] ??= description.slice(start, end);
  });
  return fields;
}

/** "SEPA Overboeking IBAN: NL... BIC: ... Naam: Shop Omschrijving: ... Kenmerk: ..." */
function labelFields(description: string): Record<string, string> {
  const pattern = /\b(IBAN|BIC|Naam|Omschrijving|Kenmerk|Machtiging|Incassant):\s/g;
  const fields: Record<string, string> = {};
  const marks = [...description.matchAll(pattern)];
  if (marks.length > 0) fields.type = description.slice(0, marks[0].index);
  marks.forEach((mark, index) => {
    const start = mark.index + mark[0].length;
    const end = index + 1 < marks.length ? marks[index + 1].index : description.length;
    fields[mark[1]] ??= description.slice(start, end);
  });
  return fields;
}

export function parseDetails(description: string): StatementDetails {
  const card = /^(BEA|GEA), (?:Google Pay|Apple Pay|Betaalpas)\s+(.*?),PAS\d+/.exec(description);
  if (card) {
    return { type: card[1], name: clean(card[2]) ?? card[1], iban: null, remittance: null, paidAt: paidAt(description) };
  }
  if (description.startsWith("/")) {
    const fields = slashFields(description);
    return {
      type: clean(fields.TRTP ?? fields.RTYP) ?? "Onbekend",
      name: clean(fields.NAME) ?? clean(description.slice(0, 100))!,
      iban: clean(fields.IBAN)?.toUpperCase() ?? null,
      remittance: clean(fields.REMI),
      paidAt: fields.EREF ? paidAt(fields.EREF) : null,
    };
  }
  const fields = labelFields(description);
  if (fields.Naam) {
    return {
      type: clean(fields.type) ?? "Onbekend",
      name: clean(fields.Naam)!,
      iban: clean(fields.IBAN)?.toUpperCase() ?? null,
      remittance: clean(fields.Omschrijving),
      paidAt: fields.Kenmerk ? paidAt(fields.Kenmerk) : null,
    };
  }
  // Bank costs and anything else: the description is all there is.
  return { type: "Overig", name: clean(description.slice(0, 100)) ?? "Onbekend", iban: null, remittance: null, paidAt: null };
}

/** Throws a {@link StatementError} listing every bad line; nothing is half-parsed. */
export function parseStatement(text: string): StatementLine[] {
  const lines: StatementLine[] = [];
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1;
    if (raw.trim() === "") return;
    let columns = raw.split("\t");
    if (columns.length < 8) {
      const match = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/.exec(raw.trim());
      if (!match) {
        problems.push(`Regel ${lineNumber}: verwacht 8 kolommen`);
        return;
      }
      columns = match.slice(1);
    }
    const [accountNumber, currency, date, before, after, , amount, ...rest] = columns.map((c) => c.trim());
    const description = rest.join(" ").trim();
    const parsed = {
      date: isoDate(date),
      balanceBefore: cents(before),
      balanceAfter: cents(after),
      amount: cents(amount),
    };
    if (currency !== "EUR") problems.push(`Regel ${lineNumber}: valuta ${currency}, alleen EUR wordt ondersteund`);
    for (const [key, value] of Object.entries(parsed)) {
      if (value === null) problems.push(`Regel ${lineNumber}: ongeldige ${key}`);
    }
    if (Object.values(parsed).includes(null) || currency !== "EUR") return;
    if (parsed.balanceBefore! + parsed.amount! !== parsed.balanceAfter!) {
      problems.push(`Regel ${lineNumber}: beginsaldo + bedrag is niet het eindsaldo`);
      return;
    }
    lines.push({
      lineNumber,
      accountNumber: accountNumber,
      date: parsed.date!,
      balanceBefore: parsed.balanceBefore!,
      balanceAfter: parsed.balanceAfter,
      amount: parsed.amount!,
      description,
      details: parseDetails(description),
    });
  });
  if (problems.length > 0) throw new StatementError(problems);
  if (lines.length === 0) throw new StatementError(["Geen transacties gevonden"]);
  const accounts = new Set(lines.map((line) => line.accountNumber));
  if (accounts.size > 1) throw new StatementError([`Meer dan één rekening in dit bestand: ${[...accounts].join(", ")}`]);
  return lines;
}

/** Lines whose start balance isn't the previous line's end balance: a gap or reordering in the export. */
export function balanceGaps(lines: StatementLine[]): string[] {
  const gaps: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const previous = lines[i - 1];
    const line = lines[i];
    if (previous.balanceAfter !== line.balanceBefore) {
      gaps.push(`Regel ${line.lineNumber}: beginsaldo sluit niet aan op regel ${previous.lineNumber}`);
    }
  }
  return gaps;
}

/** Identifies a line across overlapping exports. Balances chain, so this is unique in practice. */
export function lineKey(line: StatementLine): string {
  return [line.accountNumber, line.date, line.balanceBefore, line.balanceAfter, line.description].join("|");
}

/** Drop payment ids, IBANs and Tikkie references from a remittance: "001276101779 RSM01 9fe3... Pizza NL38..." → "Pizza". */
export function readableRemittance(remittance: string | null): string | null {
  if (!remittance) return null;
  const words = remittance.split(/\s+/).filter((word) => {
    const bare = word.replace(/[,.;:]+$/, "");
    if (/^RSM01/i.test(bare)) return false;
    return !(bare.length >= 6 && /\d/.test(bare) && /^[A-Za-z0-9-]+$/.test(bare));
  });
  return clean(words.join(" "));
}

/** Text for the spending made from a line. */
export function spendingDescription(details: StatementDetails): string {
  const remittance = readableRemittance(details.remittance);
  return (remittance ? `${details.name}: ${remittance}` : details.name).slice(0, 200);
}

export interface MatchableCounterparty {
  id: number;
  iban: string | null;
  match: string | null;
}

/** The counterparty whose `match` is the longest part of the line's name, else the one with its IBAN. */
export function matchCounterparty<T extends MatchableCounterparty>(
  line: { name: string; iban: string | null },
  counterparties: T[],
): T | null {
  const name = line.name.toLowerCase();
  let best: T | null = null;
  for (const counterparty of counterparties) {
    const match = counterparty.match?.toLowerCase();
    if (match && name.includes(match) && (!best || match.length > best.match!.length)) best = counterparty;
  }
  if (best) return best;
  if (!line.iban) return null;
  return counterparties.find((counterparty) => counterparty.iban === line.iban) ?? null;
}
