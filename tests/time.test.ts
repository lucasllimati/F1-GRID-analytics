import { describe, expect, it } from "vitest";
import { countdown, dayShift, formatOffset, formatTime, isValidTimeZone, offsetMinutes, zonedLocalToUtc } from "@/lib/time";

describe("fusos IANA", () => {
  it("valida identificadores", () => {
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimeZone("Europe/Monaco")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("Brasília não tem horário de verão desde 2019 (UTC−3 o ano todo)", () => {
    expect(offsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/Sao_Paulo")).toBe(-180);
    expect(offsetMinutes(new Date("2026-07-15T12:00:00Z"), "America/Sao_Paulo")).toBe(-180);
  });

  it("aplica horário de verão histórico de Brasília (2018: UTC−2 em dezembro)", () => {
    expect(offsetMinutes(new Date("2018-12-15T12:00:00Z"), "America/Sao_Paulo")).toBe(-120);
  });

  it("Melbourne muda de UTC+11 para UTC+10 no início de abril", () => {
    expect(formatOffset(new Date("2026-03-08T04:00:00Z"), "Australia/Melbourne")).toBe("UTC+11");
    expect(formatOffset(new Date("2026-04-10T04:00:00Z"), "Australia/Melbourne")).toBe("UTC+10");
  });

  it("formata deslocamentos fracionários", () => {
    expect(formatOffset(new Date("2026-06-01T00:00:00Z"), "Asia/Kolkata")).toBe("UTC+5:30");
    expect(formatOffset(new Date("2026-06-01T00:00:00Z"), "UTC")).toBe("UTC");
  });

  it("converte o mesmo instante para cada fuso sem somar horas fixas", () => {
    const race = new Date("2026-11-08T17:00:00Z"); // GP de São Paulo 2026 (fonte: Jolpica)
    expect(formatTime(race, "America/Sao_Paulo")).toBe("14:00");
    expect(formatTime(race, "Europe/London")).toBe("17:00");
    expect(formatTime(race, "Asia/Tokyo")).toBe("02:00");
    expect(dayShift(race, "America/Sao_Paulo", "Asia/Tokyo")).toBe(1);
  });
});

describe("horário local do circuito → UTC", () => {
  it("converte com o fuso da data específica", () => {
    expect(zonedLocalToUtc("2026-03-08", "15:00", "Australia/Melbourne").toISOString()).toBe("2026-03-08T04:00:00.000Z");
    expect(zonedLocalToUtc("2026-07-05", "15:00", "Europe/London").toISOString()).toBe("2026-07-05T14:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-06", "17:00", "Asia/Dubai").toISOString()).toBe("2026-12-06T13:00:00.000Z");
  });

  it("recusa horário inexistente na transição de verão (Londres, 29/03/2026 01:30)", () => {
    expect(() => zonedLocalToUtc("2026-03-29", "01:30", "Europe/London")).toThrow(/inexistente/);
  });

  it("resolve horário ambíguo para a primeira ocorrência (Londres, 25/10/2026 01:30)", () => {
    expect(zonedLocalToUtc("2026-10-25", "01:30", "Europe/London").toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("rejeita entradas malformadas", () => {
    expect(() => zonedLocalToUtc("2026-3-8", "15:00", "Europe/London")).toThrow();
    expect(() => zonedLocalToUtc("2026-03-08", "15:00", "Nowhere/City")).toThrow();
  });
});

describe("contagem regressiva", () => {
  it("decompõe o tempo restante", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(countdown(new Date("2026-10-11T01:02:03Z"), now)).toMatchObject({ days: 1, hours: 1, minutes: 2, seconds: 3 });
  });
  it("nunca fica negativa", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(countdown(new Date("2026-10-09T23:59:59Z"), now)).toBeNull();
    expect(countdown(now, now)).toBeNull();
  });
});
