(function () {
  var PLACEHOLDER = "assets/sem-foto.svg";
  var h = window.NRDom.h;
  var fragment = window.NRDom.fragment;

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
      return null;
    }

    var category = await window.NRStorage.getCategoryById(recipe.categoriaId);
    var siblings = await getSiblings(recipe);
    var image = window.NRUtils.safeImageSource(recipe.foto, PLACEHOLDER);
    var categoryName = category ? category.nome : "Sem categoria";
    var recipeTags = Array.isArray(recipe.tags) ? recipe.tags.filter(Boolean) : [];
    var ingredients = Array.isArray(recipe.ingredientes) ? recipe.ingredientes.filter(Boolean) : [];
    var steps = Array.isArray(recipe.modoPreparo) ? recipe.modoPreparo.filter(Boolean) : [];

    return h(
      "section",
      { className: "detalhe-receita" },
      h(
        "div",
        { className: "topo-detalhe" },
        h(
          "a",
          {
            className: "botao-secundario",
            href: "livro.html?categoria=" + encodeURIComponent(recipe.categoriaId)
          },
          "Voltar a categoria"
        ),
        h(
          "div",
          { className: "acoes" },
          siblings.previous ? h(
            "a",
            {
              className: "botao-secundario",
              href: "livro.html?receita=" + encodeURIComponent(siblings.previous.id) + "&categoria=" + encodeURIComponent(recipe.categoriaId)
            },
            "← Receita anterior"
          ) : null,
          siblings.next ? h(
            "a",
            {
              className: "botao-secundario",
              href: "livro.html?receita=" + encodeURIComponent(siblings.next.id) + "&categoria=" + encodeURIComponent(recipe.categoriaId)
            },
            "Proxima receita →"
          ) : null,
          h(
            "a",
            {
              className: "botao-icone",
              href: "admin.html?id=" + encodeURIComponent(recipe.id),
              "aria-label": "Editar receita"
            },
            h("span", null, "✎")
          )
        )
      ),
      h(
        "div",
        { className: "receita-dupla" },
        h(
          "article",
          { className: "receita-info" },
          h(
            "div",
            { className: "receita-imagem" },
            h("img", {
              src: image,
              alt: "Foto da receita " + recipe.titulo
            })
          ),
          h(
            "div",
            null,
            h("p", { className: "sobretitulo" }, categoryName),
            h("h1", null, recipe.titulo)
          ),
          h(
            "div",
            { className: "receita-resumo" },
            h("span", null, "Tempo de preparo: " + (recipe.tempoPreparo || "Livre")),
            recipe.tempoForno ? h("span", null, "Tempo de forno: " + recipe.tempoForno) : null,
            h("span", null, "Porcoes: " + (recipe.porcoes || "-")),
            h("span", null, "Dificuldade: " + (recipe.dificuldade || "Facil"))
          ),
          recipeTags.length ? h(
            "div",
            { className: "receita-tags" },
            recipeTags.map(function (tag) {
              return h("span", { className: "receita-tag" }, "#" + tag);
            })
          ) : null,
          recipe.dica ? h(
            "div",
            { className: "nota-receita" },
            h("strong", null, "Dica:"),
            " ",
            recipe.dica
          ) : null
        ),
        h(
          "article",
          { className: "receita-corpo" },
          h(
            "section",
            null,
            h("h2", null, "Ingredientes"),
            h(
              "ul",
              { className: "lista-ingredientes" },
              ingredients.map(function (item) {
                return h("li", null, item);
              })
            )
          ),
          h(
            "section",
            null,
            h("h2", null, "Modo de preparo"),
            h(
              "div",
              { className: "lista-passos" },
              steps.map(function (step, index) {
                return h(
                  "button",
                  {
                    className: "passo-item",
                    type: "button",
                    "aria-pressed": "false"
                  },
                  h("span", { className: "numero-passo" }, String(index + 1)),
                  h("span", null, step)
                );
              })
            )
          )
        )
      )
    );
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
