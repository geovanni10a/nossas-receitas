(function () {
  var state = {
    recipeId: null,
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
    isSavingRecipe: false
  };

  var PHOTO_LIMIT_BYTES = 100 * 1024;
  var PHOTO_TARGET_WIDTH = 600;
  var PHOTO_TARGET_HEIGHT = 600;
  var PHOTO_MIN_WIDTH = 320;
  var PHOTO_MIN_HEIGHT = 320;
  var PHOTO_THUMB_LIMIT_BYTES = 15 * 1024;
  var PHOTO_THUMB_TARGET_WIDTH = 160;
  var PHOTO_THUMB_TARGET_HEIGHT = 120;
  var PHOTO_THUMB_MIN_WIDTH = 120;
  var PHOTO_THUMB_MIN_HEIGHT = 90;
  var PHOTO_PREFERRED_MIME = "image/webp";
  var PHOTO_FALLBACK_MIME = "image/jpeg";
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
      videoUrl: "",
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
      videoUrl: byId("video-url").value.trim(),
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
      || data.videoUrl
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

  async function renderCategoryOptions(selectedValue) {
    var select = byId("categoria");
    var categories = await window.NRStorage.getCategories();

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

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onload = function () {
        resolve(reader.result);
      };

      reader.onerror = function () {
        reject(new Error("Nao foi possivel converter a imagem processada."));
      };

      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise(function (resolve) {
      if (typeof canvas.toBlob !== "function") {
        resolve(null);
        return;
      }

      canvas.toBlob(function (blob) {
        resolve(blob || null);
      }, mimeType, quality);
    });
  }

  async function exportCanvasImage(canvas, preferredMime, fallbackMime, quality) {
    var blob = await canvasToBlob(canvas, preferredMime, quality);

    if (blob && blob.size > 0 && (!preferredMime || blob.type === preferredMime)) {
      return blobToDataUrl(blob);
    }

    if (fallbackMime && fallbackMime !== preferredMime) {
      var fallbackBlob = await canvasToBlob(canvas, fallbackMime, quality);

      if (fallbackBlob && fallbackBlob.size > 0 && (!fallbackMime || fallbackBlob.type === fallbackMime)) {
        return blobToDataUrl(fallbackBlob);
      }
    }

    var preferredDataUrl = canvas.toDataURL(preferredMime, quality);

    if (preferredDataUrl.indexOf("data:" + preferredMime) === 0) {
      return preferredDataUrl;
    }

    return canvas.toDataURL(fallbackMime || PHOTO_FALLBACK_MIME, quality);
  }

  function compactarImagemBase64(dataUrl, targetWidth, targetHeight, limitBytes, minWidth, minHeight, preferredMime, fallbackMime) {
    return new Promise(function (resolve, reject) {
      var img = new Image();

      img.onload = async function () {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        var currentWidth = targetWidth;
        var currentHeight = targetHeight;
        var crop = getCentralCrop(img, targetWidth, targetHeight);

        if (!ctx) {
          reject(new Error("Nao foi possivel preparar a foto."));
          return;
        }

        try {
          while (currentWidth >= minWidth && currentHeight >= minHeight) {
            var qualidadeAtual = 0.82;

            canvas.width = currentWidth;
            canvas.height = currentHeight;
            drawCroppedImage(ctx, img, crop, currentWidth, currentHeight);

            while (qualidadeAtual >= 0.42) {
              var base64 = await exportCanvasImage(
                canvas,
                preferredMime || PHOTO_PREFERRED_MIME,
                fallbackMime || PHOTO_FALLBACK_MIME,
                qualidadeAtual
              );

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
        } catch (error) {
          reject(error);
        }
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
        PHOTO_MIN_HEIGHT,
        PHOTO_PREFERRED_MIME,
        PHOTO_FALLBACK_MIME
      ),
      compactarImagemBase64(
        dataUrl,
        PHOTO_THUMB_TARGET_WIDTH,
        PHOTO_THUMB_TARGET_HEIGHT,
        PHOTO_THUMB_LIMIT_BYTES,
        PHOTO_THUMB_MIN_WIDTH,
        PHOTO_THUMB_MIN_HEIGHT,
        PHOTO_PREFERRED_MIME,
        PHOTO_FALLBACK_MIME
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
      categoriaId: categoryValue === "__new__" ? window.NRStorage.slugify(categoryName) : categoryValue,
      categoriaNome: categoryName,
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
      videoUrl: snapshot.videoUrl
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
    byId("video-url").value = data.videoUrl || "";

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
      videoUrl: recipe.videoUrl || "",
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
      showToast("Salvando no Supabase...", false);

      try {
        saved = await window.NRStorage.saveRecipe(await buildRecipePayload());
        state.recipeId = saved.id;
        state.draftKey = getDraftKey(saved.id);
        setPersistedSnapshot(collectFormSnapshot());
        clearDraft(previousDraftKey);
        clearDraft(state.draftKey);
        showToast("Receita salva com sucesso!", false);

        window.setTimeout(function () {
          window.location.href = "livro.html?receita=" + saved.id + "&categoria=" + saved.categoriaId;
        }, 1200);
      } catch (error) {
        showToast(error.message || "Nao foi possivel salvar a receita.", true);
      } finally {
        state.isSavingRecipe = false;
        submitButton.disabled = false;
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
  }

  async function initAdmin() {
    var recipeId;
    var recipe;
    var preselectedCategory;

    if (!document.getElementById("recipe-form") || !window.NRStorage || !window.NRValidation) {
      return;
    }

    await window.NRStorage.initDefaultData();
    mountSharedControls();
    state.draftKey = getDraftKey();

    preselectedCategory = getParams().get("categoria");
    await renderCategoryOptions(preselectedCategory || undefined);
    toggleNewCategoryField();
    setPreview("assets/sem-foto.svg");
    setPhotoStatus("", false);
    addListItem("ingredientes-lista", "ingredientes", "");
    addListItem("passos-lista", "passos", "");
    initEvents();
    startDraftAutosave();
    initDelete();

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
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAdmin();
  });
})();
