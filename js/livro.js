(function () {
  var h = window.NRDom && window.NRDom.h;
  var fragment = window.NRDom && window.NRDom.fragment;
  var state = {
    currentHTML: "",
    renderToken: 0,
    searchToken: 0
  };

  function useSimpleTransition() {
    return window.NRUtils.shouldReduceMotion()
      || (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 720px)").matches);
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
    preview.replaceChildren(await window.NRCategorias.previewMarkup());
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
    if (window.NRReceita && typeof window.NRReceita.cleanupRecipeInteractions === "function") {
      window.NRReceita.cleanupRecipeInteractions();
    }

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
      container.replaceChildren(document.createTextNode(content));
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
    var toggleButton = document.getElementById("toggle-search-book");

    if (!input || !dropdown || !shell || !window.NRBusca) {
      return;
    }

    var isCompactSearchMode = function () {
      return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 720px)").matches;
    };

    var setDropdownContent = function (content) {
      if (!content) {
        dropdown.replaceChildren();
        return;
      }

      dropdown.replaceChildren(content);
    };

    var buildSearchMessage = function (message) {
      return h("div", { className: "resultado-vazio", role: "status" }, message);
    };

    var buildSearchResults = function (results) {
      return fragment(results.map(function (item) {
        return h(
          "a",
          {
            className: "resultado-busca",
            href: "livro.html?receita=" + encodeURIComponent(item.id),
            "aria-label": item.titulo + " na categoria " + item.categoria
          },
          h("strong", null, item.titulo),
          h("span", null, item.categoria)
        );
      }));
    };

    var setSearchOpen = function (shouldOpen) {
      var isOpen = shouldOpen || !isCompactSearchMode();

      shell.classList.toggle("is-open", isOpen);

      if (toggleButton) {
        toggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
        toggleButton.setAttribute("aria-label", isOpen ? "Fechar a busca de receitas" : "Abrir a busca de receitas");
      }

      if (!isOpen) {
        dropdown.hidden = true;
      }
    };

    var renderResults = async function (query) {
      var trimmedQuery = String(query || "").trim();
      var currentSearchToken = state.searchToken + 1;

      state.searchToken = currentSearchToken;

      if (trimmedQuery.length < 2) {
        dropdown.hidden = true;
        setDropdownContent(null);
        return;
      }

      dropdown.hidden = false;
      setDropdownContent(buildSearchMessage("Buscando receitas..."));

      try {
        var results = await window.NRBusca.search(trimmedQuery);

        if (currentSearchToken !== state.searchToken) {
          return;
        }

        if (!results.length) {
          setDropdownContent(buildSearchMessage('Nenhuma receita encontrada para "' + trimmedQuery + '".'));
          return;
        }

        setDropdownContent(buildSearchResults(results));
      } catch (error) {
        if (currentSearchToken !== state.searchToken) {
          return;
        }

        setDropdownContent(buildSearchMessage("Nao foi possivel buscar agora. Tente novamente."));
      }
    };

    input.addEventListener("input", window.NRBusca.debounce(function (event) {
      renderResults(event.target.value);
    }, 300));

    input.addEventListener("focus", function () {
      if (isCompactSearchMode()) {
        setSearchOpen(true);
      }
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        dropdown.hidden = true;

        if (isCompactSearchMode()) {
          setSearchOpen(false);
          toggleButton && toggleButton.focus();
        }
      }
    });

    if (toggleButton) {
      toggleButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        var shouldOpen = !shell.classList.contains("is-open");

        setSearchOpen(shouldOpen);

        if (shouldOpen) {
          input.focus();
        }
      });
    }

    document.addEventListener("click", function (event) {
      if (!shell.contains(event.target) && !(toggleButton && toggleButton.contains(event.target))) {
        dropdown.hidden = true;

        if (isCompactSearchMode()) {
          setSearchOpen(false);
        }
      }
    });

    window.addEventListener("resize", function () {
      setSearchOpen(!isCompactSearchMode());
    });

    setSearchOpen(!isCompactSearchMode());
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
