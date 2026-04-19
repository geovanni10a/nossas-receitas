(function () {
  var PLACEHOLDER = "assets/sem-foto.svg";
  var h = window.NRDom.h;
  var kitchenState = {
    active: false,
    detail: null,
    wakeLock: null,
    visibilityHandler: null
  };

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function isKitchenModeRequested() {
    return getParams().get("cozinha") === "1";
  }

  function buildRecipeHref(recipeId, categoryId, keepKitchenMode) {
    var params = new URLSearchParams();

    params.set("receita", String(recipeId || ""));

    if (categoryId) {
      params.set("categoria", String(categoryId));
    }

    if (keepKitchenMode) {
      params.set("cozinha", "1");
    }

    return "livro.html?" + params.toString();
  }

  function buildCurrentRecipeUrl(keepKitchenMode) {
    var params = getParams();

    if (keepKitchenMode) {
      params.set("cozinha", "1");
    } else {
      params.delete("cozinha");
    }

    return window.location.pathname + (params.toString() ? "?" + params.toString() : "");
  }

  function supportsWakeLock() {
    return Boolean(navigator.wakeLock && typeof navigator.wakeLock.request === "function");
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

  function updateFavoriteUi(detail, isFavorite) {
    var button = detail && detail.querySelector("[data-favorite-toggle]");
    var label = detail && detail.querySelector("[data-favorite-label]");
    var chip = detail && detail.querySelector("[data-favorite-chip]");

    if (!button) {
      return;
    }

    button.classList.toggle("is-favorite", isFavorite);
    button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
    button.setAttribute("aria-label", isFavorite ? "Remover receita dos favoritos" : "Salvar receita nos favoritos");

    if (label) {
      label.textContent = isFavorite ? "Favorita" : "Favoritar";
    }

    if (chip) {
      chip.hidden = !isFavorite;
    }
  }

  function getKitchenInactiveMessage() {
    return "Ative este modo para ampliar os passos e tentar manter a tela acordada.";
  }

  function getKitchenFallbackMessage() {
    return "Modo cozinha ativo. Se a tela apagar, seu navegador nao liberou o Wake Lock agora.";
  }

  function syncKitchenRecipeLinks(detail, keepKitchenMode) {
    if (!detail) {
      return;
    }

    detail.querySelectorAll("[data-kitchen-recipe-link]").forEach(function (link) {
      link.setAttribute("href", buildRecipeHref(
        link.dataset.recipeId,
        link.dataset.categoryId,
        keepKitchenMode
      ));
    });
  }

  function updateKitchenUi(detail, isActive, message, shouldSyncUrl) {
    var button = detail && detail.querySelector("[data-kitchen-toggle]");
    var label = detail && detail.querySelector("[data-kitchen-label]");
    var banner = detail && detail.querySelector("[data-kitchen-banner]");
    var status = detail && detail.querySelector("[data-kitchen-status]");

    if (!detail) {
      return;
    }

    detail.classList.toggle("is-kitchen-mode", isActive);
    document.body.classList.toggle("is-kitchen-mode", isActive);

    if (shouldSyncUrl !== false) {
      syncKitchenRecipeLinks(detail, isActive);
      window.history.replaceState(window.history.state || {}, "", buildCurrentRecipeUrl(isActive));
    }

    if (button) {
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute("aria-label", isActive ? "Sair do modo cozinha" : "Entrar no modo cozinha");
    }

    if (label) {
      label.textContent = isActive ? "Sair do modo cozinha" : "Cozinha agora";
    }

    if (banner) {
      banner.hidden = !isActive;
    }

    if (status) {
      status.textContent = isActive ? message : getKitchenInactiveMessage();
    }
  }

  function detachKitchenVisibilityHandler() {
    if (kitchenState.visibilityHandler) {
      document.removeEventListener("visibilitychange", kitchenState.visibilityHandler);
      kitchenState.visibilityHandler = null;
    }
  }

  async function releaseWakeLock() {
    var activeLock = kitchenState.wakeLock;

    kitchenState.wakeLock = null;

    if (!activeLock || typeof activeLock.release !== "function") {
      return;
    }

    try {
      await activeLock.release();
    } catch (error) {
      // O navegador pode liberar o lock sozinho ao trocar de aba.
    }
  }

  async function requestWakeLock(detail, shouldSyncUrl) {
    if (!supportsWakeLock()) {
      updateKitchenUi(detail, true, "Modo cozinha ativo. Seu navegador nao suporta Wake Lock; mantenha a tela ligada manualmente se precisar.", shouldSyncUrl);
      return;
    }

    try {
      var wakeLock = await navigator.wakeLock.request("screen");

      kitchenState.wakeLock = wakeLock;

      if (wakeLock && typeof wakeLock.addEventListener === "function") {
        wakeLock.addEventListener("release", function () {
          kitchenState.wakeLock = null;

          if (kitchenState.active && kitchenState.detail && document.visibilityState === "visible") {
            requestWakeLock(kitchenState.detail);
          }
        });
      }

      updateKitchenUi(detail, true, "Tela ativa enquanto voce cozinha. Se a aba voltar a ficar visivel, tentaremos renovar o Wake Lock.", shouldSyncUrl);
    } catch (error) {
      updateKitchenUi(detail, true, getKitchenFallbackMessage(), shouldSyncUrl);
    }
  }

  function ensureKitchenVisibilityHandler(detail) {
    detachKitchenVisibilityHandler();
    kitchenState.visibilityHandler = function () {
      if (!kitchenState.active || !kitchenState.detail) {
        return;
      }

      if (document.visibilityState === "visible" && !kitchenState.wakeLock) {
        requestWakeLock(detail, false);
      }
    };
    document.addEventListener("visibilitychange", kitchenState.visibilityHandler);
  }

  async function setKitchenMode(detail, shouldEnable, options) {
    var syncUrl = !options || options.syncUrl !== false;

    kitchenState.active = shouldEnable;
    kitchenState.detail = detail || null;

    if (!detail) {
      await releaseWakeLock();
      detachKitchenVisibilityHandler();
      document.body.classList.remove("is-kitchen-mode");
      return;
    }

    if (!shouldEnable) {
      detachKitchenVisibilityHandler();
      await releaseWakeLock();
      updateKitchenUi(detail, false, getKitchenInactiveMessage(), syncUrl);
      return;
    }

    updateKitchenUi(detail, true, supportsWakeLock()
      ? "Tentando manter a tela ativa enquanto voce cozinha..."
      : "Modo cozinha ativo. Seu navegador nao suporta Wake Lock; mantenha a tela ligada manualmente se precisar.", syncUrl);
    ensureKitchenVisibilityHandler(detail);
    await requestWakeLock(detail, syncUrl);
  }

  async function cleanupRecipeInteractions() {
    await setKitchenMode(kitchenState.detail, false, { syncUrl: false });
    kitchenState.detail = null;
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
    var favorite = window.NRStorage && typeof window.NRStorage.isFavoriteRecipe === "function"
      ? window.NRStorage.isFavoriteRecipe(recipe.id)
      : false;
    var kitchenMode = isKitchenModeRequested();

    return h(
      "section",
      {
        className: "detalhe-receita" + (kitchenMode ? " is-kitchen-mode" : ""),
        dataset: {
          recipeId: recipe.id
        }
      },
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
              href: buildRecipeHref(siblings.previous.id, recipe.categoriaId, kitchenMode),
              dataset: {
                kitchenRecipeLink: "true",
                recipeId: siblings.previous.id,
                categoryId: recipe.categoriaId
              }
            },
            "Receita anterior"
          ) : null,
          siblings.next ? h(
            "a",
            {
              className: "botao-secundario",
              href: buildRecipeHref(siblings.next.id, recipe.categoriaId, kitchenMode),
              dataset: {
                kitchenRecipeLink: "true",
                recipeId: siblings.next.id,
                categoryId: recipe.categoriaId
              }
            },
            "Proxima receita"
          ) : null,
          h(
            "button",
            {
              className: "botao-secundario botao-receita-toggle" + (favorite ? " is-favorite" : ""),
              type: "button",
              "data-favorite-toggle": "true",
              "aria-pressed": favorite ? "true" : "false",
              "aria-label": favorite ? "Remover receita dos favoritos" : "Salvar receita nos favoritos"
            },
            h("i", { "data-lucide": "heart", "aria-hidden": "true" }),
            h("span", { "data-favorite-label": "true" }, favorite ? "Favorita" : "Favoritar")
          ),
          h(
            "button",
            {
              className: "botao-primario botao-receita-toggle botao-cozinha" + (kitchenMode ? " is-active" : ""),
              type: "button",
              "data-kitchen-toggle": "true",
              "aria-pressed": kitchenMode ? "true" : "false",
              "aria-label": kitchenMode ? "Sair do modo cozinha" : "Entrar no modo cozinha"
            },
            h("span", { "data-kitchen-label": "true" }, kitchenMode ? "Sair do modo cozinha" : "Cozinha agora")
          ),
          h(
            "a",
            {
              className: "botao-icone",
              href: "admin.html?id=" + encodeURIComponent(recipe.id),
              "aria-label": "Editar receita"
            },
            h("i", { "data-lucide": "pencil", "aria-hidden": "true" })
          )
        )
      ),
      h(
        "div",
        {
          className: "modo-cozinha-banner",
          hidden: kitchenMode ? null : true,
          "data-kitchen-banner": "true"
        },
        h("strong", null, "Modo cozinha ativo"),
        h("p", { "data-kitchen-status": "true" }, kitchenMode
          ? (supportsWakeLock()
            ? "Tentando manter a tela ativa enquanto voce cozinha..."
            : "Modo cozinha ativo. Seu navegador nao suporta Wake Lock; mantenha a tela ligada manualmente se precisar.")
          : getKitchenInactiveMessage())
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
            h("h1", null, recipe.titulo),
            h(
              "span",
              {
                className: "receita-selo-favorita",
                hidden: favorite ? null : true,
                "data-favorite-chip": "true"
              },
              "Favorita da casa"
            )
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
          ) : null,
          recipe.videoUrl ? h(
            "div",
            { className: "receita-video" },
            h("strong", null, "Video do preparo:"),
            h(
              "div",
              { className: "receita-video-acoes" },
              h(
                "a",
                {
                  className: "botao-secundario",
                  href: recipe.videoUrl,
                  target: "_blank",
                  rel: "noopener noreferrer"
                },
                "Abrir no YouTube"
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "botao-secundario",
                  "data-copy-video": recipe.videoUrl,
                  "aria-live": "polite"
                },
                "Copiar link"
              )
            )
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
    cleanupRecipeInteractions();

    var detail = container.querySelector(".detalhe-receita");
    var favoriteButton = container.querySelector("[data-favorite-toggle]");
    var kitchenButton = container.querySelector("[data-kitchen-toggle]");

    container.querySelectorAll(".passo-item").forEach(function (button) {
      button.addEventListener("click", function () {
        button.classList.toggle("is-done");
        button.setAttribute("aria-pressed", button.classList.contains("is-done") ? "true" : "false");
      });
    });

    container.querySelectorAll("[data-copy-video]").forEach(function (button) {
      var originalLabel = button.textContent;

      button.addEventListener("click", function () {
        var link = button.getAttribute("data-copy-video") || "";
        if (!link) {
          return;
        }

        var afterCopy = function (ok) {
          button.textContent = ok ? "Link copiado!" : "Nao foi possivel copiar";
          window.setTimeout(function () {
            button.textContent = originalLabel;
          }, 1800);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(function () {
            afterCopy(true);
          }).catch(function () {
            afterCopy(false);
          });
          return;
        }

        try {
          var temp = document.createElement("textarea");
          temp.value = link;
          temp.setAttribute("readonly", "");
          temp.style.position = "fixed";
          temp.style.opacity = "0";
          document.body.appendChild(temp);
          temp.select();
          var ok = document.execCommand("copy");
          document.body.removeChild(temp);
          afterCopy(ok);
        } catch (error) {
          afterCopy(false);
        }
      });
    });

    if (!detail) {
      return;
    }

    if (favoriteButton) {
      favoriteButton.addEventListener("click", function () {
        var nextState = window.NRStorage.toggleFavoriteRecipe(detail.dataset.recipeId);

        updateFavoriteUi(detail, nextState);
      });
    }

    if (kitchenButton) {
      kitchenButton.addEventListener("click", function () {
        setKitchenMode(detail, !kitchenState.active);
      });
    }

    updateFavoriteUi(detail, window.NRStorage.isFavoriteRecipe(detail.dataset.recipeId));

    if (detail.classList.contains("is-kitchen-mode")) {
      setKitchenMode(detail, true, { syncUrl: false });
    } else {
      updateKitchenUi(detail, false, getKitchenInactiveMessage(), false);
    }
  }

  window.NRReceita = {
    renderRecipeDetail: renderRecipeDetail,
    bindRecipeInteractions: bindRecipeInteractions,
    cleanupRecipeInteractions: cleanupRecipeInteractions
  };
})();
