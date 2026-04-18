const { createBrowserEnv } = require("./helpers/browser-env");

describe("NRDiagnostics", () => {
  let env;
  let diagnostics;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScript("js/diagnostics.js");
    diagnostics = env.window.NRDiagnostics;
  });

  afterEach(() => {
    env.close();
  });

  it("registra entradas mais recentes primeiro", () => {
    diagnostics.log({ source: "github-sync", kind: "read", status: "success", message: "Primeira" });
    diagnostics.log({ source: "storage", kind: "write", status: "local", message: "Segunda" });

    expect(diagnostics.getEntries(2).map((entry) => entry.message)).toEqual(["Segunda", "Primeira"]);
  });

  it("compacta o buffer para respeitar o limite de 50KB", () => {
    Array.from({ length: 80 }).forEach((_, index) => {
      diagnostics.log({
        source: "github-sync",
        kind: "write",
        status: "retry",
        message: "Evento " + index,
        details: "x".repeat(1200)
      });
    });

    const stored = env.window.localStorage.getItem("nr_log");

    expect(new Blob([stored]).size).toBeLessThanOrEqual(diagnostics.MAX_BYTES);
    expect(diagnostics.getEntries().length).toBeLessThan(80);
    expect(diagnostics.getEntries(1)[0].message).toBe("Evento 79");
  });

  it("exporta o log como texto e limpa o buffer", () => {
    diagnostics.log({
      at: "2026-04-18T12:00:00.000Z",
      source: "storage",
      kind: "sync",
      status: "fallback",
      message: "Usando dados locais",
      details: "Sem conexao"
    });

    expect(diagnostics.exportText()).toContain("storage/sync/fallback");
    diagnostics.clear();
    expect(diagnostics.getEntries()).toEqual([]);
  });
});
