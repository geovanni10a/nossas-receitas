(function () {
  var state = { currentHTML: "" };

  function useSimpleTransition() {
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var supports3D = window.CSS && window.CSS.supports && window.CSS.supports("perspective", "1px");
    return reduced || !supports3D;
  }

  function getTransitionDuration() {
    return useSimpleTransition() ? 300 : 800;
  }

  function initCoverPage() {
    var cover = document.getElementById("abrir-livro");
    var shell = document.getElementById("intro-shell");
    var preview = document.getElementById("preview-categorias");

    if (!cover || !shell || !preview || !window.NRStorage || !window.NRCategorias) {
      return;
    }

    window.NRStorage.initDefaultData();
    preview.innerHTML = window.NRCategorias.previewMarkup();

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

  function renderBookView(html, onAfterRender) {
    var pageFront = document.getElementById("front-content");
    var pageBack = document.getElementById("back-content");
    var page = document.querySelector(".folha-livro");

    if (!pageFront || !pageBack || !page) {
      return;
    }

    pageBack.innerHTML = html;
    page.classList.add("is-turning");

    window.setTimeout(function () {
      pageFront.innerHTML = html;
      pageBack.innerHTML = "";
      page.classList.remove("is-turning");
      state.currentHTML = html;
      if (typeof onAfterRender === "function") {
        onAfterRender(pageFront);
      }
    }, getTransitionDuration());
  }

  function renderCurrentRoute(skipAnimation) {
    var params = getParams();
    var mensagem = params.get("mensagem");
    var receitaId = params.get("receita");
    var categoriaId = params.get("categoria");
    var html = "";
    var afterRender = null;

    if (mensagem) {
      html = window.NRCategorias.renderEmptyState(mensagem, "Volte ao índice para continuar navegando.");
    } else if (receitaId) {
      html = window.NRReceita.renderRecipeDetail(receitaId);
      afterRender = window.NRReceita.bindRecipeInteractions;
    } else if (categoriaId) {
      html = window.NRCategorias.renderCategoryRecipes(categoriaId);
    } else {
      html = window.NRCategorias.renderCategoriesView();
    }

    if (!html) {
      return;
    }

    if (skipAnimation || !state.currentHTML) {
      document.getElementById("front-content").innerHTML = html;
      state.currentHTML = html;
      if (typeof afterRender === "function") {
        afterRender(document.getElementById("front-content"));
      }
    } else {
      renderBookView(html, afterRender);
    }

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    var dropdown = document.getElementById("busca-resultados");
    if (dropdown) {
      dropdown.hidden = true;
    }
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

    var renderResults = function (query) {
      var results = window.NRBusca.search(query);

      if (query.trim().length < 2) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
        return;
      }

      dropdown.hidden = false;

      if (!results.length) {
        dropdown.innerHTML = '<div class="resultado-vazio">Nenhuma receita encontrada para "' + query.replace(/"/g, "&quot;") + '".</div>';
        return;
      }

      dropdown.innerHTML = results.map(function (item) {
        return '<a class="resultado-busca" href="livro.html?receita=' + item.id + '"><strong>' + item.titulo + '</strong><span>' + item.categoria + '</span></a>';
      }).join("");
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

  function initBookShell() {
    var stage = document.getElementById("livro-palco");
    if (!stage || !window.NRStorage || !window.NRCategorias || !window.NRReceita) {
      return;
    }

    window.NRStorage.initDefaultData();
    renderCurrentRoute(true);
    initSearch();

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
