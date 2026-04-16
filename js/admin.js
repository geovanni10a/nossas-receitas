(function () {
  var state = {
    recipeId: null,
    tags: [],
    photoData: "",
    draggingKey: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function queryError(name) {
    return document.querySelector('[data-erro="' + name + '"]');
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function createOption(value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function renderCategoryOptions(selectedValue) {
    var select = byId("categoria");
    var categories = window.NRStorage.getCategories();
    select.innerHTML = "";
    categories.forEach(function (category) {
      select.appendChild(createOption(category.id, category.nome));
    });
    select.appendChild(createOption("__new__", "Nova categoria..."));
    select.value = selectedValue || categories[0].id;
  }

  function toggleNewCategoryField() {
    byId("nova-categoria-shell").hidden = byId("categoria").value !== "__new__";
  }

  function setPreview(src) {
    byId("preview-foto").src = src || "assets/sem-foto.svg";
  }

  function renderTags() {
    var container = byId("tags-lista");
    container.innerHTML = "";

    state.tags.forEach(function (tag, index) {
      var chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML = '<span>#' + tag + '</span><button type="button" aria-label="Remover tag">x</button>';
      chip.querySelector("button").addEventListener("click", function () {
        state.tags.splice(index, 1);
        renderTags();
      });
      container.appendChild(chip);
    });
  }

  function addTag(rawTag) {
    var tag = String(rawTag || "").trim().replace(/^#/, "");
    if (!tag || state.tags.indexOf(tag) !== -1) {
      return;
    }
    state.tags.push(tag);
    renderTags();
  }

  function createListItem(type, value) {
    var wrapper = document.createElement("div");
    wrapper.className = "lista-item";
    wrapper.draggable = true;
    wrapper.dataset.type = type;
    wrapper.innerHTML = '<span class="drag-handle" aria-hidden="true">::</span><input type="text" value="' + String(value || "").replace(/"/g, "&quot;") + '" placeholder="' + (type === "ingredientes" ? "Ex: 2 ovos" : "Descreva o passo") + '"><button class="remover-item" type="button" aria-label="Remover item">x</button>';

    wrapper.addEventListener("dragstart", function () {
      state.draggingKey = wrapper;
      wrapper.classList.add("is-dragging");
    });

    wrapper.addEventListener("dragend", function () {
      wrapper.classList.remove("is-dragging");
      state.draggingKey = null;
    });

    wrapper.addEventListener("dragover", function (event) {
      event.preventDefault();
    });

    wrapper.addEventListener("drop", function (event) {
      event.preventDefault();
      if (!state.draggingKey || state.draggingKey === wrapper) {
        return;
      }
      wrapper.parentNode.insertBefore(state.draggingKey, wrapper);
    });

    wrapper.querySelector(".remover-item").addEventListener("click", function () {
      wrapper.remove();
    });

    return wrapper;
  }

  function addListItem(listId, type, value) {
    byId(listId).appendChild(createListItem(type, value));
  }

  function getListValues(listId) {
    return Array.prototype.slice.call(byId(listId).querySelectorAll("input"))
      .map(function (input) { return input.value.trim(); })
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
    clearErrors();
    var isValid = true;
    var title = byId("titulo");
    var category = byId("categoria");
    var newCategory = byId("nova-categoria");
    var ingredients = getListValues("ingredientes-lista");
    var steps = getListValues("passos-lista");

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

    return isValid;
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function recipePayload() {
    var categoryValue = byId("categoria").value;
    var categoryName = categoryValue === "__new__"
      ? byId("nova-categoria").value.trim()
      : window.NRStorage.getCategoryById(categoryValue).nome;

    return {
      id: state.recipeId,
      titulo: byId("titulo").value.trim(),
      categoriaId: categoryValue === "__new__" ? categoryName : categoryValue,
      categoriaNome: categoryName,
      tags: state.tags.slice(),
      tempoPreparo: byId("tempo-preparo").value.trim(),
      tempoForno: byId("tempo-forno").value.trim(),
      porcoes: byId("porcoes").value ? Number(byId("porcoes").value) : 0,
      dificuldade: byId("dificuldade").value,
      foto: state.photoData,
      ingredientes: getListValues("ingredientes-lista"),
      modoPreparo: getListValues("passos-lista"),
      dica: byId("dica").value.trim()
    };
  }

  function fillForm(recipe) {
    state.recipeId = recipe.id;
    state.tags = recipe.tags.slice();
    state.photoData = recipe.foto || "";
    byId("admin-titulo").textContent = "Editar receita";
    byId("titulo").value = recipe.titulo;
    renderCategoryOptions(recipe.categoriaId);
    byId("tempo-preparo").value = recipe.tempoPreparo;
    byId("tempo-forno").value = recipe.tempoForno;
    byId("porcoes").value = recipe.porcoes || "";
    byId("dificuldade").value = recipe.dificuldade;
    byId("dica").value = recipe.dica;
    setPreview(recipe.foto || "assets/sem-foto.svg");
    renderTags();
    byId("ingredientes-lista").innerHTML = "";
    byId("passos-lista").innerHTML = "";
    recipe.ingredientes.forEach(function (item) { addListItem("ingredientes-lista", "ingredientes", item); });
    recipe.modoPreparo.forEach(function (item) { addListItem("passos-lista", "passos", item); });
    byId("delete-recipe").hidden = false;
  }

  function initDelete() {
    byId("delete-recipe").addEventListener("click", function () {
      if (!state.recipeId) {
        return;
      }
      if (window.confirm("Tem certeza que deseja excluir esta receita?")) {
        window.NRStorage.deleteRecipe(state.recipeId);
        window.location.href = "livro.html";
      }
    });
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

    byId("foto").addEventListener("change", function (event) {
      clearErrors();
      var file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }

      readFileAsBase64(file).then(function (data) {
        if (new Blob([data]).size > 1572864) {
          showError("foto", "A foto e muito grande. Redimensione para menos de 1MB e tente novamente.", byId("foto"));
          event.target.value = "";
          return;
        }
        state.photoData = data;
        setPreview(data);
      }).catch(function () {
        showError("foto", "Nao foi possivel carregar a imagem.", byId("foto"));
      });
    });

    byId("recipe-form").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateForm()) {
        return;
      }

      try {
        var saved = window.NRStorage.saveRecipe(recipePayload());
        var toast = byId("toast");
        toast.hidden = false;
        toast.textContent = "Receita salva com sucesso! OK";
        window.setTimeout(function () {
          window.location.href = "livro.html?receita=" + saved.id + "&categoria=" + saved.categoriaId;
        }, 2000);
      } catch (error) {
        showError("foto", error.message || "Nao foi possivel salvar a receita.");
      }
    });
  }

  function initAdmin() {
    if (!document.getElementById("recipe-form") || !window.NRStorage) {
      return;
    }

    window.NRStorage.initDefaultData();
    renderCategoryOptions();
    toggleNewCategoryField();
    setPreview("assets/sem-foto.svg");
    addListItem("ingredientes-lista", "ingredientes", "");
    addListItem("passos-lista", "passos", "");
    initEvents();
    initDelete();

    var recipeId = getParams().get("id");
    if (recipeId) {
      var recipe = window.NRStorage.getRecipeById(recipeId);
      if (!recipe) {
        window.location.href = "livro.html?mensagem=" + encodeURIComponent("Receita nao encontrada.");
        return;
      }
      fillForm(recipe);
    }
  }

  document.addEventListener("DOMContentLoaded", initAdmin);
})();
