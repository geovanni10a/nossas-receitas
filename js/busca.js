(function () {
  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  async function search(query) {
    var normalizedQuery = normalize(query);

    if (normalizedQuery.length < 2) {
      return [];
    }

    var recipes = await window.NRStorage.getAllRecipes();
    var categories = await window.NRStorage.getCategories();
    var categoryMap = new Map();

    categories.forEach(function (category) {
      categoryMap.set(category.id, category.nome);
    });

    return recipes
      .filter(function (recipe) {
        var haystack = normalize(
          String(recipe.titulo || "") + " " + (Array.isArray(recipe.tags) ? recipe.tags.join(" ") : "")
        );

        return haystack.indexOf(normalizedQuery) !== -1;
      })
      .slice(0, 8)
      .map(function (recipe) {
        return {
          id: recipe.id,
          titulo: recipe.titulo,
          categoria: categoryMap.get(recipe.categoriaId) || "Sem categoria"
        };
      });
  }

  function debounce(fn, wait) {
    var timeout = null;

    return function () {
      var args = arguments;

      window.clearTimeout(timeout);
      timeout = window.setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }

  window.NRBusca = {
    search: search,
    normalize: normalize,
    debounce: debounce
  };
})();
