import { parseDay, type Day } from "@/lib/finance/dates";
import type { Account, Cycle } from "@/lib/finance/schemas";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
export const money = (cents: number): string => euro.format(Math.round(cents) / 100);
export const moneyEuros = (euros: number): string => euro.format(euros);

const shortDate = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const toDate = (day: Day) => new Date(day * 86_400_000);
export const date = (day: Day): string => shortDate.format(toDate(day));
export const dateLong = (day: Day): string => longDate.format(toDate(day));

export function relativeDate(day: Day, today: Day): string {
  if (day === today) return "vandaag";
  if (day === today + 1) return "morgen";
  return date(day);
}

export const monthNames = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

export function cycleLabel(cycle: Cycle): string {
  switch (cycle.type) {
    case "monthly":
      return `elke maand op de ${cycle.day}e`;
    case "yearly":
      return `elk jaar op ${cycle.day} ${monthNames[cycle.month - 1]}`;
    case "interval":
      return `elke ${cycle.days} dagen (vanaf ${date(parseDay(cycle.anchor))})`;
  }
}

export const accountLabel: Record<Account, string> = {
  fixed: "Incasso vaste lasten",
  current: "Terug naar lopende",
};

/** Accepts "19,49", "19.49", "1.234,56" and "-12". */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim().replace(/^€\s*/, "");
  if (trimmed === "") return null;
  const normalized = trimmed.includes(",") ? trimmed.replaceAll(".", "").replace(",", ".") : trimmed;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Euros as an editable string: 19.5 → "19,50". */
export const amountText = (euros: number): string => euros.toFixed(2).replace(".", ",");
