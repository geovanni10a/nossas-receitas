(function () {
  var LOCAL_KEYS = {
    cacheRecipes: "nr_cache_recipes",
    cacheCategories: "nr_cache_categories",
    lastSync: "nr_last_sync",
    favorites: "nr_favoritos"
  };

  var DEFAULT_CATEGORIES = [
    { id: "doces",   nome: "Doces & Sobremesas", icone: "🍰", cor: "#C4845A", ordem: 1 },
    { id: "massas",  nome: "Massas & Grãos",     icone: "🍝", cor: "#A0522D", ordem: 2 },
    { id: "carnes",  nome: "Carnes & Aves",      icone: "🥩", cor: "#8B4513", ordem: 3 },
    { id: "saladas", nome: "Saladas & Entradas", icone: "🥗", cor: "#6B7C5C", ordem: 4 }
  ];

  var cache = null;
  var loadingPromise = null;
  var syncState = {
    state: navigator.onLine ? "carregando" : "offline",
    message: "",
    lastSyncAt: window.localStorage.getItem(LOCAL_KEYS.lastSync) || "",
    source: "initial"
  };

  function safeParse(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // localStorage cheio: silenciosamente ignora; cache ainda fica em memória
    }
  }

  function emitFavoritesChanged(ids) {
    window.dispatchEvent(new CustomEvent("nr:favorites-changed", {
      detail: { ids: (ids || []).slice() }
    }));
  }

  function emitSyncChanged() {
    window.dispatchEvent(new CustomEvent("nr:sync-changed", {
      detail: getSyncStatus()
    }));
  }

  function setSyncState(nextState) {
    syncState = Object.assign({}, syncState, nextState);
    emitSyncChanged();
  }

  function noteSyncSuccess(source, message) {
    var now = new Date().toISOString();
    window.localStorage.setItem(LOCAL_KEYS.lastSync, now);
    setSyncState({
      state: "sincronizado",
      lastSyncAt: now,
      source: source || "supabase",
      message: message || "Dados atualizados com o Supabase."
    });
  }

  function getSyncStatus() {
    var state = Object.assign({}, syncState);

    if (!navigator.onLine) {
      state.state = "offline";
      state.message = state.lastSyncAt
        ? "Sem conexão; exibindo a última cópia sincronizada."
        : "Sem conexão e sem cópia local recente.";
    }

    return state;
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "categoria";
  }

  function getCachedRecipes() {
    return safeParse(LOCAL_KEYS.cacheRecipes, []);
  }

  function getCachedCategories() {
    var cached = safeParse(LOCAL_KEYS.cacheCategories, null);
    return Array.isArray(cached) && cached.length ? cached : DEFAULT_CATEGORIES.slice();
  }

  function persistCache(recipes, categories) {
    writeJson(LOCAL_KEYS.cacheRecipes, recipes);
    writeJson(LOCAL_KEYS.cacheCategories, categories);
  }

  function getFavoriteRecipeIds() {
    var ids = safeParse(LOCAL_KEYS.favorites, []);
    if (!Array.isArray(ids)) {
      return [];
    }

    var unique = [];
    ids.forEach(function (id) {
      var normalized = String(id || "").trim();
      if (normalized && unique.indexOf(normalized) === -1) {
        unique.push(normalized);
      }
    });
    return unique;
  }

  function persistFavoriteRecipeIds(ids) {
    var normalized = (ids || []).map(function (id) { return String(id || "").trim(); }).filter(Boolean);

    if (normalized.length) {
      writeJson(LOCAL_KEYS.favorites, normalized);
    } else {
      window.localStorage.removeItem(LOCAL_KEYS.favorites);
    }

    emitFavoritesChanged(normalized);
    return normalized;
  }

  function isFavoriteRecipe(id) {
    return getFavoriteRecipeIds().indexOf(String(id || "")) !== -1;
  }

  function setFavoriteRecipe(id, shouldFavorite) {
    var recipeId = String(id || "").trim();
    if (!recipeId) {
      return false;
    }

    var ids = getFavoriteRecipeIds().filter(function (currentId) { return currentId !== recipeId; });
    if (shouldFavorite) {
      ids.unshift(recipeId);
    }
    persistFavoriteRecipeIds(ids);
    return shouldFavorite;
  }

  function toggleFavoriteRecipe(id) {
    return setFavoriteRecipe(id, !isFavoriteRecipe(id));
  }

  function discardFavoriteRecipe(id) {
    var recipeId = String(id || "").trim();
    if (!recipeId || !isFavoriteRecipe(recipeId)) {
      return;
    }
    persistFavoriteRecipeIds(getFavoriteRecipeIds().filter(function (currentId) { return currentId !== recipeId; }));
  }

  function invalidateCache() {
    cache = null;
    loadingPromise = null;
  }

  function normalizeRecipe(recipe) {
    var now = new Date().toISOString();
    var categoriaNome = String(recipe.categoriaNome || "").trim();
    var categoriaId = slugify(recipe.categoriaId || categoriaNome);

    return {
      id: recipe && recipe.id ? String(recipe.id) : String(Date.now()),
      titulo: String(recipe.titulo || "").trim(),
      categoriaId: categoriaId,
      categoriaNome: categoriaNome,
      tags: Array.isArray(recipe.tags) ? recipe.tags.filter(Boolean) : [],
      tempoPreparo: String(recipe.tempoPreparo || "").trim(),
      tempoForno: String(recipe.tempoForno || "").trim(),
      porcoes: Number(recipe.porcoes || 0),
      dificuldade: String(recipe.dificuldade || "Facil"),
      foto: String(recipe.foto || ""),
      fotoThumb: String(recipe.fotoThumb || ""),
      ingredientes: Array.isArray(recipe.ingredientes) ? recipe.ingredientes.filter(Boolean) : [],
      modoPreparo: Array.isArray(recipe.modoPreparo) ? recipe.modoPreparo.filter(Boolean) : [],
      dica: String(recipe.dica || "").trim(),
      criadoEm: recipe && recipe.criadoEm ? String(recipe.criadoEm) : now,
      atualizadoEm: now
    };
  }

  async function carregar(forceRefresh) {
    if (forceRefresh) {
      invalidateCache();
    }

    if (cache) {
      return cache;
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = (async function () {
      try {
        var recipes = await window.NRSupabase.listRecipes();
        var categories = await window.NRSupabase.listCategories();

        if (!categories.length) {
          categories = DEFAULT_CATEGORIES.slice();
        }

        cache = { recipes: recipes, categories: categories };
        persistCache(recipes, categories);
        noteSyncSuccess("supabase", "Receitas atualizadas do Supabase.");
      } catch (error) {
        var cachedRecipes = getCachedRecipes();
        var cachedCategories = getCachedCategories();
        cache = { recipes: cachedRecipes, categories: cachedCategories, error: error };
        setSyncState({
          state: navigator.onLine ? "erro" : "offline",
          message: navigator.onLine
            ? (error && error.message ? error.message : "Não foi possível conectar ao Supabase.")
            : (cachedRecipes.length ? "Sem conexão; exibindo última cópia." : "Sem conexão e sem dados locais."),
          source: "local"
        });
      } finally {
        loadingPromise = null;
      }

      return cache;
    })();

    return loadingPromise;
  }

  async function getAllRecipes() {
    var loaded = await carregar();
    return (loaded.recipes || []).slice();
  }

  async function getRecipeById(id) {
    var recipes = await getAllRecipes();
    return recipes.find(function (recipe) { return String(recipe.id) === String(id); }) || null;
  }

  async function getRecipesByCategory(categoryId) {
    var recipes = await getAllRecipes();
    return recipes.filter(function (recipe) { return recipe.categoriaId === categoryId; });
  }

  async function getCategories() {
    var loaded = await carregar();
    var recipes = loaded.recipes || [];

    return (loaded.categories || []).map(function (category) {
      var total = recipes.filter(function (recipe) { return recipe.categoriaId === category.id; }).length;
      return Object.assign({}, category, { totalReceitas: total });
    });
  }

  async function getCategoryById(categoryId) {
    var categorias = await getCategories();
    return categorias.find(function (category) { return category.id === categoryId; }) || null;
  }

  async function getFavoriteRecipes(limit) {
    var favoriteIds = getFavoriteRecipeIds();
    if (!favoriteIds.length) {
      return [];
    }

    var recipes = await getAllRecipes();
    var recipeMap = recipes.reduce(function (map, recipe) {
      map.set(String(recipe.id), recipe);
      return map;
    }, new Map());

    var favorites = favoriteIds.map(function (id) { return recipeMap.get(id) || null; }).filter(Boolean);
    var normalizedLimit = Number(limit || 0);
    return normalizedLimit > 0 ? favorites.slice(0, normalizedLimit) : favorites;
  }

  async function ensureCategoryExists(recipe) {
    if (!recipe.categoriaId) {
      return;
    }

    var loaded = await carregar();
    var exists = (loaded.categories || []).some(function (category) {
      return category.id === recipe.categoriaId;
    });

    if (exists) {
      return;
    }

    await window.NRSupabase.upsertCategory({
      id: recipe.categoriaId,
      nome: recipe.categoriaNome || recipe.categoriaId,
      icone: "🍽️",
      cor: "#C4845A",
      ordem: 99
    });
  }

  async function saveRecipe(recipe) {
    var normalized = normalizeRecipe(recipe);

    await ensureCategoryExists(normalized);
    var saved = await window.NRSupabase.upsertRecipe(normalized);

    invalidateCache();
    noteSyncSuccess("supabase", "Receita salva no Supabase.");
    return saved;
  }

  async function deleteRecipe(id) {
    var recipeId = String(id);

    await window.NRSupabase.removeRecipe(recipeId);
    discardFavoriteRecipe(recipeId);
    invalidateCache();
    noteSyncSuccess("supabase", "Receita removida do Supabase.");
  }

  async function refreshSync() {
    invalidateCache();
    return carregar(true);
  }

  async function initDefaultData() {
    setSyncState(getSyncStatus());
  }

  function estimateRecipeSize(recipe) {
    return new Blob([JSON.stringify(recipe || {})]).size;
  }

  window.NRStorage = {
    getAllRecipes: getAllRecipes,
    getRecipeById: getRecipeById,
    getRecipesByCategory: getRecipesByCategory,
    getCategories: getCategories,
    getCategoryById: getCategoryById,
    getFavoriteRecipeIds: getFavoriteRecipeIds,
    getFavoriteRecipes: getFavoriteRecipes,
    getSyncStatus: getSyncStatus,
    isFavoriteRecipe: isFavoriteRecipe,
    saveRecipe: saveRecipe,
    setFavoriteRecipe: setFavoriteRecipe,
    toggleFavoriteRecipe: toggleFavoriteRecipe,
    deleteRecipe: deleteRecipe,
    refreshSync: refreshSync,
    initDefaultData: initDefaultData,
    slugify: slugify,
    estimateRecipeSize: estimateRecipeSize,
    __private: {
      normalizeRecipe: normalizeRecipe,
      DEFAULT_CATEGORIES: DEFAULT_CATEGORIES
    }
  };
})();
