(function () {
  var SUPABASE_URL = "https://rurqwnwomrssnhxhsgfh.supabase.co";
  var SUPABASE_KEY = "sb_publishable_aUz3-1pJ9oFgUJSwJeo6qw_t2UGodhI";

  function rowToRecipe(row) {
    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      titulo: row.titulo || "",
      categoriaId: row.categoria_id || "",
      categoriaNome: row.categoria_nome || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
      tempoPreparo: row.tempo_preparo || "",
      tempoForno: row.tempo_forno || "",
      porcoes: Number(row.porcoes || 0),
      dificuldade: row.dificuldade || "Facil",
      foto: row.foto || "",
      fotoThumb: row.foto_thumb || "",
      ingredientes: Array.isArray(row.ingredientes) ? row.ingredientes : [],
      modoPreparo: Array.isArray(row.modo_preparo) ? row.modo_preparo : [],
      dica: row.dica || "",
      criadoEm: row.criado_em || "",
      atualizadoEm: row.atualizado_em || ""
    };
  }

  function recipeToRow(recipe) {
    return {
      id: String(recipe.id),
      titulo: String(recipe.titulo || ""),
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
      atualizado_em: new Date().toISOString()
    };
  }

  function rowToCategory(row) {
    return {
      id: String(row.id),
      nome: row.nome || "",
      icone: row.icone || "🍽️",
      cor: row.cor || "#C4845A",
      ordem: Number(row.ordem || 100)
    };
  }

  function categoryToRow(category) {
    return {
      id: String(category.id),
      nome: String(category.nome || ""),
      icone: category.icone || "🍽️",
      cor: category.cor || "#C4845A",
      ordem: Number(category.ordem || 100)
    };
  }

  function getClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("SDK do Supabase nao carregou. Verifique sua conexao.");
    }

    if (!window.__nrSupabaseClient) {
      window.__nrSupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });
    }

    return window.__nrSupabaseClient;
  }

  async function listRecipes() {
    var client = getClient();
    var response = await client
      .from("receitas")
      .select("*")
      .order("atualizado_em", { ascending: false });

    if (response.error) {
      throw new Error("Erro ao ler receitas: " + response.error.message);
    }

    return (response.data || []).map(rowToRecipe);
  }

  async function listCategories() {
    var client = getClient();
    var response = await client
      .from("categorias")
      .select("*")
      .order("ordem", { ascending: true });

    if (response.error) {
      throw new Error("Erro ao ler categorias: " + response.error.message);
    }

    return (response.data || []).map(rowToCategory);
  }

  async function upsertRecipe(recipe) {
    var client = getClient();
    var response = await client
      .from("receitas")
      .upsert(recipeToRow(recipe), { onConflict: "id" })
      .select()
      .single();

    if (response.error) {
      throw new Error("Erro ao salvar receita: " + response.error.message);
    }

    return rowToRecipe(response.data);
  }

  async function upsertCategory(category) {
    var client = getClient();
    var response = await client
      .from("categorias")
      .upsert(categoryToRow(category), { onConflict: "id" })
      .select()
      .single();

    if (response.error) {
      throw new Error("Erro ao salvar categoria: " + response.error.message);
    }

    return rowToCategory(response.data);
  }

  async function removeRecipe(id) {
    var client = getClient();
    var response = await client
      .from("receitas")
      .delete()
      .eq("id", String(id));

    if (response.error) {
      throw new Error("Erro ao excluir receita: " + response.error.message);
    }
  }

  async function pingSupabase() {
    var client = getClient();
    var response = await client.from("categorias").select("id").limit(1);
    return !response.error;
  }

  window.NRSupabase = {
    listRecipes: listRecipes,
    listCategories: listCategories,
    upsertRecipe: upsertRecipe,
    upsertCategory: upsertCategory,
    removeRecipe: removeRecipe,
    pingSupabase: pingSupabase,
    getConfig: function () {
      return { url: SUPABASE_URL };
    }
  };
})();
