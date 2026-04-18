(function () {
  var PLACEHOLDER = "assets/sem-foto.svg";

  function escapeHtml(value) {
    return window.NRUtils.escapeHtml(value);
  }

  async function getSiblings(recipe) {
    var siblings = await window.NRStorage.getRecipesByCategory(recipe.categoriaId);
    var index = siblings.findIndex(function (item) {
      return item.id === recipe.id;
    });

    return {
      previous: index > 0 ? siblings[index - 1] : null,
      next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null
    };
  }

  async function renderRecipeDetail(recipeId) {
    var recipe = await window.NRStorage.getRecipeById(recipeId);

    if (!recipe) {
      window.location.href = "livro.html?mensagem=" + encodeURIComponent("Receita nao encontrada.");
      return "";
    }

    var category = await window.NRStorage.getCategoryById(recipe.categoriaId);
    var siblings = await getSiblings(recipe);
    var image = window.NRUtils.safeImageSource(recipe.foto, PLACEHOLDER);

    return [
      '<section class="detalhe-receita">',
      '  <div class="topo-detalhe">',
      '    <a class="botao-secundario" href="livro.html?categoria=' + escapeHtml(recipe.categoriaId) + '">Voltar a categoria</a>',
      '    <div class="acoes">',
      siblings.previous ? '<a class="botao-secundario" href="livro.html?receita=' + escapeHtml(siblings.previous.id) + '&categoria=' + escapeHtml(recipe.categoriaId) + '">&larr; Receita anterior</a>' : "",
      siblings.next ? '<a class="botao-secundario" href="livro.html?receita=' + escapeHtml(siblings.next.id) + '&categoria=' + escapeHtml(recipe.categoriaId) + '">Proxima receita &rarr;</a>' : "",
      '      <a class="botao-icone" href="admin.html?id=' + escapeHtml(recipe.id) + '" aria-label="Editar receita"><span>&#9998;</span></a>',
      '    </div>',
      '  </div>',
      '  <div class="receita-dupla">',
      '    <article class="receita-info">',
      '      <div class="receita-imagem"><img src="' + escapeHtml(image) + '" alt="Foto da receita ' + escapeHtml(recipe.titulo) + '"></div>',
      '      <div>',
      '        <p class="sobretitulo">' + escapeHtml(category ? category.nome : "Sem categoria") + '</p>',
      '        <h1>' + escapeHtml(recipe.titulo) + '</h1>',
      '      </div>',
      '      <div class="receita-resumo">',
      '        <span>Tempo de preparo: ' + escapeHtml(recipe.tempoPreparo || "Livre") + '</span>',
      recipe.tempoForno ? '        <span>Tempo de forno: ' + escapeHtml(recipe.tempoForno) + '</span>' : "",
      '        <span>Porcoes: ' + escapeHtml(recipe.porcoes || "-") + '</span>',
      '        <span>Dificuldade: ' + escapeHtml(recipe.dificuldade || "Facil") + '</span>',
      '      </div>',
      Array.isArray(recipe.tags) && recipe.tags.length
        ? '      <div class="receita-tags">' + recipe.tags.map(function (tag) { return '<span class="receita-tag">#' + escapeHtml(tag) + '</span>'; }).join("") + "</div>"
        : "",
      recipe.dica ? '      <div class="nota-receita"><strong>Dica:</strong> ' + escapeHtml(recipe.dica) + '</div>' : "",
      '    </article>',
      '    <article class="receita-corpo">',
      '      <section>',
      '        <h2>Ingredientes</h2>',
      '        <ul class="lista-ingredientes">',
      (recipe.ingredientes || []).map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join(""),
      '        </ul>',
      '      </section>',
      '      <section>',
      '        <h2>Modo de preparo</h2>',
      '        <div class="lista-passos">',
      (recipe.modoPreparo || []).map(function (step, index) {
        return '<button class="passo-item" type="button"><span class="numero-passo">' + (index + 1) + "</span><span>" + escapeHtml(step) + "</span></button>";
      }).join(""),
      '        </div>',
      '      </section>',
      '    </article>',
      '  </div>',
      '</section>'
    ].join("");
  }

  function bindRecipeInteractions(container) {
    container.querySelectorAll(".passo-item").forEach(function (button) {
      button.addEventListener("click", function () {
        button.classList.toggle("is-done");
        button.setAttribute("aria-pressed", button.classList.contains("is-done") ? "true" : "false");
      });
    });
  }

  window.NRReceita = {
    renderRecipeDetail: renderRecipeDetail,
    bindRecipeInteractions: bindRecipeInteractions
  };
})();
