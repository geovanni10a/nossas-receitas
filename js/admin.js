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

  function updateSaveButtonLabel() {
    var button = byId("btn-salvar-receita");

    if (!button) {
      return;
    }

    if (window.GitHubSync.hasToken()) {
      button.textContent = "Salvar e sincronizar";
      return;
    }

    button.textContent = "Salvar neste navegador";
  }

  function refreshTokenUI(message, tone) {
    var tokenField = byId("campo-token");

    if (tokenField) {
      tokenField.value = window.GitHubSync.getToken();
    }

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

  function resizarFotoParaQuadrado(file, targetSize) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onload = function (event) {
        var img = new Image();

        img.onload = function () {
          var menorLado = Math.min(img.width, img.height);
          var origemX = (img.width - menorLado) / 2;
          var origemY = (img.height - menorLado) / 2;
          var canvas = document.createElement("canvas");
          var ctx = canvas.getContext("2d");
          var tamanhoAtual = targetSize || PHOTO_TARGET_SIZE;

          if (!ctx) {
            reject(new Error("Nao foi possivel preparar a foto."));
            return;
          }

          while (tamanhoAtual >= PHOTO_MIN_SIZE) {
            var qualidadeAtual = 0.85;

            canvas.width = tamanhoAtual;
            canvas.height = tamanhoAtual;
            drawSquareImage(ctx, img, origemX, origemY, menorLado, tamanhoAtual);

            while (qualidadeAtual >= 0.55) {
              var base64 = canvas.toDataURL("image/jpeg", qualidadeAtual);

              if (getDataUrlByteSize(base64) <= PHOTO_LIMIT_BYTES) {
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

        img.src = event.target.result;
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

    if (!token) {
      setTokenStatus("Cole um token antes de salvar.", "erro");
      return;
    }

    setTokenStatus("Validando token e lendo o arquivo remoto...", "aviso");

    try {
      window.GitHubSync.setToken(token);
      await window.GitHubSync.lerReceitas();
      refreshTokenUI("Token salvo com sucesso. Sincronizacao ativa.", "ok");

      if (window.Migration) {
        window.Migration.verificarEMigrar(byId("container-migracao"));
      }
    } catch (error) {
      window.GitHubSync.clearToken();
      refreshTokenUI(error.message || "Nao foi possivel validar o token.", "erro");
    }
  }

  function handleTokenClear() {
    window.GitHubSync.clearToken();
    refreshTokenUI("Token removido. O painel voltou ao modo local.", "aviso");
    byId("container-migracao").innerHTML = "";
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
    byId("btn-limpar-token").addEventListener("click", handleTokenClear);

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

    if (!document.getElementById("recipe-form") || !window.NRStorage || !window.GitHubSync) {
      return;
    }

    await window.NRStorage.initDefaultData();
    await renderCategoryOptions();
    toggleNewCategoryField();
    setPreview("assets/sem-foto.svg");
    setPhotoStatus("", false);
    refreshTokenUI();
    addListItem("ingredientes-lista", "ingredientes", "");
    addListItem("passos-lista", "passos", "");
    initEvents();
    initDelete();

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
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAdmin();
  });
})();
