(function () {
  var VALID_DIFFICULTIES = ["Facil", "Medio", "Dificil"];

  function cleanList(values) {
    return Array.isArray(values)
      ? values.map(function (item) { return String(item || "").trim(); }).filter(Boolean)
      : [];
  }

  function cleanTags(values) {
    return Array.isArray(values)
      ? values.map(function (item) { return String(item || "").trim().replace(/^#/, ""); }).filter(Boolean)
      : [];
  }

  function validateRecipe(recipe) {
    var data = recipe || {};
    var errors = {};
    var title = String(data.titulo || "").trim();
    var category = String(data.categoria || "").trim();
    var newCategory = String(data.novaCategoria || "").trim();
    var ingredients = cleanList(data.ingredientes);
    var steps = cleanList(data.modoPreparo);
    var tags = cleanTags(data.tags);
    var servings = String(data.porcoes || "").trim();
    var difficulty = String(data.dificuldade || "").trim();

    if (!title) {
      errors.titulo = "O titulo e obrigatorio.";
    } else if (title.length > 100) {
      errors.titulo = "Use no maximo 100 caracteres no titulo.";
    }

    if (!category) {
      errors.categoria = "Escolha uma categoria.";
    }

    if (category === "__new__" && !newCategory) {
      errors.novaCategoria = "Digite o nome da nova categoria.";
    } else if (newCategory.length > 60) {
      errors.novaCategoria = "Use no maximo 60 caracteres na nova categoria.";
    }

    if (!ingredients.length) {
      errors.ingredientes = "Adicione pelo menos um ingrediente.";
    } else if (ingredients.some(function (item) { return item.length > 160; })) {
      errors.ingredientes = "Cada ingrediente deve ter no maximo 160 caracteres.";
    }

    if (!steps.length) {
      errors.modoPreparo = "Adicione pelo menos um passo.";
    } else if (steps.some(function (item) { return item.length > 320; })) {
      errors.modoPreparo = "Cada passo deve ter no maximo 320 caracteres.";
    }

    if (servings && (!/^\d+$/.test(servings) || Number(servings) < 1)) {
      errors.porcoes = "Informe um numero inteiro maior que zero.";
    }

    if (tags.length > 12) {
      errors.tags = "Use no maximo 12 tags por receita.";
    } else if (tags.some(function (tag) { return tag.length > 24; })) {
      errors.tags = "Cada tag deve ter no maximo 24 caracteres.";
    }

    if (difficulty && VALID_DIFFICULTIES.indexOf(difficulty) === -1) {
      errors.dificuldade = "Escolha uma dificuldade valida.";
    }

    if (data.isProcessingPhoto) {
      errors.foto = "Aguarde o processamento da foto terminar.";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors
    };
  }

  window.NRValidation = {
    validateRecipe: validateRecipe
  };
})();
