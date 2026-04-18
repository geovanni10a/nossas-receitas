(function () {
  var PLACEHOLDER = "assets/sem-foto.svg";

  function escapeHtml(value) {
    return window.NRUtils.escapeHtml(value);
  }

  function recipeCard(recipe) {
    var image = window.NRUtils.safeImageSource(recipe.fotoThumb || recipe.foto, PLACEHOLDER);

    return [
      '<a class="item-lista" href="livro.html?receita=' + escapeHtml(recipe.id) + '&categoria=' + escapeHtml(recipe.categoriaId) + '">',
      '  <div class="thumb-receita"><img loading="lazy" src="' + escapeHtml(image) + '" alt="Foto da receita ' + escapeHtml(recipe.titulo) + '"></div>',
      '  <div>',
      '    <h3>' + escapeHtml(recipe.titulo) + '</h3>',
      '    <p>' + (recipe.dica ? escapeHtml(recipe.dica) : "Uma receita guardada no seu livro pessoal.") + '</p>',
      '    <div class="meta-receita">',
      '      <span class="meta-chip">' + escapeHtml(recipe.tempoPreparo || "Tempo livre") + '</span>',
      '      <span class="meta-chip">' + escapeHtml(recipe.dificuldade || "Facil") + '</span>',
      '    </div>',
      '  </div>',
      '  <span class="meta-chip">Abrir</span>',
      '</a>'
    ].join("");
  }

  function renderEmptyState(title, description, linkLabel, linkHref) {
    return [
      '<section class="estado-vazio">',
      '  <h2>' + escapeHtml(title) + '</h2>',
      '  <p>' + escapeHtml(description) + '</p>',
      '  <p><a class="botao-secundario" href="' + escapeHtml(linkHref || "livro.html") + '">' + escapeHtml(linkLabel || "Voltar ao indice") + '</a></p>',
      '</section>'
    ].join("");
  }

  async function renderCategoriesView() {
    var categories = await window.NRStorage.getCategories();
    var totalRecipes = categories.reduce(function (total, category) {
      return total + category.totalReceitas;
    }, 0);

    if (!totalRecipes) {
      return renderEmptyState(
        "Seu livro ainda esta em branco. Que tal adicionar a primeira receita?",
        "Salve sua primeira receita no painel admin e ela ficara sincronizada entre os dispositivos configurados.",
        "Abrir painel admin",
        "admin.html"
      );
    }

    return [
      '<section class="categorias-view">',
      '  <header class="cabecalho-view">',
      '    <div>',
      '      <p class="sobretitulo">Indice da cozinha</p>',
      '      <h1>Escolha uma categoria</h1>',
      '      <p>Passeie pelas paginas, busque por um ingrediente favorito e mantenha tudo sincronizado pelo GitHub.</p>',
      '    </div>',
      '    <a class="botao-secundario" href="admin.html">Adicionar uma nova receita</a>',
      '  </header>',
      '  <div class="categorias-grid">',
      categories.map(function (category) {
        return [
          '<a class="categoria-card" href="livro.html?categoria=' + escapeHtml(category.id) + '">',
          '  <div class="categoria-card-topo">',
          '    <span class="categoria-icone">' + escapeHtml(category.icone) + '</span>',
          '    <small>' + category.totalReceitas + (category.totalReceitas === 1 ? " receita" : " receitas") + '</small>',
          '  </div>',
          '  <div>',
          '    <h3>' + escapeHtml(category.nome) + '</h3>',
          '    <p>Abra esta secao e veja suas receitas em paginas delicadas e faceis de consultar.</p>',
          '  </div>',
          '</a>'
        ].join("");
      }).join(""),
      '  </div>',
      '</section>'
    ].join("");
  }

  async function renderCategoryRecipes(categoryId) {
    var category = await window.NRStorage.getCategoryById(categoryId);
    var recipes = await window.NRStorage.getRecipesByCategory(categoryId);

    if (!category) {
      return renderEmptyState("Categoria nao encontrada.", "Volte ao indice e escolha outra secao do livro.");
    }

    if (!recipes.length) {
      return [
        '<section class="estado-vazio">',
        '  <h2>Ainda nao ha receitas aqui. Que tal adicionar uma?</h2>',
        '  <p>Voce pode preencher esta categoria abrindo o painel administrativo.</p>',
        '  <p><a class="botao-primario" href="admin.html">Ir para o painel</a></p>',
        '</section>'
      ].join("");
    }

    return [
      '<section class="lista-view">',
      '  <div class="navegacao-livro">',
      '    <a class="botao-secundario" href="livro.html">Voltar ao indice</a>',
      '    <a class="botao-secundario" href="admin.html">Adicionar receita</a>',
      '  </div>',
      '  <header class="cabecalho-view">',
      '    <div>',
      '      <p class="sobretitulo">Categoria selecionada</p>',
      '      <h2>' + escapeHtml(category.nome) + '</h2>',
      '      <p>' + recipes.length + (recipes.length === 1 ? " receita pronta para consulta." : " receitas prontas para consulta.") + '</p>',
      '    </div>',
      '  </header>',
      '  <div class="lista-scroll">',
      '    <div class="receitas-lista">',
      recipes.map(recipeCard).join(""),
      '    </div>',
      '  </div>',
      '</section>'
    ].join("");
  }

  async function previewMarkup() {
    var categories = await window.NRStorage.getCategories();

    return categories.slice(0, 4).map(function (category) {
      return '<div class="preview-categoria"><strong>' + escapeHtml(category.icone + " " + category.nome) + '</strong><br><small>' + category.totalReceitas + ' registradas</small></div>';
    }).join("");
  }

  window.NRCategorias = {
    renderCategoriesView: renderCategoriesView,
    renderCategoryRecipes: renderCategoryRecipes,
    renderEmptyState: renderEmptyState,
    previewMarkup: previewMarkup
  };
})();
