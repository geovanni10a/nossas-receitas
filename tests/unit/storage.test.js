const { createBrowserEnv } = require("./helpers/browser-env");

function installSupabaseMock(env, { recipes = [], categories = [] } = {}) {
  env.window.NRSupabase = {
    listRecipes: async () => recipes.slice(),
    listCategories: async () => categories.slice(),
    upsertRecipe: async (recipe) => recipe,
    upsertCategory: async (category) => category,
    removeRecipe: async () => {},
    pingSupabase: async () => true,
    getConfig: () => ({ url: "https://example.supabase.co" })
  };
}

describe("NRStorage", () => {
  let env;
  let storage;

  beforeEach(() => {
    env = createBrowserEnv();
    installSupabaseMock(env);
    env.loadScripts(["js/storage.js"]);
    storage = env.window.NRStorage;
  });

  afterEach(() => {
    env.close();
  });

  it("gera slugs removendo acentos e pontuacao", () => {
    expect(storage.slugify("Doces & Sobremesas")).toBe("doces-sobremesas");
    expect(storage.slugify("  Pães, Bolos e Cia. ")).toBe("paes-bolos-e-cia");
  });

  it("normaliza receita preenchendo defaults seguros", () => {
    const normalized = storage.__private.normalizeRecipe({
      id: "42",
      titulo: "  Bolo  ",
      categoriaNome: "Doces",
      ingredientes: ["2 ovos", null, ""],
      modoPreparo: ["Misture"]
    });

    expect(normalized.id).toBe("42");
    expect(normalized.titulo).toBe("Bolo");
    expect(normalized.categoriaId).toBe("doces");
    expect(normalized.ingredientes).toEqual(["2 ovos"]);
    expect(normalized.modoPreparo).toEqual(["Misture"]);
    expect(normalized.dificuldade).toBe("Facil");
  });

  it("expõe categorias padrão quando o Supabase ainda não tem nenhuma", async () => {
    const categories = await storage.getCategories();
    expect(categories.map((cat) => cat.id)).toEqual(["doces", "massas", "carnes", "saladas"]);
    expect(categories.every((cat) => cat.totalReceitas === 0)).toBe(true);
  });

  it("salva favoritos localmente e retorna receitas favoritas na ordem mais recente", async () => {
    env.close();
    env = createBrowserEnv();
    installSupabaseMock(env, {
      categories: [{ id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A", ordem: 1 }],
      recipes: [
        { id: "1", titulo: "Bolo", categoriaId: "doces" },
        { id: "2", titulo: "Torta", categoriaId: "doces" }
      ]
    });
    env.loadScripts(["js/storage.js"]);
    storage = env.window.NRStorage;

    expect(storage.toggleFavoriteRecipe("1")).toBe(true);
    expect(storage.toggleFavoriteRecipe("2")).toBe(true);
    expect(storage.isFavoriteRecipe("1")).toBe(true);
    expect(storage.getFavoriteRecipeIds()).toEqual(["2", "1"]);

    const favorites = await storage.getFavoriteRecipes();
    expect(favorites.map((recipe) => recipe.id)).toEqual(["2", "1"]);

    expect(storage.toggleFavoriteRecipe("2")).toBe(false);
    expect(storage.getFavoriteRecipeIds()).toEqual(["1"]);
  });

  it("reporta estado de erro quando o Supabase falha e serve cache local", async () => {
    env.close();
    env = createBrowserEnv();
    env.window.localStorage.setItem("nr_cache_recipes", JSON.stringify([
      { id: "99", titulo: "Receita em cache", categoriaId: "doces" }
    ]));
    env.window.localStorage.setItem("nr_cache_categories", JSON.stringify([
      { id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A", ordem: 1 }
    ]));
    env.window.NRSupabase = {
      listRecipes: async () => { throw new Error("boom"); },
      listCategories: async () => [],
      upsertRecipe: async (recipe) => recipe,
      upsertCategory: async (category) => category,
      removeRecipe: async () => {},
      pingSupabase: async () => false,
      getConfig: () => ({ url: "https://example.supabase.co" })
    };
    env.loadScripts(["js/storage.js"]);
    storage = env.window.NRStorage;

    const recipes = await storage.getAllRecipes();
    expect(recipes).toEqual([
      { id: "99", titulo: "Receita em cache", categoriaId: "doces" }
    ]);
    expect(storage.getSyncStatus().state).toBe("erro");
  });
});
