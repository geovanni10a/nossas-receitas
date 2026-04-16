(function () {
  var PLACEHOLDER = "assets/sem-foto.svg";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function recipeCard(recipe) {
    var image = recipe.foto || PLACEHOLDER;
    return [
      '<a class="item-lista" href="livro.html?receita=' + recipe.id + '&categoria=' + recipe.categoriaId + '">',
      '  <div class="thumb-receita"><img src="' + image + '" alt="Foto da receita ' + escapeHtml(recipe.titulo) + '"></div>',
      '  <div>',
      '    <h3>' + escapeHtml(recipe.titulo) + '</h3>',
      '    <p>' + (recipe.dica ? escapeHtml(recipe.dica) : "Uma receita guardada no seu livro pessoal.") + '</p>',
      '    <div class="meta-receita">',
      '      <span class="meta-chip">' + escapeHtml(recipe.tempoPreparo || "Tempo livre") + '</span>',
      '      <span class="meta-chip">' + escapeHtml(recipe.dificuldade || "Fácil") + '</span>',
      '    </div>',
      '  </div>',
      '  <span class="meta-chip">Abrir</span>',
      '</a>'
    ].join("");
  }

  function renderCategoriesView() {
    var categories = window.NRStorage.getCategories();
    return [
      '<section class="categorias-view">',
      '  <header class="cabecalho-view">',
      '    <div>',
      '      <p class="sobretitulo">Índice da cozinha</p>',
      '      <h1>Escolha uma categoria</h1>',
      '      <p>Passeie pelas páginas, busque por um ingrediente favorito e mantenha tudo salvo no seu navegador.</p>',
      '    </div>',
      '    <a class="botao-secundario" href="admin.html">Adicionar uma nova receita</a>',
      '  </header>',
      '  <div class="categorias-grid">',
      categories.map(function (category) {
        return [
          '<a class="categoria-card" href="livro.html?categoria=' + category.id + '" style="--categoria-cor:' + escapeHtml(category.cor || "#C4845A") + ';">',
          '  <div class="categoria-card-topo">',
          '    <span class="categoria-icone">' + escapeHtml(category.icone) + '</span>',
          '    <small>' + category.totalReceitas + (category.totalReceitas === 1 ? " receita" : " receitas") + '</small>',
          '  </div>',
          '  <div>',
          '    <h3>' + escapeHtml(category.nome) + '</h3>',
          '    <p>Abra esta seção e veja suas receitas em páginas delicadas e fáceis de consultar.</p>',
          '  </div>',
          '</a>'
        ].join("");
      }).join(""),
      '  </div>',
      '</section>'
    ].join("");
  }

  function renderCategoryRecipes(categoryId) {
    var category = window.NRStorage.getCategoryById(categoryId);
    var recipes = window.NRStorage.getRecipesByCategory(categoryId);

    if (!category) {
      return renderEmptyState("Categoria não encontrada.", "Volte ao índice e escolha outra seção do livro.");
    }

    if (!recipes.length) {
      return [
        '<section class="estado-vazio">',
        '  <h2>Ainda não há receitas aqui. Que tal adicionar uma?</h2>',
        '  <p>Você pode preencher esta categoria abrindo o painel administrativo.</p>',
        '  <p><a class="botao-primario" href="admin.html">Ir para o painel</a></p>',
        '</section>'
      ].join("");
    }

    return [
      '<section class="lista-view">',
      '  <div class="navegacao-livro">',
      '    <a class="botao-secundario" href="livro.html">← Voltar ao Índice</a>',
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

  function renderEmptyState(title, description) {
    return [
      '<section class="estado-vazio">',
      '  <h2>' + escapeHtml(title) + '</h2>',
      '  <p>' + escapeHtml(description) + '</p>',
      '  <p><a class="botao-secundario" href="livro.html">Voltar ao índice</a></p>',
      '</section>'
    ].join("");
  }

  function previewMarkup() {
    return window.NRStorage.getCategories().slice(0, 4).map(function (category) {
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
