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

  it("monta diffs de historico por receita para adicionadas, atualizadas e removidas", () => {
    const previousData = {
      receitas: [
        {
          id: "1",
          titulo: "Bolo base",
          categoriaId: "doces",
          categoriaNome: "Doces & Sobremesas",
          tags: ["bolo"],
          tempoPreparo: "20 min",
          tempoForno: "",
          porcoes: 8,
          dificuldade: "Facil",
          foto: "",
          fotoThumb: "",
          ingredientes: ["2 ovos"],
          modoPreparo: ["Misture"],
          dica: "Dica antiga",
          criadoEm: "2026-04-18T10:00:00.000Z",
          atualizadoEm: "2026-04-18T10:00:00.000Z"
        },
        {
          id: "3",
          titulo: "Receita removida",
          categoriaId: "doces",
          categoriaNome: "Doces & Sobremesas",
          tags: [],
          tempoPreparo: "10 min",
          tempoForno: "",
          porcoes: 4,
          dificuldade: "Facil",
          foto: "",
          fotoThumb: "",
          ingredientes: ["1 item"],
          modoPreparo: ["Passo unico"],
          dica: "",
          criadoEm: "2026-04-18T09:00:00.000Z",
          atualizadoEm: "2026-04-18T09:00:00.000Z"
        }
      ],
      categorias: []
    };
    const currentData = {
      receitas: [
        {
          id: "1",
          titulo: "Bolo de laranja",
          categoriaId: "doces",
          categoriaNome: "Doces & Sobremesas",
          tags: ["bolo"],
          tempoPreparo: "20 min",
          tempoForno: "",
          porcoes: 8,
          dificuldade: "Facil",
          foto: "",
          fotoThumb: "",
          ingredientes: ["2 ovos"],
          modoPreparo: ["Misture"],
          dica: "Dica nova",
          criadoEm: "2026-04-18T10:00:00.000Z",
          atualizadoEm: "2026-04-18T11:00:00.000Z"
        },
        {
          id: "2",
          titulo: "Suco novo",
          categoriaId: "bebidas",
          categoriaNome: "Bebidas",
          tags: [],
          tempoPreparo: "5 min",
          tempoForno: "",
          porcoes: 2,
          dificuldade: "Facil",
          foto: "",
          fotoThumb: "",
          ingredientes: ["1 copo de agua"],
          modoPreparo: ["Bata tudo"],
          dica: "",
          criadoEm: "2026-04-18T12:00:00.000Z",
          atualizadoEm: "2026-04-18T12:00:00.000Z"
        }
      ],
      categorias: []
    };

    const changes = storage.__private.buildHistoryRecipeDiffs(previousData, currentData);

    expect(changes.map((change) => [change.id, change.status])).toEqual([
      ["3", "removed"],
      ["1", "updated"],
      ["2", "added"]
    ]);
    expect(changes[1].changedFields).toEqual(["Titulo", "Dica"]);
    expect(changes[0].restoreRecipe.titulo).toBe("Receita removida");
    expect(changes[2].restoreRecipe.titulo).toBe("Suco novo");
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

  it("detecta conflito em 3 vias e preserva mudancas independentes ao resolver", () => {
    const base = storage.__private.normalizeConflictRecipe({
      id: "1",
      titulo: "Bolo base",
      categoriaId: "doces",
      categoriaNome: "Doces & Sobremesas",
      tags: ["bolo"],
      tempoPreparo: "30 min",
      tempoForno: "",
      porcoes: 8,
      dificuldade: "Facil",
      foto: "",
      fotoThumb: "",
      ingredientes: ["2 ovos"],
      modoPreparo: ["Misture"],
      dica: "Dica base",
      criadoEm: "2026-04-18T10:30:00.000Z",
      atualizadoEm: "2026-04-18T10:30:00.000Z"
    });
    const local = storage.__private.normalizeConflictRecipe(Object.assign({}, base, {
      titulo: "Bolo da Geovanni",
      dica: "Dica local"
    }));
    const remote = storage.__private.normalizeConflictRecipe(Object.assign({}, base, {
      titulo: "Bolo da Maria",
      tempoPreparo: "45 min"
    }));

    const comparison = storage.__private.compareRecipeVersions(base, local, remote);
    const resolvedLocal = storage.__private.resolveConflictChoice(comparison, "local");
    const resolvedRemote = storage.__private.resolveConflictChoice(comparison, "remote");

    expect(comparison.hasConflict).toBe(true);
    expect(comparison.deletedRemotely).toBe(false);
    expect(comparison.conflicts.map((item) => item.key)).toEqual(["titulo"]);

    expect(resolvedLocal.titulo).toBe("Bolo da Geovanni");
    expect(resolvedLocal.tempoPreparo).toBe("45 min");
    expect(resolvedLocal.dica).toBe("Dica local");

    expect(resolvedRemote.titulo).toBe("Bolo da Maria");
    expect(resolvedRemote.tempoPreparo).toBe("45 min");
    expect(resolvedRemote.dica).toBe("Dica local");
  });

  it("reaproveita o snapshot cacheado do GitHub quando a rede cai", async () => {
    env.close();
    env = createBrowserEnv({
      online: false,
      fetch: vi.fn().mockRejectedValue(new Error("offline"))
    });
    env.loadScripts(["js/github-sync.js", "js/storage.js"]);
    storage = env.window.NRStorage;

    const cacheKey = env.window.GitHubSync.__private.getCacheStorageKey(env.window.GitHubSync.getRepoInfo());

    env.window.localStorage.setItem(cacheKey, JSON.stringify({
      etag: "\"etag-offline\"",
      sha: "sha-offline",
      savedAt: "2026-04-18T11:00:00.000Z",
      data: {
        receitas: [{ id: "99", titulo: "Receita em cache", categoriaId: "doces" }],
        categorias: [{ id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A" }]
      }
    }));

    await expect(storage.getAllRecipes()).resolves.toEqual([
      { id: "99", titulo: "Receita em cache", categoriaId: "doces" }
    ]);

    expect(storage.getSyncStatus().state).toBe("offline");
    expect(storage.getSyncStatus().message).toContain("ultima copia sincronizada");
  });

  it("salva favoritos localmente e retorna as receitas favoritas na ordem mais recente", async () => {
    env.window.localStorage.setItem("nr_categories", JSON.stringify([
      { id: "doces", nome: "Doces", icone: "ðŸ°", cor: "#C4845A" }
    ]));
    env.window.localStorage.setItem("nr_recipes", JSON.stringify([
      { id: "1", titulo: "Bolo", categoriaId: "doces" },
      { id: "2", titulo: "Torta", categoriaId: "doces" }
    ]));

    expect(storage.toggleFavoriteRecipe("1")).toBe(true);
    expect(storage.toggleFavoriteRecipe("2")).toBe(true);
    expect(storage.isFavoriteRecipe("1")).toBe(true);
    expect(storage.getFavoriteRecipeIds()).toEqual(["2", "1"]);

    await expect(storage.getFavoriteRecipes()).resolves.toEqual([
      { id: "2", titulo: "Torta", categoriaId: "doces" },
      { id: "1", titulo: "Bolo", categoriaId: "doces" }
    ]);

    expect(storage.toggleFavoriteRecipe("2")).toBe(false);
    expect(storage.getFavoriteRecipeIds()).toEqual(["1"]);
  });
});
