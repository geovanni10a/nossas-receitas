const { createBrowserEnv } = require("./helpers/browser-env");

describe("NRStorage", () => {
  let env;
  let storage;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScripts(["js/github-sync.js", "js/storage.js"]);
    storage = env.window.NRStorage;
  });

  afterEach(() => {
    env.close();
  });

  it("gera slugs removendo acentos e pontuacao", () => {
    expect(storage.slugify("Doces & Sobremesas")).toBe("doces-sobremesas");
    expect(storage.slugify("  Pães, Bolos e Cia. ")).toBe("paes-bolos-e-cia");
  });

  it("normaliza dados usando categorias padrao quando faltam", () => {
    const normalized = storage.__private.normalizeData({ receitas: [{ id: "1" }] });

    expect(normalized.receitas).toHaveLength(1);
    expect(normalized.categorias).toHaveLength(7);
  });

  it("mantem a receita local mais recente ao mesclar", () => {
    const merged = storage.__private.mergeRecipes(
      [{ id: "1", titulo: "Local", atualizadoEm: "2026-04-18T12:30:00.000Z" }],
      [
        { id: "1", titulo: "Remota", atualizadoEm: "2026-04-18T12:00:00.000Z" },
        { id: "2", titulo: "Outra", atualizadoEm: "2026-04-18T11:00:00.000Z" }
      ]
    );

    expect(merged).toEqual([
      { id: "1", titulo: "Local", atualizadoEm: "2026-04-18T12:30:00.000Z" },
      { id: "2", titulo: "Outra", atualizadoEm: "2026-04-18T11:00:00.000Z" }
    ]);
  });

  it("preserva categorias do GitHub e adiciona extras locais", () => {
    const merged = storage.__private.mergeCategories(
      [{ id: "bebidas", nome: "Bebidas", icone: "🥤", cor: "#7B9EA6" }],
      [{ id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A" }]
    );

    expect(merged).toEqual([
      { id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A" },
      { id: "bebidas", nome: "Bebidas", icone: "🥤", cor: "#7B9EA6" }
    ]);
  });

  it("combina receitas e categorias em uma unica estrutura", () => {
    const merged = storage.__private.mergeData(
      {
        receitas: [{ id: "1", titulo: "Local", atualizadoEm: "2026-04-18T12:30:00.000Z" }],
        categorias: [{ id: "bebidas", nome: "Bebidas", icone: "🥤", cor: "#7B9EA6" }]
      },
      {
        receitas: [{ id: "2", titulo: "Remota", atualizadoEm: "2026-04-18T10:00:00.000Z" }],
        categorias: [{ id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A" }]
      }
    );

    expect(merged.receitas.map((recipe) => recipe.id)).toEqual(["2", "1"]);
    expect(merged.categorias.map((category) => category.id)).toEqual(["doces", "bebidas"]);
  });

  it("bloqueia payloads grandes demais para o repositorio", () => {
    const bigRecipe = {
      receitas: [{
        id: "1",
        foto: "x".repeat(980 * 1024)
      }],
      categorias: []
    };

    expect(() => storage.__private.validateRepositorySize(bigRecipe)).toThrow(/grande demais/);
  });
});
