(function () {
  var h = window.NRDom && window.NRDom.h;
  var state = {
    recipeId: null,
    lastSyncedSnapshot: null,
    tags: [],
    photoData: "",
    photoThumbData: "",
    draggingItem: null,
    isProcessingPhoto: false,
    photoJobId: 0,
    persistedSignature: "",
    lastDraftSignature: "",
    draftKey: "nr_draft_new",
    draftTimer: null,
    isSavingRecipe: false,
    historyEntries: [],
    historyDetails: {},
    selectedHistoryCommit: ""
  };

  var PHOTO_LIMIT_BYTES = 150 * 1024;
  var PHOTO_TARGET_WIDTH = 600;
  var PHOTO_TARGET_HEIGHT = 600;
  var PHOTO_MIN_WIDTH = 320;
  var PHOTO_MIN_HEIGHT = 320;
  var PHOTO_THUMB_LIMIT_BYTES = 20 * 1024;
  var PHOTO_THUMB_TARGET_WIDTH = 160;
  var PHOTO_THUMB_TARGET_HEIGHT = 120;
  var PHOTO_THUMB_MIN_WIDTH = 120;
  var PHOTO_THUMB_MIN_HEIGHT = 90;
  var RECOMPRESS_LIMIT_BYTES = 72 * 1024;
  var RECOMPRESS_TARGET_WIDTH = 420;
  var RECOMPRESS_TARGET_HEIGHT = 420;
  var RECOMPRESS_MIN_WIDTH = 260;
  var RECOMPRESS_MIN_HEIGHT = 260;
  var DRAFT_KEY_PREFIX = "nr_draft_";
  var DRAFT_INTERVAL_MS = 5000;

  function byId(id) {
    return document.getElementById(id);
  }

  function queryError(name) {
    return document.querySelector('[data-erro="' + name + '"]');
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function getDraftKey(recipeId) {
    return DRAFT_KEY_PREFIX + String(recipeId || state.recipeId || getParams().get("id") || "new");
  }

  function safeParseJson(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
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

  function createEmptySnapshot() {
    return {
      titulo: "",
      categoria: "",
      novaCategoria: "",
      tempoPreparo: "",
      tempoForno: "",
      porcoes: "",
      dificuldade: "Facil",
      dica: "",
      tags: [],
      foto: "",
      fotoThumb: "",
      ingredientes: [],
      modoPreparo: []
    };
  }

  function normalizeSnapshot(snapshot) {
    var data = Object.assign(createEmptySnapshot(), snapshot || {});

    data.tags = Array.isArray(data.tags) ? data.tags.map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean) : [];
    data.ingredientes = Array.isArray(data.ingredientes) ? data.ingredientes.map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean) : [];
    data.modoPreparo = Array.isArray(data.modoPreparo) ? data.modoPreparo.map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean) : [];

    return data;
  }

  function collectFormSnapshot() {
    return normalizeSnapshot({
      titulo: byId("titulo").value.trim(),
      categoria: byId("categoria").value,
      novaCategoria: byId("nova-categoria").value.trim(),
      tempoPreparo: byId("tempo-preparo").value.trim(),
      tempoForno: byId("tempo-forno").value.trim(),
      porcoes: byId("porcoes").value.trim(),
      dificuldade: normalizeDifficulty(byId("dificuldade").value),
      dica: byId("dica").value.trim(),
      tags: state.tags.slice(),
      foto: state.photoData,
      fotoThumb: state.photoThumbData,
      ingredientes: getListValues("ingredientes-lista"),
      modoPreparo: getListValues("passos-lista")
    });
  }

  function getSnapshotSignature(snapshot) {
    return JSON.stringify(normalizeSnapshot(snapshot));
  }

  function isMeaningfulSnapshot(snapshot) {
    var data = normalizeSnapshot(snapshot);

    return Boolean(
      data.titulo
      || data.novaCategoria
      || data.tempoPreparo
      || data.tempoForno
      || data.porcoes
      || data.dica
      || data.foto
      || data.fotoThumb
      || data.tags.length
      || data.ingredientes.length
      || data.modoPreparo.length
      || (data.categoria && data.categoria !== "__new__")
    );
  }

  function setPersistedSnapshot(snapshot) {
    state.persistedSignature = getSnapshotSignature(snapshot || createEmptySnapshot());
  }

  function clearDraft(key) {
    window.localStorage.removeItem(key || state.draftKey);
    state.lastDraftSignature = "";
  }

  function readDraft(key) {
    var draft = safeParseJson(window.localStorage.getItem(key || state.draftKey), null);

    if (!draft || !draft.snapshot) {
      return null;
    }

    return {
      savedAt: draft.savedAt || "",
      snapshot: normalizeSnapshot(draft.snapshot)
    };
  }

  function isDraftDirty() {
    return getSnapshotSignature(collectFormSnapshot()) !== state.persistedSignature;
  }

  function persistDraftNow(force) {
    var snapshot = collectFormSnapshot();
    var signature = getSnapshotSignature(snapshot);

    if (!force && !isDraftDirty()) {
      clearDraft();
      return false;
    }

    if (!isMeaningfulSnapshot(snapshot)) {
      clearDraft();
      return false;
    }

    if (!force && signature === state.lastDraftSignature) {
      return false;
    }

    window.localStorage.setItem(state.draftKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      snapshot: snapshot
    }));
    state.lastDraftSignature = signature;
    return true;
  }

  function startDraftAutosave() {
    if (state.draftTimer) {
      window.clearInterval(state.draftTimer);
    }

    state.draftTimer = window.setInterval(function () {
      if (!state.isSavingRecipe) {
        persistDraftNow(false);
      }
    }, DRAFT_INTERVAL_MS);
  }

  function showToast(message, isError) {
    var toast = byId("toast");

    if (!toast) {
      return;
    }

    toast.hidden = !message;
    toast.textContent = message || "";
    toast.setAttribute("role", isError ? "alert" : "status");
    toast.setAttribute("aria-live", isError ? "assertive" : "polite");
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
    summary.replaceChildren(
      h("strong", null, "Conexao validada"),
      h("span", null, "Owner: " + info.owner),
      h("br"),
      h("span", null, "Repositorio: " + info.repo),
      h("br"),
      h("span", null, "Branch: " + info.branch),
      h("br"),
      h("span", null, "Total de receitas lidas: " + info.totalReceitas)
    );
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

    select.replaceChildren();

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

    container.replaceChildren();

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
    var validation = window.NRValidation.validateRecipe(Object.assign(collectFormSnapshot(), {
      isProcessingPhoto: state.isProcessingPhoto
    }));
    var elements = {
      titulo: byId("titulo"),
      categoria: byId("categoria"),
      novaCategoria: byId("nova-categoria"),
      foto: byId("foto"),
      porcoes: byId("porcoes"),
      tags: byId("tag-input"),
      ingredientes: byId("ingredientes-lista"),
      modoPreparo: byId("passos-lista"),
      dificuldade: byId("dificuldade")
    };

    clearErrors();
    showToast("", false);

    Object.keys(validation.errors).forEach(function (field) {
      showError(field, validation.errors[field], elements[field]);
    });

    return validation.valid;
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

  function getCentralCrop(img, targetWidth, targetHeight) {
    var imageRatio = img.width / img.height;
    var targetRatio = targetWidth / targetHeight;
    var cropWidth = img.width;
    var cropHeight = img.height;
    var cropX = 0;
    var cropY = 0;

    if (imageRatio > targetRatio) {
      cropWidth = img.height * targetRatio;
      cropX = (img.width - cropWidth) / 2;
    } else if (imageRatio < targetRatio) {
      cropHeight = img.width / targetRatio;
      cropY = (img.height - cropHeight) / 2;
    }

    return {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight
    };
  }

  function drawCroppedImage(ctx, img, crop, outputWidth, outputHeight) {
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, outputWidth, outputHeight);
  }

  function compactarImagemBase64(dataUrl, targetWidth, targetHeight, limitBytes, minWidth, minHeight) {
    return new Promise(function (resolve, reject) {
      var img = new Image();

      img.onload = function () {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        var currentWidth = targetWidth;
        var currentHeight = targetHeight;
        var crop = getCentralCrop(img, targetWidth, targetHeight);

        if (!ctx) {
          reject(new Error("Nao foi possivel preparar a foto."));
          return;
        }

        while (currentWidth >= minWidth && currentHeight >= minHeight) {
          var qualidadeAtual = 0.85;

          canvas.width = currentWidth;
          canvas.height = currentHeight;
          drawCroppedImage(ctx, img, crop, currentWidth, currentHeight);

          while (qualidadeAtual >= 0.45) {
            var base64 = canvas.toDataURL("image/jpeg", qualidadeAtual);

            if (getDataUrlByteSize(base64) <= limitBytes) {
              resolve(base64);
              return;
            }

            qualidadeAtual -= 0.05;
          }

          currentWidth -= 24;
          currentHeight -= 18;
        }

        reject(new Error("Nao foi possivel compactar a foto. Tente outra imagem."));
      };

      img.onerror = function () {
        reject(new Error("Nao foi possivel carregar a imagem."));
      };

      img.src = dataUrl;
    });
  }

  function processarDerivadosDaFoto(dataUrl) {
    return Promise.all([
      compactarImagemBase64(
        dataUrl,
        PHOTO_TARGET_WIDTH,
        PHOTO_TARGET_HEIGHT,
        PHOTO_LIMIT_BYTES,
        PHOTO_MIN_WIDTH,
        PHOTO_MIN_HEIGHT
      ),
      compactarImagemBase64(
        dataUrl,
        PHOTO_THUMB_TARGET_WIDTH,
        PHOTO_THUMB_TARGET_HEIGHT,
        PHOTO_THUMB_LIMIT_BYTES,
        PHOTO_THUMB_MIN_WIDTH,
        PHOTO_THUMB_MIN_HEIGHT
      )
    ]).then(function (result) {
      return {
        foto: result[0],
        fotoThumb: result[1]
      };
    });
  }

  function processarArquivoDeFoto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onload = function (event) {
        processarDerivadosDaFoto(event.target.result)
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
    var snapshot = collectFormSnapshot();
    var categoryValue = snapshot.categoria;
    var categoryData = categoryValue === "__new__"
      ? null
      : await window.NRStorage.getCategoryById(categoryValue);
    var categoryName = categoryValue === "__new__"
      ? snapshot.novaCategoria
      : (categoryData ? categoryData.nome : categoryValue);

    return {
      id: state.recipeId,
      titulo: snapshot.titulo,
      categoriaId: categoryValue === "__new__" ? categoryName : categoryValue,
      categoriaNome: categoryName,
      categoriaIcone: categoryData ? categoryData.icone : "",
      categoriaCor: categoryData ? categoryData.cor : "",
      tags: snapshot.tags.slice(),
      tempoPreparo: snapshot.tempoPreparo,
      tempoForno: snapshot.tempoForno,
      porcoes: snapshot.porcoes ? Number(snapshot.porcoes) : 0,
      dificuldade: snapshot.dificuldade,
      foto: state.photoData,
      fotoThumb: state.photoThumbData,
      ingredientes: snapshot.ingredientes,
      modoPreparo: snapshot.modoPreparo,
      dica: snapshot.dica,
      _lastSyncedSnapshot: state.lastSyncedSnapshot
        ? window.NRStorage.captureConflictSnapshot(state.lastSyncedSnapshot)
        : null
    };
  }

  async function applyFormSnapshot(snapshot) {
    var data = normalizeSnapshot(snapshot);
    var categoryValues;

    byId("titulo").value = data.titulo;
    await renderCategoryOptions(data.categoria);
    categoryValues = Array.prototype.slice.call(byId("categoria").options).map(function (option) {
      return option.value;
    });

    if (data.categoria && categoryValues.indexOf(data.categoria) !== -1) {
      byId("categoria").value = data.categoria;
      byId("nova-categoria").value = data.novaCategoria;
    } else if (data.categoria === "__new__" || data.novaCategoria) {
      byId("categoria").value = "__new__";
      byId("nova-categoria").value = data.novaCategoria || data.categoria;
    }

    toggleNewCategoryField();

    byId("tempo-preparo").value = data.tempoPreparo;
    byId("tempo-forno").value = data.tempoForno;
    byId("porcoes").value = data.porcoes;
    byId("dificuldade").value = normalizeDifficulty(data.dificuldade);
    byId("dica").value = data.dica;

    state.tags = data.tags.slice();
    state.photoData = data.foto || "";
    state.photoThumbData = data.fotoThumb || "";

    setPreview(state.photoData || "assets/sem-foto.svg");
    renderTags();

    byId("ingredientes-lista").replaceChildren();
    byId("passos-lista").replaceChildren();

    if (data.ingredientes.length) {
      data.ingredientes.forEach(function (item) {
        addListItem("ingredientes-lista", "ingredientes", item);
      });
    } else {
      addListItem("ingredientes-lista", "ingredientes", "");
    }

    if (data.modoPreparo.length) {
      data.modoPreparo.forEach(function (item) {
        addListItem("passos-lista", "passos", item);
      });
    } else {
      addListItem("passos-lista", "passos", "");
    }
  }

  async function fillForm(recipe) {
    state.recipeId = recipe.id;
    state.lastSyncedSnapshot = window.NRStorage.captureConflictSnapshot(recipe);
    state.draftKey = getDraftKey(recipe.id);

    byId("admin-titulo").textContent = "Editar receita";
    await applyFormSnapshot({
      titulo: recipe.titulo || "",
      categoria: recipe.categoriaId || "",
      novaCategoria: recipe.categoriaNome || "",
      tempoPreparo: recipe.tempoPreparo || "",
      tempoForno: recipe.tempoForno || "",
      porcoes: recipe.porcoes ? String(recipe.porcoes) : "",
      dificuldade: normalizeDifficulty(recipe.dificuldade),
      dica: recipe.dica || "",
      tags: Array.isArray(recipe.tags) ? recipe.tags.slice() : [],
      foto: recipe.foto || "",
      fotoThumb: recipe.fotoThumb || "",
      ingredientes: recipe.ingredientes || [],
      modoPreparo: recipe.modoPreparo || []
    });

    byId("delete-recipe").hidden = false;
  }

  async function restoreDraftIfAvailable() {
    var draft = readDraft();

    if (!draft || !draft.snapshot) {
      state.lastDraftSignature = "";
      return false;
    }

    if (getSnapshotSignature(draft.snapshot) === state.persistedSignature) {
      clearDraft();
      return false;
    }

    await applyFormSnapshot(draft.snapshot);
    state.lastDraftSignature = getSnapshotSignature(draft.snapshot);
    showToast("Rascunho recuperado automaticamente.", false);
    return true;
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

  function resetHistoryState() {
    state.historyEntries = [];
    state.historyDetails = {};
    state.selectedHistoryCommit = "";
  }

  function getHistoryEntryBySha(commitSha) {
    return state.historyEntries.find(function (entry) {
      return entry.sha === commitSha;
    }) || null;
  }

  function buildHistoryEmptyBlock(title, message) {
    return h(
      "div",
      { className: "historico-vazio" },
      h("strong", null, title),
      h("p", null, message)
    );
  }

  function renderHistorySummaryBlock(entry) {
    var details = [
      entry.authorName || "Autor desconhecido",
      window.NRUtils.formatDateTime(entry.authoredAt),
      entry.shortSha || String(entry.sha || "").slice(0, 7)
    ].filter(Boolean).join(" | ");

    return h(
      "article",
      { className: "historico-resumo" },
      h("strong", null, entry.message || "Commit sem titulo"),
      h(
        "p",
        null,
        entry.messageBody || "Commit registrado no arquivo de receitas."
      ),
      h("small", null, details)
    );
  }

  function getHistoryStatusLabel(status) {
    if (status === "removed") {
      return "Removida";
    }

    if (status === "added") {
      return "Adicionada";
    }

    return "Atualizada";
  }

  function buildHistoryRecipeColumn(label, recipe, emptyMessage) {
    if (!recipe) {
      return h(
        "div",
        { className: "historico-mudanca-coluna" },
        h("span", null, label),
        h("p", null, emptyMessage)
      );
    }

    return h(
      "div",
      { className: "historico-mudanca-coluna" },
      h("span", null, label),
      h("strong", null, recipe.titulo || "Receita sem titulo"),
      h("p", null, recipe.categoriaNome || recipe.categoriaId || "Sem categoria"),
      h(
        "p",
        null,
        "Ingredientes: " + (Array.isArray(recipe.ingredientes) ? recipe.ingredientes.length : 0)
          + " | Passos: " + (Array.isArray(recipe.modoPreparo) ? recipe.modoPreparo.length : 0)
      ),
      h("small", null, "Atualizado em " + window.NRUtils.formatDateTime(recipe.atualizadoEm || recipe.criadoEm))
    );
  }

  async function handleHistoryRestore(change, entry) {
    var recipeToRestore = change && change.restoreRecipe;
    var recipeTitle = recipeToRestore && recipeToRestore.titulo ? recipeToRestore.titulo : "esta receita";

    if (!recipeToRestore) {
      showToast("Nao encontrei uma receita valida para restaurar neste commit.", true);
      return;
    }

    if (!window.GitHubSync.hasToken()) {
      showToast("Configure um token GitHub antes de restaurar uma receita do historico.", true);
      return;
    }

    if (!window.confirm('Deseja restaurar "' + recipeTitle + '" a partir desta versao do historico?')) {
      return;
    }

    showToast("Restaurando receita do historico...", false);

    try {
      await window.NRStorage.restoreRecipeFromHistory(recipeToRestore, {
        commitMessage: "Restaura receita: " + recipeTitle + " (" + (entry.shortSha || String(entry.sha || "").slice(0, 7)) + ")"
      });
      await renderSpaceUsage();
      await renderThumbnailMigration();
      renderDiagnostics();
      await loadHistory(true);
      showToast("Receita restaurada do historico com sucesso.", false);
    } catch (error) {
      showToast(error.message || "Nao foi possivel restaurar a receita.", true);
    }
  }

  function renderHistoryList() {
    var list = byId("historico-commits");

    if (!list) {
      return;
    }

    list.replaceChildren();

    if (!state.historyEntries.length) {
      list.replaceChildren(buildHistoryEmptyBlock(
        "Nenhum commit encontrado",
        "Assim que o arquivo de receitas receber novas gravacoes, o historico aparecera aqui."
      ));
      return;
    }

    state.historyEntries.forEach(function (entry) {
      var isActive = state.selectedHistoryCommit === entry.sha;
      var button = h(
        "button",
        {
          className: "historico-commit" + (isActive ? " is-active" : ""),
          type: "button",
          "aria-pressed": isActive ? "true" : "false",
          onClick: function () {
            loadHistoryDetail(entry.sha);
          }
        },
        h("strong", null, entry.message || "Commit sem titulo"),
        h("span", null, (entry.authorName || "Autor desconhecido") + " | " + window.NRUtils.formatDateTime(entry.authoredAt)),
        h("small", null, entry.shortSha || String(entry.sha || "").slice(0, 7))
      );

      list.appendChild(button);
    });
  }

  function renderHistoryDetailPlaceholder(title, message) {
    var detail = byId("historico-detalhe");

    if (!detail) {
      return;
    }

    detail.replaceChildren(buildHistoryEmptyBlock(title, message));
  }

  function renderHistoryDetail(detailData, entry) {
    var detail = byId("historico-detalhe");

    if (!detail) {
      return;
    }

    detail.replaceChildren();

    if (!entry) {
      detail.replaceChildren(buildHistoryEmptyBlock(
        "Escolha um commit",
        "Selecione uma versao na coluna ao lado para ver as receitas alteradas."
      ));
      return;
    }

    if (!detailData || !Array.isArray(detailData.changes) || !detailData.changes.length) {
      detail.replaceChildren(
        renderHistorySummaryBlock(entry),
        buildHistoryEmptyBlock(
          "Nenhuma receita mudou nesta versao",
          "O commit nao alterou objetos de receita comparando com a versao anterior do arquivo."
        )
      );
      return;
    }

    detail.replaceChildren(renderHistorySummaryBlock(entry));

    detailData.changes.forEach(function (change) {
      var description;

      if (change.status === "removed") {
        description = "Esta receita saiu do arquivo nesta versao.";
      } else if (change.status === "added") {
        description = "Esta receita entrou no livro neste commit.";
      } else {
        description = "Campos alterados nesta versao:";
      }

      detail.appendChild(
        h(
          "article",
          { className: "historico-mudanca" },
          h(
            "div",
            { className: "historico-mudanca-topo" },
            h(
              "div",
              null,
              h("strong", null, change.titulo || "Receita sem titulo"),
              h("p", null, description)
            ),
            h(
              "span",
              {
                className: "historico-mudanca-status",
                dataset: { status: change.status }
              },
              getHistoryStatusLabel(change.status)
            )
          ),
          change.status === "updated" && change.changedFields && change.changedFields.length
            ? h(
              "ul",
              { className: "historico-mudanca-campos" },
              change.changedFields.map(function (fieldLabel) {
                return h("li", null, fieldLabel);
              })
            )
            : null,
          h(
            "div",
            { className: "historico-mudanca-grid" },
            buildHistoryRecipeColumn(
              "Antes do commit",
              change.beforeRecipe,
              change.status === "added"
                ? "A receita ainda nao existia antes deste commit."
                : "Sem registro desta versao anterior."
            ),
            buildHistoryRecipeColumn(
              "Resultado do commit",
              change.afterRecipe,
              change.status === "removed"
                ? "O commit removeu esta receita do arquivo."
                : "Sem registro desta versao."
            )
          ),
          h(
            "div",
            { className: "conflito-acoes" },
            h(
              "button",
              {
                className: "botao-secundario",
                type: "button",
                disabled: !window.GitHubSync.hasToken(),
                onClick: function () {
                  handleHistoryRestore(change, entry);
                }
              },
              window.GitHubSync.hasToken() ? "Restaurar esta receita" : "Configure um token para restaurar"
            )
          )
        )
      );
    });
  }

  async function loadHistoryDetail(commitSha, skipFocus) {
    var entry = getHistoryEntryBySha(commitSha);
    var detailShell = byId("historico-detalhe");

    if (!entry || !detailShell) {
      return;
    }

    state.selectedHistoryCommit = commitSha;
    renderHistoryList();
    renderHistoryDetailPlaceholder("Carregando versao...", "Montando o diff das receitas deste commit.");

    try {
      if (!state.historyDetails[commitSha]) {
        state.historyDetails[commitSha] = await window.NRStorage.getRecipeHistoryDetail(commitSha, entry.parentSha);
      }

      renderHistoryDetail(state.historyDetails[commitSha], entry);

      if (!skipFocus) {
        detailShell.focus();
      }
    } catch (error) {
      renderHistoryDetailPlaceholder("Nao foi possivel abrir esta versao", describeGitHubError(error));
    }
  }

  async function loadHistory(forceRefresh) {
    var list = byId("historico-commits");

    if (!list || !window.NRStorage) {
      return;
    }

    if (forceRefresh) {
      resetHistoryState();
    }

    list.replaceChildren(buildHistoryEmptyBlock(
      "Carregando historico...",
      "Buscando os commits mais recentes do arquivo de receitas."
    ));
    renderHistoryDetailPlaceholder("Carregando versao...", "Aguarde um instante enquanto o painel monta o historico.");

    try {
      state.historyEntries = await window.NRStorage.getRecipeHistory(20);
      renderHistoryList();

      if (!state.historyEntries.length) {
        renderHistoryDetailPlaceholder(
          "Historico vazio",
          "Ainda nao ha commits suficientes no arquivo remoto para exibir o historico."
        );
        return;
      }

      if (!state.selectedHistoryCommit || !getHistoryEntryBySha(state.selectedHistoryCommit)) {
        state.selectedHistoryCommit = state.historyEntries[0].sha;
      }

      await loadHistoryDetail(state.selectedHistoryCommit, true);
    } catch (error) {
      resetHistoryState();
      list.replaceChildren(buildHistoryEmptyBlock(
        "Nao foi possivel carregar o historico",
        describeGitHubError(error)
      ));
      renderHistoryDetailPlaceholder(
        "Historico indisponivel",
        "Revise owner, repositorio, branch e token antes de tentar novamente."
      );
    }
  }

  function summarizeConflictValue(conflictKey, value) {
    if (conflictKey === "receita") {
      return String(value || "Sem detalhes");
    }

    if (conflictKey === "categoria") {
      return value && (value.categoriaNome || value.categoriaId)
        ? String(value.categoriaNome || value.categoriaId)
        : "Sem categoria";
    }

    if (conflictKey === "foto") {
      return value && value.foto
        ? "Foto atualizada"
        : "Sem foto";
    }

    if (Array.isArray(value)) {
      return value.length ? value.join(" • ") : "Sem itens";
    }

    if (typeof value === "number") {
      return String(value);
    }

    return String(value || "Vazio");
  }

  function buildConflictColumn(title, body) {
    return h(
      "div",
      { className: "conflito-coluna" },
      h("span", null, title),
      h("p", null, body)
    );
  }

  function getFocusableElements(container) {
    if (!container) {
      return [];
    }

    return Array.prototype.slice.call(container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (element) {
      return !element.hidden && element.getAttribute("aria-hidden") !== "true";
    });
  }

  function openConflictModal(conflict) {
    var shell = byId("conflito-modal-shell");

    if (!shell) {
      return Promise.resolve({ choice: "cancel" });
    }

    return new Promise(function (resolve) {
      var previousActive = document.activeElement;
      var titleId = "conflito-modal-titulo";
      var descriptionId = "conflito-modal-descricao";
      var noteId = "conflito-modal-nota";
      var message = conflict.deletedRemotely
        ? "A receita foi apagada no GitHub enquanto voce ainda editava neste dispositivo."
        : "A receita mudou em outro dispositivo. As mudancas sem conflito seguem preservadas automaticamente; escolha qual lado vence nos campos abaixo.";
      var localLabel = conflict.deletedRemotely ? "Restaurar minha versao" : "Manter minhas mudancas";
      var remoteLabel = conflict.deletedRemotely ? "Aceitar exclusao remota" : "Usar versao do GitHub";
      var dialog = null;
      var cleanup;

      function finish(result) {
        document.body.classList.remove("modal-open");
        shell.hidden = true;
        shell.replaceChildren();
        document.removeEventListener("keydown", handleKeydown);

        if (previousActive && typeof previousActive.focus === "function") {
          previousActive.focus();
        }

        resolve(result);
      }

      function handleKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          finish({ choice: "cancel" });
          return;
        }

        if (event.key === "Tab") {
          var focusable = getFocusableElements(dialog);

          if (!focusable.length) {
            return;
          }

          var first = focusable[0];
          var last = focusable[focusable.length - 1];

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
            return;
          }

          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }

      cleanup = finish;
      shell.hidden = false;
      document.body.classList.add("modal-open");

      dialog = h(
        "section",
        {
          className: "modal-card pagina-textura",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": titleId,
          "aria-describedby": descriptionId + " " + noteId
        },
        h("p", { className: "sobretitulo" }, "Conflito de edicao"),
        h("h2", { id: titleId }, conflict.deletedRemotely ? "Esta receita foi removida no GitHub" : "Encontramos alteracoes concorrentes"),
        h("p", { className: "conflito-intro", id: descriptionId }, message),
        h("p", { className: "conflito-nota", id: noteId }, "Seu escolhido vence apenas nos campos em disputa. O resto continua mesclado automaticamente."),
        h(
          "div",
          { className: "conflito-lista" },
          conflict.conflicts.map(function (item) {
            return h(
              "article",
              { className: "conflito-item" },
              h("strong", null, item.label),
              h(
                "div",
                { className: "conflito-grid" },
                buildConflictColumn("Antes", summarizeConflictValue(item.key, item.base)),
                buildConflictColumn("Sua edicao", summarizeConflictValue(item.key, item.local)),
                buildConflictColumn("GitHub", summarizeConflictValue(item.key, item.remote))
              )
            );
          })
        ),
        h(
          "div",
          { className: "conflito-acoes" },
          h(
            "button",
            {
              className: "botao-secundario",
              type: "button",
              onClick: function () {
                cleanup({ choice: "cancel" });
              }
            },
            "Cancelar"
          ),
          h(
            "button",
            {
              className: "botao-secundario",
              type: "button",
              onClick: function () {
                cleanup({ choice: "remote" });
              }
            },
            remoteLabel
          ),
          h(
            "button",
            {
              className: "botao-primario",
              type: "button",
              onClick: function () {
                cleanup({ choice: "local" });
              }
            },
            localLabel
          )
        )
      );

      shell.replaceChildren(
        h("button", {
          className: "modal-backdrop",
          type: "button",
          "aria-label": "Fechar o comparativo de conflito",
          onClick: function () {
            cleanup({ choice: "cancel" });
          }
        }),
        dialog
      );

      document.addEventListener("keydown", handleKeydown);
      window.setTimeout(function () {
        var primary = shell.querySelector(".botao-primario");

        if (primary) {
          primary.focus();
        }
      }, 0);
    });
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

    list.replaceChildren();

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

  async function getRecipesMissingThumbs() {
    var recipes = await window.NRStorage.getAllRecipes();

    return recipes.filter(function (recipe) {
      return Boolean(recipe.foto) && !recipe.fotoThumb;
    });
  }

  async function renderThumbnailMigration() {
    var shell = byId("thumb-migracao-shell");
    var missing = await getRecipesMissingThumbs();
    var button;
    var message;

    if (!shell) {
      return;
    }

    shell.replaceChildren();

    if (!missing.length) {
      return;
    }

    message = h(
      "div",
      { className: "thumb-migracao" },
      h("strong", null, "Miniaturas antigas pendentes"),
      h(
        "p",
        null,
        missing.length + (missing.length === 1
          ? " receita ainda nao tem miniatura otimizada."
          : " receitas ainda nao tem miniaturas otimizadas.")
      ),
      h(
        "p",
        null,
        "Gere essas miniaturas uma vez para deixar as listas mais leves e manter os registros antigos no novo formato."
      )
    );

    button = document.createElement("button");
    button.className = "botao-secundario";
    button.type = "button";
    button.textContent = window.GitHubSync.hasToken()
      ? "Gerar miniaturas antigas"
      : "Configure um token para migrar";

    button.addEventListener("click", function () {
      if (!window.GitHubSync.hasToken()) {
        showToast("Configure um token GitHub antes de migrar receitas antigas.", true);
        return;
      }

      migrateLegacyThumbnails();
    });

    message.appendChild(button);
    shell.appendChild(message);
  }

  async function migrateLegacyThumbnails() {
    var recipes = await getRecipesMissingThumbs();
    var currentIndex = 0;

    if (!recipes.length) {
      showToast("Nao ha miniaturas antigas para migrar.", false);
      await renderThumbnailMigration();
      return;
    }

    showToast("Gerando miniaturas antigas...", false);

    while (currentIndex < recipes.length) {
      var recipe = recipes[currentIndex];
      var thumb = await compactarImagemBase64(
        recipe.foto,
        PHOTO_THUMB_TARGET_WIDTH,
        PHOTO_THUMB_TARGET_HEIGHT,
        PHOTO_THUMB_LIMIT_BYTES,
        PHOTO_THUMB_MIN_WIDTH,
        PHOTO_THUMB_MIN_HEIGHT
      );

      await window.NRStorage.saveRecipe(Object.assign({}, recipe, {
        fotoThumb: thumb
      }));

      currentIndex += 1;
    }

    await renderSpaceUsage();
    await renderThumbnailMigration();
    renderDiagnostics();
    await loadHistory(true);
    showToast(recipes.length === 1 ? "Miniatura antiga gerada com sucesso." : "Miniaturas antigas geradas com sucesso.", false);
  }

  function renderDiagnostics() {
    var list = byId("diagnostico-lista");
    var entries = window.NRDiagnostics ? window.NRDiagnostics.getEntries(20) : [];

    if (!list) {
      return;
    }

    list.replaceChildren();

    if (!entries.length) {
      list.replaceChildren(
        h(
          "div",
          { className: "diagnostico-item" },
          h("strong", null, "Ainda nao ha eventos registrados."),
          h("p", null, "As proximas leituras, gravacoes e erros de sincronizacao aparecerao aqui.")
        )
      );
      return;
    }

    entries.forEach(function (entry) {
      var item = document.createElement("article");
      var title = document.createElement("strong");
      var message = document.createElement("p");
      var meta = document.createElement("small");

      item.className = "diagnostico-item";
      title.textContent = entry.source + " - " + entry.kind + " - " + entry.status;
      message.textContent = entry.message;
      meta.textContent = window.NRUtils.formatDateTime(entry.at) + (entry.details ? " | " + entry.details : "");

      item.appendChild(title);
      item.appendChild(message);
      item.appendChild(meta);
      list.appendChild(item);
    });
  }

  function exportDiagnostics() {
    var text = window.NRDiagnostics ? window.NRDiagnostics.exportText() : "";
    var blob;
    var url;
    var link;

    if (!text) {
      showToast("Ainda nao ha log suficiente para exportar.", true);
      return;
    }

    blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    url = window.URL.createObjectURL(blob);
    link = document.createElement("a");
    link.href = url;
    link.download = "nossas-receitas-log.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
      compressed = await Promise.all([
        compactarImagemBase64(
          recipe.foto,
          RECOMPRESS_TARGET_WIDTH,
          RECOMPRESS_TARGET_HEIGHT,
          RECOMPRESS_LIMIT_BYTES,
          RECOMPRESS_MIN_WIDTH,
          RECOMPRESS_MIN_HEIGHT
        ),
        compactarImagemBase64(
          recipe.foto,
          PHOTO_THUMB_TARGET_WIDTH,
          PHOTO_THUMB_TARGET_HEIGHT,
          PHOTO_THUMB_LIMIT_BYTES,
          PHOTO_THUMB_MIN_WIDTH,
          PHOTO_THUMB_MIN_HEIGHT
        )
      ]);
      saved = await window.NRStorage.saveRecipe(Object.assign({}, recipe, {
        foto: compressed[0],
        fotoThumb: compressed[1]
      }));
      reduction = Math.max(0, Math.round((1 - (getDataUrlByteSize(saved.foto) / oldBytes)) * 100));

      if (String(saved.id) === String(state.recipeId)) {
        state.photoData = saved.foto;
        state.photoThumbData = saved.fotoThumb || "";
        setPreview(saved.foto);
      }

      await renderSpaceUsage();
      await renderThumbnailMigration();
      await loadHistory(true);
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
        clearDraft(getDraftKey(state.recipeId));
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

    processarArquivoDeFoto(file).then(function (data) {
      if (currentJobId !== state.photoJobId) {
        return;
      }

      state.photoData = data.foto;
      state.photoThumbData = data.fotoThumb;
      setPreview(data.foto);
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
      await renderThumbnailMigration();
      await loadHistory(true);

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
    byId("container-migracao").replaceChildren();
    await renderSpaceUsage();
    await renderThumbnailMigration();
    await loadHistory(true);
  }

  function mountSharedControls() {
    if (window.NRSyncStatus) {
      window.NRSyncStatus.mount(byId("sync-status-admin"), { showRefresh: true });
      window.NRSyncStatus.mountMotionToggle(byId("toggle-motion-admin"));
      window.NRSyncStatus.mountThemeToggle(byId("toggle-theme-admin"));
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
    byId("btn-exportar-log").addEventListener("click", exportDiagnostics);
    byId("btn-limpar-log").addEventListener("click", function () {
      if (!window.NRDiagnostics) {
        return;
      }

      window.NRDiagnostics.clear();
      renderDiagnostics();
    });
    byId("btn-atualizar-historico").addEventListener("click", function () {
      loadHistory(true).catch(function (error) {
        showToast(error.message || "Nao foi possivel atualizar o historico.", true);
      });
    });

    ["repo-owner", "repo-name", "repo-branch"].forEach(function (id) {
      byId(id).addEventListener("change", function () {
        persistRepoFields();
        renderWizardSummary(null);
        resetHistoryState();
        byId("historico-commits").replaceChildren(buildHistoryEmptyBlock(
          "Historico aguardando confirmacao",
          "Valide o owner, repositorio e branch para recarregar o historico deste destino."
        ));
        renderHistoryDetailPlaceholder(
          "Revise o destino do repositorio",
          "Depois de confirmar o novo owner, repositorio e branch, clique em atualizar historico."
        );
      });
    });

    byId("recipe-form").addEventListener("submit", async function (event) {
      var submitButton = byId("btn-salvar-receita");
      var saved;
      var previousDraftKey = state.draftKey;

      event.preventDefault();

      if (!validateForm()) {
        return;
      }

      state.isSavingRecipe = true;
      submitButton.disabled = true;
      showToast(window.GitHubSync.hasToken() ? "Salvando no GitHub..." : "Salvando neste navegador...", false);

      try {
        saved = await window.NRStorage.saveRecipe(await buildRecipePayload(), {
          conflictResolver: openConflictModal
        });
        state.recipeId = saved.id;
        state.lastSyncedSnapshot = window.NRStorage.captureConflictSnapshot(saved);
        state.draftKey = getDraftKey(saved.id);
        setPersistedSnapshot(collectFormSnapshot());
        clearDraft(previousDraftKey);
        clearDraft(state.draftKey);
        await renderSpaceUsage();
        await renderThumbnailMigration();
        showToast(window.GitHubSync.hasToken() ? "Receita sincronizada com sucesso! OK" : "Receita salva neste navegador! OK", false);

        window.setTimeout(function () {
          window.location.href = "livro.html?receita=" + saved.id + "&categoria=" + saved.categoriaId;
        }, 1600);
      } catch (error) {
        if (error && error.code === "conflict_cancelled") {
          showToast("Salvamento pausado para voce revisar o conflito.", false);
          return;
        }

        if (error && error.code === "remote_deleted") {
          showToast("A versao remota removeu esta receita. Voltando ao livro...", true);
          window.setTimeout(function () {
            window.location.href = "livro.html?mensagem=" + encodeURIComponent("A receita foi removida em outro dispositivo.");
          }, 1400);
          return;
        }

        showToast(error.message || "Nao foi possivel salvar a receita.", true);
      } finally {
        state.isSavingRecipe = false;
        submitButton.disabled = false;
        updateSaveButtonLabel();
      }
    });

    window.addEventListener("beforeunload", function (event) {
      if (!isDraftDirty()) {
        return;
      }

      persistDraftNow(true);
      event.preventDefault();
      event.returnValue = "";
    });

    window.addEventListener("pagehide", function () {
      if (isDraftDirty()) {
        persistDraftNow(true);
      }
    });

    window.addEventListener("nr:diagnostics-changed", renderDiagnostics);
  }

  async function initAdmin() {
    var recipeId;
    var recipe;

    if (!document.getElementById("recipe-form") || !window.NRStorage || !window.GitHubSync || !window.NRUtils || !window.NRValidation) {
      return;
    }

    await window.NRStorage.initDefaultData();
    mountSharedControls();
    state.lastSyncedSnapshot = null;
    state.draftKey = getDraftKey();
    applyRepoFields(window.GitHubSync.getRepoInfo());
    await renderCategoryOptions();
    toggleNewCategoryField();
    setPreview("assets/sem-foto.svg");
    setPhotoStatus("", false);
    refreshTokenUI();
    addListItem("ingredientes-lista", "ingredientes", "");
    addListItem("passos-lista", "passos", "");
    initEvents();
    startDraftAutosave();
    initDelete();
    await renderSpaceUsage();
    await renderThumbnailMigration();
    renderDiagnostics();
    await loadHistory(true);

    if (window.GitHubSync.hasToken() && window.Migration) {
      window.Migration.verificarEMigrar(byId("container-migracao"));
    }

    recipeId = getParams().get("id");
    if (!recipeId) {
      setPersistedSnapshot(collectFormSnapshot());
      await restoreDraftIfAvailable();
      return;
    }

    recipe = await window.NRStorage.getRecipeById(recipeId);

    if (!recipe) {
      window.location.href = "livro.html?mensagem=" + encodeURIComponent("Receita nao encontrada.");
      return;
    }

    await fillForm(recipe);
    setPersistedSnapshot(collectFormSnapshot());
    await restoreDraftIfAvailable();

    if (getParams().get("recompress") === "1" && recipe.foto) {
      recompressRecipePhoto(recipe.id);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAdmin();
  });
})();
