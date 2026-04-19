const categories = [
  { id: "doces", nome: "Doces & Sobremesas", icone: "🍰", cor: "#C4845A", ordem: 1 },
  { id: "massas", nome: "Massas & Grãos", icone: "🍝", cor: "#A0522D", ordem: 2 },
  { id: "carnes", nome: "Carnes & Aves", icone: "🥩", cor: "#8B4513", ordem: 3 },
  { id: "saladas", nome: "Saladas & Entradas", icone: "🥗", cor: "#6B7C5C", ordem: 4 }
];

const SUPABASE_HOST = "https://rurqwnwomrssnhxhsgfh.supabase.co";
const receitasPattern = `${SUPABASE_HOST}/rest/v1/receitas**`;
const categoriasPattern = `${SUPABASE_HOST}/rest/v1/categorias**`;

function toRow(recipe) {
  return {
    id: String(recipe.id),
    titulo: recipe.titulo || "",
    categoria_id: recipe.categoriaId || null,
    categoria_nome: recipe.categoriaNome || "",
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    tempo_preparo: recipe.tempoPreparo || "",
    tempo_forno: recipe.tempoForno || "",
    porcoes: Number(recipe.porcoes || 0),
    dificuldade: recipe.dificuldade || "Facil",
    foto: recipe.foto || "",
    foto_thumb: recipe.fotoThumb || "",
    ingredientes: Array.isArray(recipe.ingredientes) ? recipe.ingredientes : [],
    modo_preparo: Array.isArray(recipe.modoPreparo) ? recipe.modoPreparo : [],
    dica: recipe.dica || "",
    criado_em: recipe.criadoEm || new Date().toISOString(),
    atualizado_em: recipe.atualizadoEm || new Date().toISOString()
  };
}

function categoryToRow(category) {
  return {
    id: String(category.id),
    nome: category.nome,
    icone: category.icone || "🍽️",
    cor: category.cor || "#C4845A",
    ordem: Number(category.ordem || 100)
  };
}

/**
 * Mocks Supabase REST endpoints used by NRSupabase. Supports GET (list) and
 * all other verbs (resolved as the same rows returned for GET).
 */
async function mockSupabase(page, options = {}) {
  const state = {
    recipes: Array.isArray(options.recipes) ? options.recipes.slice() : [],
    categories: Array.isArray(options.categories) ? options.categories.slice() : categories.slice(),
    failRecipes: options.failRecipes === true,
    failMessage: options.failMessage || "Supabase indisponivel"
  };

  await page.route(categoriasPattern, async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(state.categories.map(categoryToRow))
      });
      return;
    }

    let payload = [];
    try {
      payload = JSON.parse(request.postData() || "[]");
    } catch (error) {
      payload = [];
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload)
    });
  });

  await page.route(receitasPattern, async (route) => {
    const request = route.request();
    const method = request.method();

    if (state.failRecipes && method === "GET") {
      await route.fulfill({
        status: 500,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ message: state.failMessage })
      });
      return;
    }

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(state.recipes.map(toRow))
      });
      return;
    }

    if (method === "DELETE") {
      await route.fulfill({
        status: 204,
        contentType: "application/json; charset=utf-8",
        body: ""
      });
      return;
    }

    let payload = [];
    try {
      payload = JSON.parse(request.postData() || "[]");
    } catch (error) {
      payload = [];
    }
    const rows = Array.isArray(payload) ? payload : [payload];
    rows.forEach((row) => {
      state.recipes = state.recipes.filter((item) => String(item.id) !== String(row.id));
      state.recipes.unshift({
        id: row.id,
        titulo: row.titulo,
        categoriaId: row.categoria_id,
        categoriaNome: row.categoria_nome,
        tags: row.tags || [],
        tempoPreparo: row.tempo_preparo,
        tempoForno: row.tempo_forno,
        porcoes: row.porcoes,
        dificuldade: row.dificuldade,
        foto: row.foto,
        fotoThumb: row.foto_thumb,
        ingredientes: row.ingredientes || [],
        modoPreparo: row.modo_preparo || [],
        dica: row.dica,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em
      });
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(rows)
    });
  });

  return state;
}

module.exports = {
  SUPABASE_HOST,
  receitasPattern,
  categoriasPattern,
  categories,
  mockSupabase
};
