import { describe, expect, it } from "vitest";
import { emptyProgress, formatDuration, overallFraction, parseProgress, phaseFraction, ProgressReporter } from "@/lib/news/progress";

describe("progresso do ciclo", () => {
  it("começa em 0% e termina em 100%", () => {
    const p = emptyProgress();
    expect(overallFraction(p)).toBe(0);
    for (const ph of p.phases) ph.status = "done";
    expect(overallFraction(p)).toBe(1);
  });

  it("etapa pulada conta como concluída; etapa em andamento usa done/total", () => {
    const p = emptyProgress();
    p.phases[0] = { ...p.phases[0]!, status: "running", done: 7, total: 14 };
    expect(phaseFraction(p.phases[0]!)).toBe(0.5);
    expect(phaseFraction({ ...p.phases[2]!, status: "skipped" })).toBe(1);
    // coleta pesa 30%: metade da coleta = 15% do total
    expect(overallFraction(p)).toBeCloseTo(0.15, 5);
  });

  it("reporter acumula incrementos e grava o estado final", async () => {
    const writes: string[] = [];
    const fakeDb = { ingestionRun: { update: async ({ data }: { data: { progress: string } }) => void writes.push(data.progress) } };
    const r = new ProgressReporter(fakeDb as never, "run1", 10_000);
    r.update("sources", { status: "running", total: 3 });
    r.increment("sources");
    r.increment("sources");
    r.increment("sources", "última");
    r.update("sources", { status: "done" });
    await r.finish();
    const last = parseProgress(writes.at(-1))!;
    expect(last.phases[0]).toMatchObject({ status: "done", done: 3, total: 3, detail: "última" });
    // Limitado por frequência: incrementos sem mudança de estado não gravam a cada chamada.
    expect(writes.length).toBeLessThan(5);
  });

  it("formata durações", () => {
    expect(formatDuration(42_000)).toBe("42 s");
    expect(formatDuration(185_000)).toBe("3 min 05 s");
    expect(formatDuration(4_320_000)).toBe("1 h 12 min");
  });

  it("JSON inválido não quebra o painel", () => {
    expect(parseProgress("{")).toBeNull();
    expect(parseProgress("{}")).toBeNull();
  });
});
