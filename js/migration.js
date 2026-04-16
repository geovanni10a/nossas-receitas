(function () {
  var LOCAL_RECIPE_KEY = "nr_recipes";
  var LOCAL_CATEGORY_KEY = "nr_categories";
  var LOCAL_INITIALIZED_KEY = "nr_initialized";

  function safeParse(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function detectarReceitasAntigas() {
    var receitas = safeParse(LOCAL_RECIPE_KEY, null);
    return Array.isArray(receitas) && receitas.length ? receitas : null;
  }

  function compararDatas(a, b) {
    var dateA = new Date(a || 0).getTime();
    var dateB = new Date(b || 0).getTime();
    return dateA - dateB;
  }

  function mergeReceitas(receitasLocais, receitasGitHub) {
    var mapa = new Map();

    (receitasGitHub || []).forEach(function (receita) {
      mapa.set(String(receita.id), receita);
    });

    (receitasLocais || []).forEach(function (receitaLocal) {
      var id = String(receitaLocal.id);
      var receitaGitHub = mapa.get(id);

      if (!receitaGitHub) {
        mapa.set(id, receitaLocal);
        return;
      }

      var localMaisNova = compararDatas(
        receitaLocal.atualizadoEm || receitaLocal.criadoEm,
        receitaGitHub.atualizadoEm || receitaGitHub.criadoEm
      ) > 0;

      if (localMaisNova) {
        mapa.set(id, receitaLocal);
      }
    });

    return Array.from(mapa.values());
  }

  function mergeCategorias(categoriasLocais, categoriasGitHub) {
    var mapa = new Map();

    (categoriasGitHub || []).forEach(function (categoria) {
      mapa.set(String(categoria.id), categoria);
    });

    (categoriasLocais || []).forEach(function (categoria) {
      if (!mapa.has(String(categoria.id))) {
        mapa.set(String(categoria.id), categoria);
      }
    });

    return Array.from(mapa.values());
  }

  async function executarMigracao(receitasLocais, onProgresso) {
    var categoriasLocais = safeParse(LOCAL_CATEGORY_KEY, []);
    var progresso = typeof onProgresso === "function" ? onProgresso : function () {};
    var resumo = {
      total: 0,
      adicionadas: 0,
      atualizadas: 0
    };

    progresso("Conectando ao GitHub...");

    var leituraAtual = await window.GitHubSync.lerReceitas();
    var totalAntes = leituraAtual.data.receitas.length;

    progresso("Mesclando receitas locais com o GitHub...");

    var dadosAtualizados = {
      receitas: mergeReceitas(receitasLocais, leituraAtual.data.receitas),
      categorias: mergeCategorias(categoriasLocais, leituraAtual.data.categorias)
    };

    resumo.total = dadosAtualizados.receitas.length;
    resumo.adicionadas = Math.max(0, dadosAtualizados.receitas.length - totalAntes);
    resumo.atualizadas = Math.max(0, receitasLocais.length - resumo.adicionadas);

    progresso("Salvando no GitHub...");

    await window.GitHubSync.salvarComRetry(
      dadosAtualizados,
      leituraAtual.sha,
      "Migra receitas locais para o GitHub",
      function (dadosRemotos) {
        return {
          receitas: mergeReceitas(receitasLocais, dadosRemotos.receitas),
          categorias: mergeCategorias(categoriasLocais, dadosRemotos.categorias)
        };
      }
    );

    window.localStorage.removeItem(LOCAL_RECIPE_KEY);
    window.localStorage.removeItem(LOCAL_CATEGORY_KEY);
    window.localStorage.removeItem(LOCAL_INITIALIZED_KEY);

    progresso("Migracao concluida!");
    return resumo;
  }

  function construirBanner(receitasLocais) {
    var banner = document.createElement("div");
    banner.className = "banner-migracao";
    banner.setAttribute("role", "alert");
    banner.innerHTML = [
      '<div class="banner-migracao__icone">📚</div>',
      '<div class="banner-migracao__texto">',
      '  <strong>Receitas encontradas neste navegador!</strong>',
      '  <p>Encontrei <strong>' + receitasLocais.length + ' receita(s)</strong> salvas localmente. Deseja envia-las para o GitHub agora para ficarem disponiveis em todos os dispositivos?</p>',
      '</div>',
      '<div class="banner-migracao__acoes">',
      '  <button class="botao-primario" type="button" id="btn-confirmar-migracao">Sim, sincronizar agora</button>',
      '  <button class="botao-secundario" type="button" id="btn-ignorar-migracao">Ignorar por enquanto</button>',
      '</div>',
      '<div id="progresso-migracao" class="migracao-progresso" hidden>',
      '  <span class="spinner" aria-hidden="true"></span>',
      '  <span id="texto-progresso">Iniciando...</span>',
      '</div>'
    ].join("");

    return banner;
  }

  function verificarEMigrar(containerUI) {
    var receitasLocais = detectarReceitasAntigas();

    if (!containerUI || !window.GitHubSync.hasToken() || !receitasLocais) {
      return;
    }

    containerUI.innerHTML = "";

    var banner = construirBanner(receitasLocais);
    containerUI.prepend(banner);

    var btnConfirmar = banner.querySelector("#btn-confirmar-migracao");
    var btnIgnorar = banner.querySelector("#btn-ignorar-migracao");
    var progresso = banner.querySelector("#progresso-migracao");
    var textoProgresso = banner.querySelector("#texto-progresso");

    btnConfirmar.addEventListener("click", async function () {
      btnConfirmar.disabled = true;
      btnIgnorar.disabled = true;
      progresso.hidden = false;

      try {
        var resultado = await executarMigracao(receitasLocais, function (mensagem) {
          textoProgresso.textContent = mensagem;
        });

        banner.innerHTML = [
          '<div class="banner-migracao banner-migracao--sucesso" role="status">',
          '  <span class="banner-migracao__icone">✓</span>',
          '  <div class="banner-migracao__texto">',
          '    <strong>Migracao concluida!</strong>',
          '    <p>' + resultado.total + ' receita(s) agora estao no GitHub. A pagina vai recarregar em 3 segundos.</p>',
          '  </div>',
          '</div>'
        ].join("");

        window.setTimeout(function () {
          window.location.reload();
        }, 3000);
      } catch (error) {
        progresso.hidden = true;
        btnConfirmar.disabled = false;
        btnIgnorar.disabled = false;

        var erro = document.createElement("p");
        erro.className = "migracao-erro";
        erro.textContent = "Erro durante a migracao: " + error.message + ". Verifique o token e tente novamente.";
        banner.appendChild(erro);
      }
    });

    btnIgnorar.addEventListener("click", function () {
      banner.remove();
    });
  }

  window.Migration = {
    verificarEMigrar: verificarEMigrar,
    detectarReceitasAntigas: detectarReceitasAntigas,
    executarMigracao: executarMigracao
  };
})();
