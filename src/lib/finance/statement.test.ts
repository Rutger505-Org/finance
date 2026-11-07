import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  balanceGaps,
  lineKey,
  matchCounterparty,
  parseStatement,
  readableRemittance,
  spendingDescription,
  StatementError,
} from "./statement";

/** Made-up lines in the real export format. */
const fixture = readFileSync(join(import.meta.dir, "fixtures/abn-amro.tab"), "utf8");

describe("parseStatement", () => {
  const lines = parseStatement(fixture);

  test("columns, cents and dates", () => {
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatchObject({
      accountNumber: "123456789",
      date: "2026-03-01",
      balanceBefore: 10000,
      balanceAfter: 9550,
      amount: -450,
    });
    expect(lines[1].amount).toBe(100000);
  });

  test("card payment: merchant and payment moment", () => {
    expect(lines[0].details).toEqual({
      type: "BEA",
      name: "Supermarkt 12",
      iban: null,
      remittance: null,
      paidAt: "2026-03-01T17:34",
    });
    // Booked on the 2nd, paid after midnight.
    expect(lines[4].details.paidAt).toBe("2026-03-03T00:41");
  });

  test("slash format: name, IBAN, remittance, iDEAL moment", () => {
    expect(lines[2].details).toMatchObject({
      type: "iDEAL/Wero",
      name: "Vriend via Tikkie",
      iban: "NL20INGB0001234567",
      paidAt: "2026-03-02T20:52",
    });
    expect(lines[1].details).toMatchObject({ name: "Werkgever BV", remittance: "Salaris maart 2026", paidAt: null });
  });

  test("label format", () => {
    expect(lines[3].details).toMatchObject({
      type: "SEPA Overboeking",
      name: "Werkgever BV",
      iban: "NL91ABNA0417164300",
      remittance: "Terug",
    });
  });

  test("anything else keeps the description as name", () => {
    expect(lines[5].details).toMatchObject({ type: "Overig", name: "ABN AMRO Bank N.V. 100,00 Storten basis 1,40" });
  });

  test("tabs copied as spaces still parse", () => {
    expect(parseStatement(fixture.replaceAll("\t", " "))).toEqual(lines);
  });

  test("bad lines reject the whole file", () => {
    const broken = fixture.replace("-4,50", "-4,51");
    expect(() => parseStatement(broken)).toThrow(StatementError);
    expect(() => parseStatement("")).toThrow(StatementError);
    expect(() => parseStatement(fixture.replace("\tEUR\t", "\tUSD\t"))).toThrow("valuta USD");
  });

  test("gaps in the balance chain", () => {
    expect(balanceGaps(lines)).toEqual([]);
    expect(balanceGaps([lines[0], lines[2]])).toHaveLength(1);
  });

  test("keys are unique per line", () => {
    expect(new Set(lines.map(lineKey)).size).toBe(lines.length);
  });
});

test("readable remittance drops ids and IBANs", () => {
  expect(readableRemittance("001234567890 RSM01a1b2c3d4e5f6a7b8 Pizza NL91ABNA0417164300")).toBe("Pizza");
  expect(readableRemittance("Order 123456 shop.nl")).toBe("Order shop.nl");
  expect(readableRemittance(null)).toBeNull();
  expect(
    spendingDescription({ type: "iDEAL/Wero", name: "Vriend via Tikkie", iban: null, paidAt: null, remittance: "001234567890 Pizza" }),
  ).toBe("Vriend via Tikkie: Pizza");
});

test("matchCounterparty: longest name part first, then IBAN", () => {
  const counterparties = [
    { id: 1, iban: null, match: "Supermarkt" },
    { id: 2, iban: null, match: "Supermarkt 12" },
    { id: 3, iban: "NL91ABNA0417164300", match: null },
  ];
  expect(matchCounterparty({ name: "SUPERMARKT 12", iban: null }, counterparties)?.id).toBe(2);
  expect(matchCounterparty({ name: "Supermarkt 99", iban: null }, counterparties)?.id).toBe(1);
  expect(matchCounterparty({ name: "Werkgever", iban: "NL91ABNA0417164300" }, counterparties)?.id).toBe(3);
  expect(matchCounterparty({ name: "Onbekend", iban: null }, counterparties)).toBeNull();
});
