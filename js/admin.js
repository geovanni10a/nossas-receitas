(function () {
  var state = {
    recipeId: null,
    tags: [],
    photoData: "",
    draggingItem: null,
    isProcessingPhoto: false,
    photoJobId: 0
  };

  var PHOTO_LIMIT_BYTES = 150 * 1024;
  var PHOTO_TARGET_SIZE = 600;
  var PHOTO_MIN_SIZE = 320;
  var RECOMPRESS_LIMIT_BYTES = 72 * 1024;
  var RECOMPRESS_TARGET_SIZE = 420;
  var RECOMPRESS_MIN_SIZE = 260;

  function byId(id) {
    return document.getElementById(id);
  }

  function queryError(name) {
    return document.querySelector('[data-erro="' + name + '"]');
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function normalizeDifficulty(value) {
    var normalized = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (normalized === "medio") {
      return "Medio";
    }

    if (normalized === "dificil") {
      return "Dificil";
    }

    return "Facil";
  }

  function createOption(value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function showToast(message, isError) {
    var toast = byId("toast");

    if (!toast) {
      return;
    }

    toast.hidden = !message;
    toast.textContent = message || "";
    toast.classList.toggle("toast--erro", Boolean(isError));
  }

  function setTokenStatus(message, tone) {
    var status = byId("status-token");

    if (!status) {
      return;
    }

    status.textContent = message;
    status.classList.remove("status-token--ok", "status-token--aviso", "status-token--erro");

    if (tone) {
      status.classList.add("status-token--" + tone);
    }
  }

  function renderWizardSummary(info) {
    var summary = byId("wizard-resumo");

    if (!summary) {
      return;
    }

    if (!info) {
      summary.hidden = true;
      summary.textContent = "";
      return;
    }

    summary.hidden = false;
    summary.innerHTML = [
      "<strong>Conexao validada</strong>",
      "<span>Owner: " + window.NRUtils.escapeHtml(info.owner) + "</span><br>",
      "<span>Repositorio: " + window.NRUtils.escapeHtml(info.repo) + "</span><br>",
      "<span>Branch: " + window.NRUtils.escapeHtml(info.branch) + "</span><br>",
      "<span>Total de receitas lidas: " + window.NRUtils.escapeHtml(info.totalReceitas) + "</span>"
    ].join("");
  }

  function applyRepoFields(repoInfo) {
    var info = repoInfo || window.GitHubSync.getRepoInfo();

    byId("repo-owner").value = info.owner || "";
    byId("repo-name").value = info.repo || "";
    byId("repo-branch").value = info.branch || "main";
  }

  function readRepoFields() {
    return {
      owner: byId("repo-owner").value.trim(),
      repo: byId("repo-name").value.trim(),
      branch: byId("repo-branch").value.trim() || "main"
    };
  }

  function persistRepoFields() {
    var values = readRepoFields();

    if (!values.owner || !values.repo) {
      window.GitHubSync.clearRepoOverride();
      applyRepoFields(window.GitHubSync.getRepoInfo());
      return window.GitHubSync.getRepoInfo();
    }

    return window.GitHubSync.setRepoOverride(values);
  }

  function resetRepoFields() {
    window.GitHubSync.clearRepoOverride();
    applyRepoFields(window.GitHubSync.getRepoInfo());
    renderWizardSummary(null);
    setTokenStatus("Deteccao automatica restaurada para owner, repositorio e branch.", "aviso");
  }

  function updateSaveButtonLabel() {
    var button = byId("btn-salvar-receita");

    if (!button) {
      return;
    }

    button.textContent = window.GitHubSync.hasToken() ? "Salvar e sincronizar" : "Salvar neste navegador";
  }

  function refreshTokenUI(message, tone) {
    var tokenField = byId("campo-token");

    if (tokenField) {
      tokenField.value = window.GitHubSync.getToken();
    }

    applyRepoFields(window.GitHubSync.getRepoInfo());
    updateSaveButtonLabel();

    if (message) {
      setTokenStatus(message, tone);
      return;
    }

    if (window.GitHubSync.hasToken()) {
      setTokenStatus("Token configurado. As proximas alteracoes serao salvas no GitHub.", "ok");
      return;
    }

    setTokenStatus("Token nao configurado. As receitas serao salvas apenas neste navegador.", "aviso");
  }

  async function renderCategoryOptions(selectedValue) {
    var select = byId("categoria");
    var categories = await window.NRStorage.getCategories();

    if (!categories.length && window.GitHubSync) {
      categories = window.GitHubSync.getCategoriasIniciais();
    }

    select.innerHTML = "";

    categories.forEach(function (category) {
      select.appendChild(createOption(category.id, category.nome));
    });

    select.appendChild(createOption("__new__", "Nova categoria..."));

    if (selectedValue && categories.some(function (category) { return category.id === selectedValue; })) {
      select.value = selectedValue;
      return;
    }

    select.value = categories.length ? categories[0].id : "__new__";
  }

  function toggleNewCategoryField() {
    byId("nova-categoria-shell").hidden = byId("categoria").value !== "__new__";
  }

  function setPreview(src) {
    byId("preview-foto").src = src || "assets/sem-foto.svg";
  }

  function setPhotoStatus(message, isProcessing) {
    var status = byId("foto-status");
    var preview = byId("preview-imagem");

    state.isProcessingPhoto = Boolean(isProcessing);

    if (!status || !preview) {
      return;
    }

    status.hidden = !message;
    status.textContent = message || "";
    preview.classList.toggle("is-processing", Boolean(isProcessing));
  }

  function renderTags() {
    var container = byId("tags-lista");

    container.innerHTML = "";

    state.tags.forEach(function (tag, index) {
      var chip = document.createElement("span");
      var label = document.createElement("span");
      var button = document.createElement("button");

      chip.className = "tag-chip";
      label.textContent = "#" + tag;
      button.type = "button";
      button.setAttribute("aria-label", "Remover tag");
      button.textContent = "x";

      button.addEventListener("click", function () {
        state.tags.splice(index, 1);
        renderTags();
      });

      chip.appendChild(label);
      chip.appendChild(button);
      container.appendChild(chip);
    });
  }

  function addTag(rawTag) {
    var tag = String(rawTag || "").trim().replace(/^#/, "");
    var alreadyExists = state.tags.some(function (item) {
      return item.toLowerCase() === tag.toLowerCase();
    });

    if (!tag || alreadyExists) {
      return;
    }

    state.tags.push(tag);
    renderTags();
  }

  function createListItem(type, value) {
    var wrapper = document.createElement("div");
    var handle = document.createElement("span");
    var input = document.createElement("input");
    var removeButton = document.createElement("button");

    wrapper.className = "lista-item";
    wrapper.draggable = true;
    wrapper.dataset.type = type;

    handle.className = "drag-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "::";

    input.type = "text";
    input.value = value || "";
    input.placeholder = type === "ingredientes" ? "Ex: 2 ovos" : "Descreva o passo";

    removeButton.className = "remover-item";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", "Remover item");
    removeButton.textContent = "x";

    wrapper.addEventListener("dragstart", function () {
      state.draggingItem = wrapper;
      wrapper.classList.add("is-dragging");
    });

    wrapper.addEventListener("dragend", function () {
      wrapper.classList.remove("is-dragging");
      state.draggingItem = null;
    });

    wrapper.addEventListener("dragover", function (event) {
      event.preventDefault();
    });

    wrapper.addEventListener("drop", function (event) {
      event.preventDefault();

      if (!state.draggingItem || state.draggingItem === wrapper) {
        return;
      }

      wrapper.parentNode.insertBefore(state.draggingItem, wrapper);
    });

    removeButton.addEventListener("click", function () {
      wrapper.remove();
    });

    wrapper.appendChild(handle);
    wrapper.appendChild(input);
    wrapper.appendChild(removeButton);

    return wrapper;
  }

  function addListItem(listId, type, value) {
    byId(listId).appendChild(createListItem(type, value));
  }

  function getListValues(listId) {
    return Array.prototype.slice.call(byId(listId).querySelectorAll("input"))
      .map(function (input) {
        return input.value.trim();
      })
      .filter(Boolean);
  }

  function clearErrors() {
    document.querySelectorAll(".erro").forEach(function (item) {
      item.textContent = "";
    });

    document.querySelectorAll(".is-invalid").forEach(function (item) {
      item.classList.remove("is-invalid");
    });
  }

  function showError(field, message, element) {
    var errorNode = queryError(field);

    if (errorNode) {
      errorNode.textContent = message;
    }

    if (element) {
      element.classList.add("is-invalid");
    }
  }

  function validateForm() {
    var title = byId("titulo");
    var category = byId("categoria");
    var newCategory = byId("nova-categoria");
    var ingredients = getListValues("ingredientes-lista");
    var steps = getListValues("passos-lista");
    var isValid = true;

    clearErrors();
    showToast("", false);

    if (!title.value.trim()) {
      showError("titulo", "O titulo e obrigatorio.", title);
      isValid = false;
    }

    if (!category.value) {
      showError("categoria", "Escolha uma categoria.", category);
      isValid = false;
    }

    if (category.value === "__new__" && !newCategory.value.trim()) {
      showError("novaCategoria", "Digite o nome da nova categoria.", newCategory);
      isValid = false;
    }

    if (!ingredients.length) {
      showError("ingredientes", "Adicione pelo menos um ingrediente.");
      isValid = false;
    }

    if (!steps.length) {
      showError("modoPreparo", "Adicione pelo menos um passo.");
      isValid = false;
    }

    if (state.isProcessingPhoto) {
      showError("foto", "Aguarde o processamento da foto terminar.", byId("foto"));
      isValid = false;
    }

    return isValid;
  }

  function isSupportedImageFile(file) {
    var allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    var allowedNames = /\.(jpe?g|png|webp)$/i;

    return Boolean(file) && (allowedTypes.indexOf(file.type) !== -1 || allowedNames.test(file.name || ""));
  }

  function getDataUrlByteSize(dataUrl) {
    var base64 = String(dataUrl || "").split(",")[1] || "";
    var padding = (base64.match(/=*$/) || [""])[0].length;

    return Math.ceil((base64.length * 3) / 4) - padding;
  }

  function drawSquareImage(ctx, img, origemX, origemY, menorLado, tamanhoAtual) {
    ctx.clearRect(0, 0, tamanhoAtual, tamanhoAtual);
    ctx.drawImage(img, origemX, origemY, menorLado, menorLado, 0, 0, tamanhoAtual, tamanhoAtual);
  }

  function compactarImagemBase64(dataUrl, targetSize, limitBytes, minSize) {
    return new Promise(function (resolve, reject) {
      var img = new Image();

      img.onload = function () {
        var menorLado = Math.min(img.width, img.height);
        var origemX = (img.width - menorLado) / 2;
        var origemY = (img.height - menorLado) / 2;
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        var tamanhoAtual = targetSize;

        if (!ctx) {
          reject(new Error("Nao foi possivel preparar a foto."));
          return;
        }

        while (tamanhoAtual >= minSize) {
          var qualidadeAtual = 0.85;

          canvas.width = tamanhoAtual;
          canvas.height = tamanhoAtual;
          drawSquareImage(ctx, img, origemX, origemY, menorLado, tamanhoAtual);

          while (qualidadeAtual >= 0.45) {
            var base64 = canvas.toDataURL("image/jpeg", qualidadeAtual);

            if (getDataUrlByteSize(base64) <= limitBytes) {
              resolve(base64);
              return;
            }

            qualidadeAtual -= 0.05;
          }

          tamanhoAtual -= 40;
        }

        reject(new Error("Nao foi possivel compactar a foto. Tente outra imagem."));
      };

      img.onerror = function () {
        reject(new Error("Nao foi possivel carregar a imagem."));
      };

      img.src = dataUrl;
    });
  }

  function resizarFotoParaQuadrado(file, targetSize) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onload = function (event) {
        compactarImagemBase64(event.target.result, targetSize || PHOTO_TARGET_SIZE, PHOTO_LIMIT_BYTES, PHOTO_MIN_SIZE)
          .then(resolve)
          .catch(reject);
      };

      reader.onerror = function () {
        reject(new Error("Nao foi possivel ler o arquivo."));
      };

      reader.readAsDataURL(file);
    });
  }

  async function buildRecipePayload() {
    var categoryValue = byId("categoria").value;
    var categoryData = categoryValue === "__new__"
      ? null
      : await window.NRStorage.getCategoryById(categoryValue);
    var categoryName = categoryValue === "__new__"
      ? byId("nova-categoria").value.trim()
      : (categoryData ? categoryData.nome : categoryValue);

    return {
      id: state.recipeId,
      titulo: byId("titulo").value.trim(),
      categoriaId: categoryValue === "__new__" ? categoryName : categoryValue,
      categoriaNome: categoryName,
      categoriaIcone: categoryData ? categoryData.icone : "",
      categoriaCor: categoryData ? categoryData.cor : "",
      tags: state.tags.slice(),
      tempoPreparo: byId("tempo-preparo").value.trim(),
      tempoForno: byId("tempo-forno").value.trim(),
      porcoes: byId("porcoes").value ? Number(byId("porcoes").value) : 0,
      dificuldade: normalizeDifficulty(byId("dificuldade").value),
      foto: state.photoData,
      ingredientes: getListValues("ingredientes-lista"),
      modoPreparo: getListValues("passos-lista"),
      dica: byId("dica").value.trim()
    };
  }

  async function fillForm(recipe) {
    var hasCategory = false;

    state.recipeId = recipe.id;
    state.tags = Array.isArray(recipe.tags) ? recipe.tags.slice() : [];
    state.photoData = recipe.foto || "";

    byId("admin-titulo").textContent = "Editar receita";
    byId("titulo").value = recipe.titulo || "";
    await renderCategoryOptions(recipe.categoriaId);

    hasCategory = byId("categoria").value === recipe.categoriaId;
    if (!hasCategory) {
      byId("categoria").value = "__new__";
      byId("nova-categoria").value = recipe.categoriaNome || recipe.categoriaId || "";
    }

    toggleNewCategoryField();

    byId("tempo-preparo").value = recipe.tempoPreparo || "";
    byId("tempo-forno").value = recipe.tempoForno || "";
    byId("porcoes").value = recipe.porcoes || "";
    byId("dificuldade").value = normalizeDifficulty(recipe.dificuldade);
    byId("dica").value = recipe.dica || "";

    setPreview(recipe.foto || "assets/sem-foto.svg");
    renderTags();

    byId("ingredientes-lista").innerHTML = "";
    byId("passos-lista").innerHTML = "";

    (recipe.ingredientes || []).forEach(function (item) {
      addListItem("ingredientes-lista", "ingredientes", item);
    });

    (recipe.modoPreparo || []).forEach(function (item) {
      addListItem("passos-lista", "passos", item);
    });

    byId("delete-recipe").hidden = false;
  }

  function describeGitHubError(error) {
    if (!error) {
      return "Nao foi possivel validar o token.";
    }

    if (error.code === "invalid_token") {
      return "O GitHub recusou o token. Gere um novo token e cole novamente.";
    }

    if (error.code === "rate_limit") {
      return "A API do GitHub atingiu o limite de requisicoes. Aguarde alguns minutos e tente de novo.";
    }

    if (error.code === "repo_not_found") {
      return "Nao encontrei o repositorio informado. Revise owner, repositorio e branch no wizard.";
    }

    if (error.code === "forbidden" || error.code === "write_forbidden") {
      return "O token nao tem permissao suficiente para este repositorio. Revise owner, repo e escopos.";
    }

    return error.message || "Nao foi possivel validar o token.";
  }

  async function renderSpaceUsage() {
    var report = await window.NRStorage.getSpaceReport();
    var fill = byId("barra-espaco-preenchimento");
    var summary = byId("espaco-resumo");
    var alert = byId("espaco-alerta");
    var list = byId("espaco-lista");

    fill.style.width = report.percentUsed + "%";
    fill.dataset.threshold = report.threshold;

    summary.textContent = window.NRUtils.formatBytes(report.totalBytes) + " de " + window.NRUtils.formatBytes(report.maxBytes) + " usados (" + report.percentUsed + "%).";

    alert.className = "espaco-alerta";
    alert.textContent = "";

    if (report.threshold === "attention") {
      alert.textContent = "O livro ja passou de 60% do limite. Vale acompanhar as fotos mais pesadas.";
    } else if (report.threshold === "warning") {
      alert.textContent = "Atencao: o livro passou de 80% do limite. Considere recomprimir as fotos maiores.";
    } else if (report.threshold === "critical") {
      alert.textContent = "Limite critico: o arquivo esta acima de 95% da capacidade recomendada.";
    } else {
      alert.textContent = "Espaco saudavel. Ainda ha folga para novas receitas.";
    }

    list.innerHTML = "";

    report.recipes.slice(0, 5).forEach(function (recipe) {
      var item = document.createElement("div");
      var title = document.createElement("strong");
      var size = document.createElement("span");
      var action = document.createElement("button");

      item.className = "espaco-item";
      title.textContent = recipe.titulo || "Receita sem titulo";
      size.textContent = window.NRUtils.formatBytes(recipe.bytes);

      action.className = "botao-secundario botao-utilitario";
      action.type = "button";
      action.textContent = recipe.hasPhoto ? "Recompactar foto" : "Sem foto";
      action.disabled = !recipe.hasPhoto;

      if (recipe.hasPhoto) {
        action.addEventListener("click", function () {
          recompressRecipePhoto(recipe.id);
        });
      }

      item.appendChild(title);
      item.appendChild(size);
      item.appendChild(action);
      list.appendChild(item);
    });
  }

  async function recompressRecipePhoto(recipeId) {
    var recipe = await window.NRStorage.getRecipeById(recipeId);
    var oldBytes;
    var compressed;
    var saved;
    var reduction;

    if (!recipe || !recipe.foto) {
      showToast("Essa receita nao tem foto para recompressao.", true);
      return;
    }

    oldBytes = getDataUrlByteSize(recipe.foto);
    showToast("Recompactando foto da receita...", false);

    try {
      compressed = await compactarImagemBase64(recipe.foto, RECOMPRESS_TARGET_SIZE, RECOMPRESS_LIMIT_BYTES, RECOMPRESS_MIN_SIZE);
      saved = await window.NRStorage.saveRecipe(Object.assign({}, recipe, { foto: compressed }));
      reduction = Math.max(0, Math.round((1 - (getDataUrlByteSize(saved.foto) / oldBytes)) * 100));

      if (String(saved.id) === String(state.recipeId)) {
        state.photoData = saved.foto;
        setPreview(saved.foto);
      }

      await renderSpaceUsage();
      showToast("Foto recomprimida com reducao de " + reduction + "%.", false);
    } catch (error) {
      showToast(error.message || "Nao foi possivel recomprimir a foto.", true);
    }
  }

  async function initDelete() {
    byId("delete-recipe").addEventListener("click", async function () {
      if (!state.recipeId) {
        return;
      }

      if (!window.confirm("Tem certeza que deseja excluir esta receita?")) {
        return;
      }

      try {
        await window.NRStorage.deleteRecipe(state.recipeId);
        await renderSpaceUsage();
        window.location.href = "livro.html";
      } catch (error) {
        showToast(error.message || "Nao foi possivel excluir a receita.", true);
      }
    });
  }

  function handlePhotoChange(event) {
    clearErrors();

    var file = event.target.files && event.target.files[0];
    var currentJobId = state.photoJobId + 1;

    state.photoJobId = currentJobId;

    if (!file) {
      setPhotoStatus("", false);
      return;
    }

    if (!isSupportedImageFile(file)) {
      event.target.value = "";
      setPhotoStatus("", false);
      showError("foto", "Selecione uma imagem JPG, PNG ou WebP.", byId("foto"));
      return;
    }

    setPhotoStatus("Processando foto...", true);

    resizarFotoParaQuadrado(file, PHOTO_TARGET_SIZE).then(function (data) {
      if (currentJobId !== state.photoJobId) {
        return;
      }

      state.photoData = data;
      setPreview(data);
      setPhotoStatus("", false);
    }).catch(function (error) {
      if (currentJobId !== state.photoJobId) {
        return;
      }

      event.target.value = "";
      setPhotoStatus("", false);
      showError("foto", error.message || "Nao foi possivel preparar a foto.", byId("foto"));
    });
  }

  async function handleTokenSave() {
    var token = byId("campo-token").value.trim();
    var repoInfo;
    var leitura;

    if (!token) {
      setTokenStatus("Cole um token antes de salvar.", "erro");
      return;
    }

    setTokenStatus("Validando token e lendo o arquivo remoto...", "aviso");

    try {
      repoInfo = persistRepoFields();
      window.GitHubSync.setToken(token);
      leitura = await window.GitHubSync.lerReceitas();
      refreshTokenUI("Token salvo com sucesso. Sincronizacao ativa.", "ok");
      renderWizardSummary({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: repoInfo.branch,
        totalReceitas: leitura.data.receitas.length
      });
      await window.NRStorage.refreshSync();
      await renderSpaceUsage();

      if (window.Migration) {
        window.Migration.verificarEMigrar(byId("container-migracao"));
      }
    } catch (error) {
      window.GitHubSync.clearToken();
      renderWizardSummary(null);
      refreshTokenUI(describeGitHubError(error), "erro");
    }
  }

  async function handleTokenClear() {
    window.GitHubSync.clearToken();
    refreshTokenUI("Token removido. O painel voltou ao modo local.", "aviso");
    renderWizardSummary(null);
    byId("container-migracao").innerHTML = "";
    await renderSpaceUsage();
  }

  function mountSharedControls() {
    if (window.NRSyncStatus) {
      window.NRSyncStatus.mount(byId("sync-status-admin"), { showRefresh: true });
      window.NRSyncStatus.mountMotionToggle(byId("toggle-motion-admin"));
    }
  }

  function initEvents() {
    byId("categoria").addEventListener("change", toggleNewCategoryField);

    byId("add-ingredient").addEventListener("click", function () {
      addListItem("ingredientes-lista", "ingredientes", "");
    });

    byId("add-step").addEventListener("click", function () {
      addListItem("passos-lista", "passos", "");
    });

    byId("tag-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addTag(event.target.value);
        event.target.value = "";
      }
    });

    byId("foto").addEventListener("change", handlePhotoChange);
    byId("btn-salvar-token").addEventListener("click", handleTokenSave);
    byId("btn-limpar-token").addEventListener("click", function () {
      handleTokenClear();
    });
    byId("btn-reset-repo").addEventListener("click", function () {
      resetRepoFields();
    });
    byId("btn-atualizar-espaco").addEventListener("click", function () {
      renderSpaceUsage().catch(function (error) {
        showToast(error.message || "Nao foi possivel atualizar o uso de espaco.", true);
      });
    });

    ["repo-owner", "repo-name", "repo-branch"].forEach(function (id) {
      byId(id).addEventListener("change", function () {
        persistRepoFields();
        renderWizardSummary(null);
      });
    });

    byId("recipe-form").addEventListener("submit", async function (event) {
      var submitButton = byId("btn-salvar-receita");
      var saved;

      event.preventDefault();

      if (!validateForm()) {
        return;
      }

      submitButton.disabled = true;
      showToast(window.GitHubSync.hasToken() ? "Salvando no GitHub..." : "Salvando neste navegador...", false);

      try {
        saved = await window.NRStorage.saveRecipe(await buildRecipePayload());
        await renderSpaceUsage();
        showToast(window.GitHubSync.hasToken() ? "Receita sincronizada com sucesso! OK" : "Receita salva neste navegador! OK", false);

        window.setTimeout(function () {
          window.location.href = "livro.html?receita=" + saved.id + "&categoria=" + saved.categoriaId;
        }, 1600);
      } catch (error) {
        showToast(error.message || "Nao foi possivel salvar a receita.", true);
      } finally {
        submitButton.disabled = false;
        updateSaveButtonLabel();
      }
    });
  }

  async function initAdmin() {
    var recipeId;
    var recipe;

    if (!document.getElementById("recipe-form") || !window.NRStorage || !window.GitHubSync || !window.NRUtils) {
      return;
    }

    await window.NRStorage.initDefaultData();
    mountSharedControls();
    applyRepoFields(window.GitHubSync.getRepoInfo());
    await renderCategoryOptions();
    toggleNewCategoryField();
    setPreview("assets/sem-foto.svg");
    setPhotoStatus("", false);
    refreshTokenUI();
    addListItem("ingredientes-lista", "ingredientes", "");
    addListItem("passos-lista", "passos", "");
    initEvents();
    initDelete();
    await renderSpaceUsage();

    if (window.GitHubSync.hasToken() && window.Migration) {
      window.Migration.verificarEMigrar(byId("container-migracao"));
    }

    recipeId = getParams().get("id");
    if (!recipeId) {
      return;
    }

    recipe = await window.NRStorage.getRecipeById(recipeId);

    if (!recipe) {
      window.location.href = "livro.html?mensagem=" + encodeURIComponent("Receita nao encontrada.");
      return;
    }

    await fillForm(recipe);

    if (getParams().get("recompress") === "1" && recipe.foto) {
      recompressRecipePhoto(recipe.id);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAdmin();
  });
})();
