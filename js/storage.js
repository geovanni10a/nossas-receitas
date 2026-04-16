(function () {
  var STORAGE_KEYS = {
    recipes: "nr_recipes",
    categories: "nr_categories",
    initialized: "nr_initialized",
    cleanedDefaults: "nr_cleaned_defaults"
  };

  var DEFAULT_CATEGORIES = [
    { id: "doces-sobremesas", nome: "Doces & Sobremesas", icone: "🍰", cor: "#C4845A" },
    { id: "massas-graos", nome: "Massas & Grãos", icone: "🍝", cor: "#D9A066" },
    { id: "carnes-aves", nome: "Carnes & Aves", icone: "🍗", cor: "#A0522D" },
    { id: "saladas-entradas", nome: "Saladas & Entradas", icone: "🥗", cor: "#6B7C5C" },
    { id: "bebidas", nome: "Bebidas", icone: "🍹", cor: "#B07A54" },
    { id: "vegetariano-vegano", nome: "Vegetariano & Vegano", icone: "🌿", cor: "#7D8C62" },
    { id: "especiais-festas", nome: "Especiais & Festas", icone: "🎉", cor: "#C4845A" }
  ];

  var DEFAULT_RECIPES = [];
  var LEGACY_DEFAULT_RECIPE_IDS = ["1714000000000", "1714000000100"];

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "categoria";
  }

  function safeParse(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function setItem(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (error && error.name === "QuotaExceededError") {
        window.alert("Armazenamento cheio. Exclua receitas antigas ou reduza o tamanho das fotos.");
      }
      throw error;
    }
  }

  function ensureCategories() {
    var stored = safeParse(STORAGE_KEYS.categories, null);
    if (!Array.isArray(stored) || !stored.length) {
      setItem(STORAGE_KEYS.categories, DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES.slice();
    }
    return stored;
  }

  function getAllRecipes() {
    return safeParse(STORAGE_KEYS.recipes, []);
  }

  function clearLegacyDefaultRecipes() {
    if (window.localStorage.getItem(STORAGE_KEYS.cleanedDefaults)) {
      return;
    }

    var recipes = getAllRecipes();
    var shouldClear = Array.isArray(recipes) && recipes.length > 0 && recipes.every(function (recipe) {
      return LEGACY_DEFAULT_RECIPE_IDS.indexOf(String(recipe.id)) !== -1;
    });

    if (shouldClear) {
      setItem(STORAGE_KEYS.recipes, []);
    }

    window.localStorage.setItem(STORAGE_KEYS.cleanedDefaults, "true");
  }

  function getRecipeById(id) {
    return getAllRecipes().find(function (recipe) {
      return recipe.id === String(id);
    }) || null;
  }

  function getRecipesByCategory(categoryId) {
    return getAllRecipes().filter(function (recipe) {
      return recipe.categoriaId === categoryId;
    });
  }

  function getCategories() {
    var categories = ensureCategories();
    var recipes = getAllRecipes();
    return categories.map(function (category) {
      var count = recipes.filter(function (recipe) {
        return recipe.categoriaId === category.id;
      }).length;
      return Object.assign({}, category, { totalReceitas: count });
    });
  }

  function getCategoryById(categoryId) {
    return getCategories().find(function (category) {
      return category.id === categoryId;
    }) || null;
  }

  function saveCategory(category) {
    var categories = ensureCategories();
    var exists = categories.some(function (item) {
      return item.id === category.id;
    });
    if (!exists) {
      categories.push(category);
      setItem(STORAGE_KEYS.categories, categories);
    }
  }

  function validateRecipeSize(recipe) {
    var sizeInBytes = new Blob([JSON.stringify(recipe)]).size;
    if (sizeInBytes > 1572864) {
      throw new Error("A foto é muito grande. Redimensione para menos de 1MB e tente novamente.");
    }
  }

  function saveRecipe(recipe) {
    var recipes = getAllRecipes();
    var now = new Date().toISOString();
    var id = recipe.id ? String(recipe.id) : String(Date.now());
    var categoriaId = slugify(recipe.categoriaId || recipe.categoriaNome);
    var categoriaNome = recipe.categoriaNome || "";
    var normalized = {
      id: id,
      titulo: String(recipe.titulo || "").trim(),
      categoriaId: categoriaId,
      tags: Array.isArray(recipe.tags) ? recipe.tags.filter(Boolean) : [],
      tempoPreparo: String(recipe.tempoPreparo || "").trim(),
      tempoForno: String(recipe.tempoForno || "").trim(),
      porcoes: Number(recipe.porcoes || 0),
      dificuldade: String(recipe.dificuldade || "Fácil"),
      foto: String(recipe.foto || ""),
      ingredientes: Array.isArray(recipe.ingredientes) ? recipe.ingredientes.filter(Boolean) : [],
      modoPreparo: Array.isArray(recipe.modoPreparo) ? recipe.modoPreparo.filter(Boolean) : [],
      dica: String(recipe.dica || "").trim(),
      criadoEm: recipe.criadoEm || now,
      atualizadoEm: now
    };

    validateRecipeSize(normalized);

    if (categoriaNome) {
      saveCategory({
        id: categoriaId,
        nome: categoriaNome,
        icone: recipe.categoriaIcone || "🍽️",
        cor: recipe.categoriaCor || "#C4845A"
      });
    }

    var index = recipes.findIndex(function (item) {
      return item.id === id;
    });

    if (index >= 0) {
      recipes[index] = normalized;
    } else {
      recipes.push(normalized);
    }

    setItem(STORAGE_KEYS.recipes, recipes);
    return normalized;
  }

  function deleteRecipe(id) {
    var recipes = getAllRecipes().filter(function (recipe) {
      return recipe.id !== String(id);
    });
    setItem(STORAGE_KEYS.recipes, recipes);
  }

  function initDefaultData() {
    clearLegacyDefaultRecipes();

    if (window.localStorage.getItem(STORAGE_KEYS.initialized)) {
      ensureCategories();
      return;
    }

    setItem(STORAGE_KEYS.categories, DEFAULT_CATEGORIES);
    setItem(STORAGE_KEYS.recipes, DEFAULT_RECIPES);
    window.localStorage.setItem(STORAGE_KEYS.initialized, "true");
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
    slugify: slugify
  };
})();
