(function () {
  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function search(query) {
    var normalizedQuery = normalize(query);
    if (normalizedQuery.length < 2) {
      return [];
    }
    return window.NRStorage.getAllRecipes()
      .filter(function (recipe) {
        var haystack = normalize(recipe.titulo + " " + recipe.tags.join(" "));
        return haystack.indexOf(normalizedQuery) !== -1;
      })
      .slice(0, 8)
      .map(function (recipe) {
        var category = window.NRStorage.getCategoryById(recipe.categoriaId);
        return {
          id: recipe.id,
          titulo: recipe.titulo,
          categoria: category ? category.nome : "Sem categoria"
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
