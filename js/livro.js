(function () {
  var state = {
    currentHTML: "",
    renderToken: 0,
    searchToken: 0
  };

  function escapeHtml(value) {
    return window.NRUtils.escapeHtml(value);
  }

  function useSimpleTransition() {
    return window.NRUtils.shouldReduceMotion();
  }

  function getTransitionDuration() {
    return useSimpleTransition() ? 300 : 800;
  }

  function mountSharedControls(syncId, motionId, themeId, allowRefresh) {
    var syncContainer = document.getElementById(syncId);
    var motionButton = document.getElementById(motionId);
    var themeButton = document.getElementById(themeId);

    if (window.NRSyncStatus && syncContainer) {
      window.NRSyncStatus.mount(syncContainer, { showRefresh: allowRefresh });
    }

    if (window.NRSyncStatus && motionButton) {
      window.NRSyncStatus.mountMotionToggle(motionButton);
    }

    if (window.NRSyncStatus && themeButton) {
      window.NRSyncStatus.mountThemeToggle(themeButton);
    }
  }

  async function initCoverPage() {
    var cover = document.getElementById("abrir-livro");
    var shell = document.getElementById("intro-shell");
    var preview = document.getElementById("preview-categorias");

    if (!cover || !shell || !preview || !window.NRStorage || !window.NRCategorias) {
      return;
    }

    await window.NRStorage.initDefaultData();
    preview.innerHTML = await window.NRCategorias.previewMarkup();
    mountSharedControls("sync-status-home", "toggle-motion-home", "toggle-theme-home", true);

    cover.addEventListener("click", function () {
      shell.classList.add("is-open");
      if (useSimpleTransition()) {
        shell.classList.add("is-fade");
      }
    });
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function finalizeRender(html, onAfterRender, container) {
    mountRenderable(container, html);
    state.currentHTML = typeof html === "string" ? html : "__rendered__";

    if (typeof onAfterRender === "function") {
      onAfterRender(container);
    }

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    var dropdown = document.getElementById("busca-resultados");
    if (dropdown) {
      dropdown.hidden = true;
    }
  }

  function isNodeRenderable(content) {
    return Boolean(content) && typeof content === "object" && typeof content.nodeType === "number";
  }

  function cloneRenderable(content) {
    return isNodeRenderable(content) ? content.cloneNode(true) : content;
  }

  function mountRenderable(container, content) {
    if (!container) {
      return;
    }

    if (typeof content === "string") {
      container.innerHTML = content;
      return;
    }

    if (isNodeRenderable(content)) {
      container.replaceChildren(content);
      return;
    }

    container.replaceChildren();
  }

  function renderBookView(html, onAfterRender, renderToken) {
    var pageFront = document.getElementById("front-content");
    var pageBack = document.getElementById("back-content");
    var page = document.querySelector(".folha-livro");

    if (!pageFront || !pageBack || !page) {
      return;
    }

    mountRenderable(pageBack, cloneRenderable(html));
    page.classList.add("is-turning");

    window.setTimeout(function () {
      if (renderToken !== state.renderToken) {
        return;
      }

      pageBack.replaceChildren();
      page.classList.remove("is-turning");
      finalizeRender(html, onAfterRender, pageFront);
    }, getTransitionDuration());
  }

  async function buildRouteHTML(params) {
    var mensagem = params.get("mensagem");
    var receitaId = params.get("receita");
    var categoriaId = params.get("categoria");

    if (mensagem) {
      return {
        html: window.NRCategorias.renderEmptyState(mensagem, "Volte ao indice para continuar navegando."),
        afterRender: null
      };
    }

    if (receitaId) {
      return {
        html: await window.NRReceita.renderRecipeDetail(receitaId),
        afterRender: window.NRReceita.bindRecipeInteractions
      };
    }

    if (categoriaId) {
      return {
        html: await window.NRCategorias.renderCategoryRecipes(categoriaId),
        afterRender: null
      };
    }

    return {
      html: await window.NRCategorias.renderCategoriesView(),
      afterRender: null
    };
  }

  async function renderCurrentRoute(skipAnimation) {
    var pageFront = document.getElementById("front-content");
    var currentRenderToken = state.renderToken + 1;
    var route;

    state.renderToken = currentRenderToken;

    try {
      route = await buildRouteHTML(getParams());
    } catch (error) {
      route = {
        html: window.NRCategorias.renderEmptyState(
          "Nao foi possivel carregar o livro.",
          error && error.message ? error.message : "Tente novamente em instantes."
        ),
        afterRender: null
      };
    }

    if (currentRenderToken !== state.renderToken || !route.html) {
      return;
    }

    if (skipAnimation || !state.currentHTML) {
      finalizeRender(route.html, route.afterRender, pageFront);
      return;
    }

    renderBookView(route.html, route.afterRender, currentRenderToken);
  }

  function shouldInterceptLink(link) {
    return link && link.tagName === "A" && link.getAttribute("href") && link.getAttribute("href").indexOf("livro.html") === 0;
  }

  function initSearch() {
    var input = document.getElementById("busca-receitas");
    var dropdown = document.getElementById("busca-resultados");
    var shell = document.getElementById("busca-shell");

    if (!input || !dropdown || !shell || !window.NRBusca) {
      return;
    }

    var renderResults = async function (query) {
      var trimmedQuery = String(query || "").trim();
      var currentSearchToken = state.searchToken + 1;

      state.searchToken = currentSearchToken;

      if (trimmedQuery.length < 2) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
        return;
      }

      dropdown.hidden = false;
      dropdown.innerHTML = '<div class="resultado-vazio">Buscando receitas...</div>';

      try {
        var results = await window.NRBusca.search(trimmedQuery);

        if (currentSearchToken !== state.searchToken) {
          return;
        }

        if (!results.length) {
          dropdown.innerHTML = '<div class="resultado-vazio">Nenhuma receita encontrada para "' + escapeHtml(trimmedQuery) + '".</div>';
          return;
        }

        dropdown.innerHTML = results.map(function (item) {
          return '<a class="resultado-busca" href="livro.html?receita=' + escapeHtml(item.id) + '"><strong>' + escapeHtml(item.titulo) + "</strong><span>" + escapeHtml(item.categoria) + "</span></a>";
        }).join("");
      } catch (error) {
        if (currentSearchToken !== state.searchToken) {
          return;
        }

        dropdown.innerHTML = '<div class="resultado-vazio">Nao foi possivel buscar agora. Tente novamente.</div>';
      }
    };

    input.addEventListener("input", window.NRBusca.debounce(function (event) {
      renderResults(event.target.value);
    }, 300));

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        dropdown.hidden = true;
      }
    });

    document.addEventListener("click", function (event) {
      if (!shell.contains(event.target)) {
        dropdown.hidden = true;
      }
    });
  }

  async function initBookShell() {
    var stage = document.getElementById("livro-palco");

    if (!stage || !window.NRStorage || !window.NRCategorias || !window.NRReceita) {
      return;
    }

    await window.NRStorage.initDefaultData();
    await renderCurrentRoute(true);
    initSearch();
    mountSharedControls("sync-status-book", "toggle-motion-book", "toggle-theme-book", true);

    document.body.addEventListener("click", function (event) {
      var link = event.target.closest("a");

      if (!shouldInterceptLink(link)) {
        return;
      }

      event.preventDefault();
      window.history.pushState({}, "", link.getAttribute("href"));
      renderCurrentRoute(false);
    });

    window.addEventListener("popstate", function () {
      renderCurrentRoute(true);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCoverPage();
    initBookShell();
  });
})();
