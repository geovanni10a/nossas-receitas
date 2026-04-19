(function () {
  var PLACEHOLDER = "assets/sem-foto.svg";
  var h = window.NRDom.h;
  var fragment = window.NRDom.fragment;

  function recipeCard(recipe) {
    var image = window.NRUtils.safeImageSource(recipe.fotoThumb || recipe.foto, PLACEHOLDER);
    var isFavorite = window.NRStorage && typeof window.NRStorage.isFavoriteRecipe === "function"
      ? window.NRStorage.isFavoriteRecipe(recipe.id)
      : false;

    return h(
      "a",
      {
        className: "item-lista",
        href: "livro.html?receita=" + encodeURIComponent(recipe.id) + "&categoria=" + encodeURIComponent(recipe.categoriaId)
      },
      h(
        "div",
        { className: "thumb-receita" },
        h("img", {
          loading: "lazy",
          src: image,
          alt: "Foto da receita " + recipe.titulo
        })
      ),
      h(
        "div",
        null,
        h("h3", null, recipe.titulo),
        h("p", null, recipe.dica || "Uma receita guardada no seu livro pessoal."),
        h(
          "div",
          { className: "meta-receita" },
          isFavorite ? h("span", { className: "meta-chip meta-chip--favorite" }, "Favorita") : null,
          h("span", { className: "meta-chip" }, recipe.tempoPreparo || "Tempo livre"),
          h("span", { className: "meta-chip" }, recipe.dificuldade || "Facil")
        )
      ),
      h("span", { className: "meta-chip" }, "Abrir")
    );
  }

  function renderEmptyState(title, description, linkLabel, linkHref) {
    return h(
      "section",
      { className: "estado-vazio" },
      h("h2", null, title),
      h("p", null, description),
      h(
        "p",
        null,
        h(
          "a",
          {
            className: "botao-secundario",
            href: linkHref || "livro.html"
          },
          linkLabel || "Voltar ao indice"
        )
      )
    );
  }

  async function renderCategoriesView() {
    var categories = await window.NRStorage.getCategories();
    var favoriteRecipes = window.NRStorage && typeof window.NRStorage.getFavoriteRecipes === "function"
      ? await window.NRStorage.getFavoriteRecipes(3)
      : [];
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

    return h(
      "section",
      { className: "categorias-view" },
      h(
        "header",
        { className: "cabecalho-view" },
        h(
          "div",
          null,
          h("p", { className: "sobretitulo" }, "Indice da cozinha"),
          h("h1", null, "Escolha uma categoria"),
          h("p", null, "Passeie pelas paginas, busque por um ingrediente favorito e mantenha tudo sincronizado pelo GitHub.")
        ),
        h("a", { className: "botao-secundario", href: "admin.html" }, "Adicionar uma nova receita")
      ),
      favoriteRecipes.length ? h(
        "section",
        { className: "favoritos-destaque" },
        h(
          "div",
          { className: "cabecalho-view" },
          h(
            "div",
            null,
            h("p", { className: "sobretitulo" }, "Favoritas da casa"),
            h("h2", null, "Receitas para abrir rapidinho"),
            h("p", null, "As receitas marcadas com coracao ficam sempre por perto, prontas para a proxima fornada.")
          )
        ),
        h(
          "div",
          { className: "receitas-lista favoritas-lista" },
          favoriteRecipes.map(recipeCard)
        )
      ) : null,
      h(
        "div",
        { className: "categorias-grid" },
        categories.map(function (category) {
          return h(
            "a",
            {
              className: "categoria-card",
              href: "livro.html?categoria=" + encodeURIComponent(category.id)
            },
            h(
              "div",
              { className: "categoria-card-topo" },
              h("span", { className: "categoria-icone" }, category.icone),
              h("small", null, category.totalReceitas + (category.totalReceitas === 1 ? " receita" : " receitas"))
            ),
            h(
              "div",
              null,
              h("h3", null, category.nome),
              h("p", null, "Abra esta secao e veja suas receitas em paginas delicadas e faceis de consultar.")
            )
          );
        })
      )
    );
  }

  async function renderCategoryRecipes(categoryId) {
    var category = await window.NRStorage.getCategoryById(categoryId);
    var recipes = await window.NRStorage.getRecipesByCategory(categoryId);

    if (!category) {
      return renderEmptyState("Categoria nao encontrada.", "Volte ao indice e escolha outra secao do livro.");
    }

    if (!recipes.length) {
      return h(
        "section",
        { className: "estado-vazio" },
        h("h2", null, "Ainda nao ha receitas aqui. Que tal adicionar uma?"),
        h("p", null, "Voce pode preencher esta categoria abrindo o painel administrativo."),
        h(
          "p",
          null,
          h("a", { className: "botao-primario", href: "admin.html" }, "Ir para o painel")
        )
      );
    }

    return h(
      "section",
      { className: "lista-view" },
      h(
        "div",
        { className: "navegacao-livro" },
        h("a", { className: "botao-secundario", href: "livro.html" }, "Voltar ao indice"),
        h("a", { className: "botao-secundario", href: "admin.html" }, "Adicionar receita")
      ),
      h(
        "header",
        { className: "cabecalho-view" },
        h(
          "div",
          null,
          h("p", { className: "sobretitulo" }, "Categoria selecionada"),
          h("h2", null, category.nome),
          h("p", null, recipes.length + (recipes.length === 1 ? " receita pronta para consulta." : " receitas prontas para consulta."))
        )
      ),
      h(
        "div",
        { className: "lista-scroll" },
        h(
          "div",
          { className: "receitas-lista" },
          recipes.map(recipeCard)
        )
      )
    );
  }

  async function previewMarkup() {
    var categories = await window.NRStorage.getCategories();

    return fragment(
      categories.slice(0, 4).map(function (category) {
        return h(
          "div",
          { className: "preview-categoria" },
          h("strong", null, category.icone + " " + category.nome),
          h("br"),
          h("small", null, category.totalReceitas + " registradas")
        );
      })
    );
  }

  window.NRCategorias = {
    renderCategoriesView: renderCategoriesView,
    renderCategoryRecipes: renderCategoryRecipes,
    renderEmptyState: renderEmptyState,
    previewMarkup: previewMarkup
  };
})();
