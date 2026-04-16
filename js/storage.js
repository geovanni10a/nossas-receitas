(function () {
  var LOCAL_KEYS = {
    recipes: "nr_recipes",
    categories: "nr_categories",
    initialized: "nr_initialized",
    cleanedDefaults: "nr_cleaned_defaults"
  };

  var LEGACY_DEFAULT_RECIPE_IDS = ["1714000000000", "1714000000100"];
  var MAX_REPOSITORY_BYTES = 950 * 1024;
  var cache = null;
  var loadingPromise = null;

  function defaultCategories() {
    return window.GitHubSync ? window.GitHubSync.getCategoriasIniciais() : [];
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function normalizeData(data) {
    var source = data || {};
    var categorias = Array.isArray(source.categorias) && source.categorias.length
      ? source.categorias
      : defaultCategories();

    return {
      receitas: Array.isArray(source.receitas) ? source.receitas : [],
      categorias: categorias
    };
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "categoria";
  }

  function compareDates(a, b) {
    return new Date(a || 0).getTime() - new Date(b || 0).getTime();
  }

  function safeParse(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function getLocalData() {
    return normalizeData({
      receitas: safeParse(LOCAL_KEYS.recipes, []),
      categorias: safeParse(LOCAL_KEYS.categories, [])
    });
  }

  function persistLocalData(data) {
    var normalized = normalizeData(data);
    writeJson(LOCAL_KEYS.recipes, normalized.receitas);
    writeJson(LOCAL_KEYS.categories, normalized.categorias);
    window.localStorage.setItem(LOCAL_KEYS.initialized, "true");
  }

  function clearLocalData() {
    window.localStorage.removeItem(LOCAL_KEYS.recipes);
    window.localStorage.removeItem(LOCAL_KEYS.categories);
    window.localStorage.removeItem(LOCAL_KEYS.initialized);
  }

  function clearLegacyDefaultRecipes() {
    if (window.localStorage.getItem(LOCAL_KEYS.cleanedDefaults)) {
      return;
    }

    var receitas = safeParse(LOCAL_KEYS.recipes, []);
    var shouldClear = Array.isArray(receitas) && receitas.length > 0 && receitas.every(function (receita) {
      return LEGACY_DEFAULT_RECIPE_IDS.indexOf(String(receita.id)) !== -1;
    });

    if (shouldClear) {
      clearLocalData();
    }

    window.localStorage.setItem(LOCAL_KEYS.cleanedDefaults, "true");
  }

  function mergeRecipes(localRecipes, githubRecipes) {
    var map = new Map();

    (githubRecipes || []).forEach(function (recipe) {
      map.set(String(recipe.id), recipe);
    });

    (localRecipes || []).forEach(function (localRecipe) {
      var id = String(localRecipe.id);
      var githubRecipe = map.get(id);

      if (!githubRecipe) {
        map.set(id, localRecipe);
        return;
      }

      var localIsNewer = compareDates(
        localRecipe.atualizadoEm || localRecipe.criadoEm,
        githubRecipe.atualizadoEm || githubRecipe.criadoEm
      ) > 0;

      if (localIsNewer) {
        map.set(id, localRecipe);
      }
    });

    return Array.from(map.values());
  }

  function mergeCategories(localCategories, githubCategories) {
    var map = new Map();

    (githubCategories || []).forEach(function (category) {
      map.set(String(category.id), category);
    });

    (localCategories || []).forEach(function (category) {
      if (!map.has(String(category.id))) {
        map.set(String(category.id), category);
      }
    });

    return Array.from(map.values());
  }

  function mergeData(localData, githubData) {
    return {
      receitas: mergeRecipes(localData.receitas, githubData.receitas),
      categorias: mergeCategories(localData.categorias, githubData.categorias)
    };
  }

  function invalidateCache() {
    cache = null;
    loadingPromise = null;
  }

  async function carregar() {
    clearLegacyDefaultRecipes();

    if (cache) {
      return cache;
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = (async function () {
      var localData = getLocalData();

      try {
        var remote = await window.GitHubSync.lerReceitas();
        cache = {
          data: mergeData(localData, remote.data),
          sha: remote.sha
        };
      } catch (error) {
        cache = {
          data: localData,
          sha: null,
          error: error
        };
      } finally {
        loadingPromise = null;
      }

      return cache;
    })();

    return loadingPromise;
  }

  function normalizeRecipe(recipe) {
    var now = new Date().toISOString();
    var categoriaNome = String(recipe.categoriaNome || "").trim();
    var categoriaId = slugify(recipe.categoriaId || categoriaNome);

    return {
      id: recipe.id ? String(recipe.id) : String(Date.now()),
      titulo: String(recipe.titulo || "").trim(),
      categoriaId: categoriaId,
      categoriaNome: categoriaNome,
      tags: Array.isArray(recipe.tags) ? recipe.tags.filter(Boolean) : [],
      tempoPreparo: String(recipe.tempoPreparo || "").trim(),
      tempoForno: String(recipe.tempoForno || "").trim(),
      porcoes: Number(recipe.porcoes || 0),
      dificuldade: String(recipe.dificuldade || "Facil"),
      foto: String(recipe.foto || ""),
      ingredientes: Array.isArray(recipe.ingredientes) ? recipe.ingredientes.filter(Boolean) : [],
      modoPreparo: Array.isArray(recipe.modoPreparo) ? recipe.modoPreparo.filter(Boolean) : [],
      dica: String(recipe.dica || "").trim(),
      criadoEm: recipe.criadoEm || now,
      atualizadoEm: now,
      categoriaIcone: recipe.categoriaIcone || "",
      categoriaCor: recipe.categoriaCor || ""
    };
  }

  function ensureCategory(data, recipe) {
    var categoriaId = String(recipe.categoriaId || "");
    var categoriaNome = String(recipe.categoriaNome || "").trim();

    if (!categoriaId) {
      return;
    }

    var exists = data.categorias.some(function (category) {
      return category.id === categoriaId;
    });

    if (exists) {
      return;
    }

    data.categorias.push({
      id: categoriaId,
      nome: categoriaNome || categoriaId,
      icone: recipe.categoriaIcone || "🍽️",
      cor: recipe.categoriaCor || "#C4845A"
    });
  }

  function upsertRecipe(data, recipe) {
    var index = data.receitas.findIndex(function (item) {
      return String(item.id) === String(recipe.id);
    });

    if (index >= 0) {
      data.receitas[index] = recipe;
    } else {
      data.receitas.push(recipe);
    }
  }

  function validateRepositorySize(data) {
    var bytes = new Blob([JSON.stringify(data)]).size;

    if (bytes > MAX_REPOSITORY_BYTES) {
      throw new Error("O arquivo de receitas ficou grande demais para o GitHub. Reduza fotos antigas e tente novamente.");
    }
  }

  function removeLocalRecipe(id) {
    var localData = getLocalData();
    var nextData = {
      receitas: localData.receitas.filter(function (recipe) {
        return String(recipe.id) !== String(id);
      }),
      categorias: localData.categorias
    };

    if (nextData.receitas.length) {
      persistLocalData(nextData);
    } else {
      clearLocalData();
    }
  }

  async function getAllRecipes() {
    var loaded = await carregar();
    return loaded.data.receitas.slice();
  }

  async function getRecipeById(id) {
    var receitas = await getAllRecipes();
    return receitas.find(function (recipe) {
      return String(recipe.id) === String(id);
    }) || null;
  }

  async function getRecipesByCategory(categoryId) {
    var receitas = await getAllRecipes();
    return receitas.filter(function (recipe) {
      return recipe.categoriaId === categoryId;
    });
  }

  async function getCategories() {
    var loaded = await carregar();
    return loaded.data.categorias.map(function (category) {
      return Object.assign({}, category, {
        totalReceitas: loaded.data.receitas.filter(function (recipe) {
          return recipe.categoriaId === category.id;
        }).length
      });
    });
  }

  async function getCategoryById(categoryId) {
    var categorias = await getCategories();
    return categorias.find(function (category) {
      return category.id === categoryId;
    }) || null;
  }

  async function saveRecipe(recipe) {
    var normalized = normalizeRecipe(recipe);

    if (window.GitHubSync.hasToken()) {
      var current = await window.GitHubSync.lerReceitas();
      var nextData = cloneData(current.data);

      ensureCategory(nextData, normalized);
      upsertRecipe(nextData, normalized);
      validateRepositorySize(nextData);

      await window.GitHubSync.salvarComRetry(
        nextData,
        current.sha,
        (recipe.id ? "Atualiza receita: " : "Adiciona receita: ") + normalized.titulo,
        function (latestData) {
          ensureCategory(latestData, normalized);
          upsertRecipe(latestData, normalized);
          validateRepositorySize(latestData);
          return latestData;
        }
      );

      removeLocalRecipe(normalized.id);
      invalidateCache();
      return normalized;
    }

    var localData = getLocalData();
    ensureCategory(localData, normalized);
    upsertRecipe(localData, normalized);
    persistLocalData(localData);
    invalidateCache();
    return normalized;
  }

  async function deleteRecipe(id) {
    var recipeId = String(id);
    var localData = getLocalData();
    var hasLocalRecipe = localData.receitas.some(function (recipe) {
      return String(recipe.id) === recipeId;
    });

    if (!window.GitHubSync.hasToken()) {
      if (!hasLocalRecipe) {
        throw new Error("Configure um token GitHub para excluir receitas sincronizadas.");
      }

      localData.receitas = localData.receitas.filter(function (recipe) {
        return String(recipe.id) !== recipeId;
      });

      if (localData.receitas.length) {
        persistLocalData(localData);
      } else {
        clearLocalData();
      }

      invalidateCache();
      return;
    }

    var remote = await window.GitHubSync.lerReceitas();
    var nextData = cloneData(remote.data);
    var hadRemoteRecipe = nextData.receitas.some(function (recipe) {
      return String(recipe.id) === recipeId;
    });

    if (!hadRemoteRecipe && !hasLocalRecipe) {
      throw new Error("Receita nao encontrada.");
    }

    if (hadRemoteRecipe) {
      nextData.receitas = nextData.receitas.filter(function (recipe) {
        return String(recipe.id) !== recipeId;
      });
      validateRepositorySize(nextData);

      await window.GitHubSync.salvarComRetry(
        nextData,
        remote.sha,
        "Remove receita",
        function (latestData) {
          latestData.receitas = latestData.receitas.filter(function (recipe) {
            return String(recipe.id) !== recipeId;
          });
          validateRepositorySize(latestData);
          return latestData;
        }
      );
    }

    if (hasLocalRecipe) {
      removeLocalRecipe(recipeId);
    }

    invalidateCache();
  }

  async function initDefaultData() {
    clearLegacyDefaultRecipes();
  }

  window.NRStorage = {
    getAllRecipes: getAllRecipes,
    getRecipeById: getRecipeById,
    getRecipesByCategory: getRecipesByCategory,
    getCategories: getCategories,
    getCategoryById: getCategoryById,
    saveRecipe: saveRecipe,
    deleteRecipe: deleteRecipe,
    initDefaultData: initDefaultData,
    slugify: slugify,
    clearLocalData: clearLocalData
  };
})();
