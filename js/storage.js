(function () {
  var LOCAL_KEYS = {
    recipes: "nr_recipes",
    categories: "nr_categories",
    initialized: "nr_initialized",
    cleanedDefaults: "nr_cleaned_defaults",
    lastSync: "nr_last_sync"
  };

  var LEGACY_DEFAULT_RECIPE_IDS = ["1714000000000", "1714000000100"];
  var MAX_REPOSITORY_BYTES = 950 * 1024;
  var CONFLICT_GROUPS = [
    { key: "titulo", label: "Titulo", fields: ["titulo"] },
    { key: "categoria", label: "Categoria", fields: ["categoriaId", "categoriaNome", "categoriaIcone", "categoriaCor"] },
    { key: "tags", label: "Tags", fields: ["tags"] },
    { key: "tempoPreparo", label: "Tempo de preparo", fields: ["tempoPreparo"] },
    { key: "tempoForno", label: "Tempo de forno", fields: ["tempoForno"] },
    { key: "porcoes", label: "Porcoes", fields: ["porcoes"] },
    { key: "dificuldade", label: "Dificuldade", fields: ["dificuldade"] },
    { key: "foto", label: "Foto", fields: ["foto", "fotoThumb"] },
    { key: "ingredientes", label: "Ingredientes", fields: ["ingredientes"] },
    { key: "modoPreparo", label: "Modo de preparo", fields: ["modoPreparo"] },
    { key: "dica", label: "Dica", fields: ["dica"] }
  ];
  var cache = null;
  var loadingPromise = null;
  var syncState = {
    state: navigator.onLine ? (window.GitHubSync && window.GitHubSync.hasToken() ? "sincronizado" : "sem-token") : "offline",
    message: "",
    lastSyncAt: window.localStorage.getItem(LOCAL_KEYS.lastSync) || "",
    source: "initial"
  };

  function logDiagnostic(entry) {
    if (window.NRDiagnostics) {
      window.NRDiagnostics.log(entry);
    }
  }

  function createStorageError(message, code, details) {
    var error = new Error(message);
    error.code = code || "storage_error";

    if (details && typeof details === "object") {
      Object.keys(details).forEach(function (key) {
        error[key] = details[key];
      });
    }

    return error;
  }

  function defaultCategories() {
    return window.GitHubSync ? window.GitHubSync.getCategoriasIniciais() : [];
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function cloneValue(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    return JSON.parse(JSON.stringify(value));
  }

  function normalizeData(data) {
    var source = data || {};
    var categorias = Array.isArray(source.categorias) && source.categorias.length
      ? source.categorias
      : defaultCategories();

    return {
      receitas: Array.isArray(source.receitas) ? source.receitas : [],
      categorias: categorias
    };
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "categoria";
  }

  function compareDates(a, b) {
    return new Date(a || 0).getTime() - new Date(b || 0).getTime();
  }

  function safeParse(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function emitSyncChanged() {
    window.dispatchEvent(new CustomEvent("nr:sync-changed", {
      detail: getSyncStatus()
    }));
  }

  function setSyncState(nextState) {
    syncState = Object.assign({}, syncState, nextState);
    emitSyncChanged();
  }

  function noteSyncSuccess(source, message) {
    var now = new Date().toISOString();
    window.localStorage.setItem(LOCAL_KEYS.lastSync, now);
    setSyncState({
      state: window.GitHubSync.hasToken() ? "sincronizado" : "sem-token",
      lastSyncAt: now,
      source: source || "github",
      message: message || (window.GitHubSync.hasToken()
        ? "Conteudo atualizado com o GitHub."
        : "Leitura publica atualizada; configure um token para gravar.")
    });
  }

  function getSyncStatus() {
    var state = Object.assign({}, syncState, {
      tokenConfigured: window.GitHubSync && window.GitHubSync.hasToken(),
      repo: window.GitHubSync ? window.GitHubSync.getRepoInfo() : null
    });

    if (!navigator.onLine) {
      state.state = "offline";
      state.message = state.message || (state.lastSyncAt
        ? "Sem conexao; exibindo os dados mais recentes deste dispositivo."
        : "Sem conexao e sem sincronizacao recente.");
      return state;
    }

    if (!state.tokenConfigured && state.state !== "erro") {
      state.state = "sem-token";
      state.message = state.message || "Leitura publica ativa; configure um token para editar e sincronizar.";
    }

    return state;
  }

  function getLocalData() {
    return normalizeData({
      receitas: safeParse(LOCAL_KEYS.recipes, []),
      categorias: safeParse(LOCAL_KEYS.categories, [])
    });
  }

  function getCachedRemoteData() {
    var snapshot = window.GitHubSync && typeof window.GitHubSync.getCachedSnapshot === "function"
      ? window.GitHubSync.getCachedSnapshot()
      : null;

    if (!snapshot || !snapshot.data) {
      return null;
    }

    return {
      data: normalizeData(snapshot.data),
      sha: snapshot.sha || null,
      savedAt: snapshot.savedAt || ""
    };
  }

  function persistLocalData(data) {
    var normalized = normalizeData(data);
    writeJson(LOCAL_KEYS.recipes, normalized.receitas);
    writeJson(LOCAL_KEYS.categories, normalized.categorias);
    window.localStorage.setItem(LOCAL_KEYS.initialized, "true");
  }

  function clearLocalData() {
    window.localStorage.removeItem(LOCAL_KEYS.recipes);
    window.localStorage.removeItem(LOCAL_KEYS.categories);
    window.localStorage.removeItem(LOCAL_KEYS.initialized);
  }

  function clearLegacyDefaultRecipes() {
    if (window.localStorage.getItem(LOCAL_KEYS.cleanedDefaults)) {
      return;
    }

    var receitas = safeParse(LOCAL_KEYS.recipes, []);
    var shouldClear = Array.isArray(receitas) && receitas.length > 0 && receitas.every(function (receita) {
      return LEGACY_DEFAULT_RECIPE_IDS.indexOf(String(receita.id)) !== -1;
    });

    if (shouldClear) {
      clearLocalData();
    }

    window.localStorage.setItem(LOCAL_KEYS.cleanedDefaults, "true");
  }

  function mergeRecipes(localRecipes, githubRecipes) {
    var map = new Map();

    (githubRecipes || []).forEach(function (recipe) {
      map.set(String(recipe.id), recipe);
    });

    (localRecipes || []).forEach(function (localRecipe) {
      var id = String(localRecipe.id);
      var githubRecipe = map.get(id);

      if (!githubRecipe) {
        map.set(id, localRecipe);
        return;
      }

      if (compareDates(localRecipe.atualizadoEm || localRecipe.criadoEm, githubRecipe.atualizadoEm || githubRecipe.criadoEm) > 0) {
        map.set(id, localRecipe);
      }
    });

    return Array.from(map.values());
  }

  function mergeCategories(localCategories, githubCategories) {
    var map = new Map();

    (githubCategories || []).forEach(function (category) {
      map.set(String(category.id), category);
    });

    (localCategories || []).forEach(function (category) {
      if (!map.has(String(category.id))) {
        map.set(String(category.id), category);
      }
    });

    return Array.from(map.values());
  }

  function mergeData(localData, githubData) {
    return {
      receitas: mergeRecipes(localData.receitas, githubData.receitas),
      categorias: mergeCategories(localData.categorias, githubData.categorias)
    };
  }

  function invalidateCache() {
    cache = null;
    loadingPromise = null;
  }

  async function carregar(forceRefresh) {
    var localData;

    clearLegacyDefaultRecipes();

    if (forceRefresh) {
      invalidateCache();
    }

    if (cache) {
      return cache;
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = (async function () {
      localData = getLocalData();

      try {
        var remote = await window.GitHubSync.lerReceitas();
        cache = {
          data: mergeData(localData, remote.data),
          sha: remote.sha
        };
        noteSyncSuccess("github", window.GitHubSync.hasToken()
          ? "Repositorio validado e dados atualizados."
          : "Leitura publica atualizada; configure um token para habilitar escrita.");
      } catch (error) {
        var cachedRemote = getCachedRemoteData();
        var fallbackData = cachedRemote
          ? mergeData(localData, cachedRemote.data)
          : localData;
        var fallbackStatus = navigator.onLine ? (cachedRemote ? "fallback-cache" : "fallback") : (cachedRemote ? "offline-cache" : "offline");

        cache = {
          data: fallbackData,
          sha: cachedRemote ? cachedRemote.sha : null,
          error: error
        };
        logDiagnostic({
          source: "storage",
          kind: "sync",
          status: fallbackStatus,
          message: cachedRemote
            ? "Falha ao sincronizar com o GitHub; exibindo a ultima copia sincronizada deste dispositivo."
            : "Falha ao sincronizar com o GitHub; exibindo dados locais.",
          details: error && error.message ? error.message : ""
        });
        setSyncState({
          state: navigator.onLine ? "erro" : "offline",
          lastSyncAt: cachedRemote && cachedRemote.savedAt ? cachedRemote.savedAt : syncState.lastSyncAt,
          message: navigator.onLine
            ? (cachedRemote
              ? "GitHub indisponivel no momento; exibindo a ultima copia sincronizada deste dispositivo."
              : (error && error.message ? error.message : "Nao foi possivel sincronizar com o GitHub."))
            : (cachedRemote
              ? "Sem conexao; exibindo a ultima copia sincronizada deste dispositivo."
              : "Sem conexao e sem copia sincronizada recente neste dispositivo."),
          source: "local"
        });
      } finally {
        loadingPromise = null;
      }

      return cache;
    })();

    return loadingPromise;
  }

  function normalizeRecipe(recipe) {
    var now = new Date().toISOString();
    var normalizedBase = normalizeConflictRecipe(recipe);

    if (!normalizedBase) {
      normalizedBase = normalizeConflictRecipe({});
    }

    normalizedBase.id = recipe && recipe.id ? String(recipe.id) : String(Date.now());
    normalizedBase.criadoEm = recipe && recipe.criadoEm ? String(recipe.criadoEm) : now;
    normalizedBase.atualizadoEm = now;

    return normalizedBase;
  }

  function normalizeConflictRecipe(recipe) {
    if (!recipe) {
      return null;
    }

    var categoriaNome = String(recipe.categoriaNome || "").trim();
    var categoriaId = slugify(recipe.categoriaId || categoriaNome);

    return {
      id: recipe.id ? String(recipe.id) : "",
      titulo: String(recipe.titulo || "").trim(),
      categoriaId: categoriaId,
      categoriaNome: categoriaNome,
      tags: Array.isArray(recipe.tags) ? recipe.tags.filter(Boolean) : [],
      tempoPreparo: String(recipe.tempoPreparo || "").trim(),
      tempoForno: String(recipe.tempoForno || "").trim(),
      porcoes: Number(recipe.porcoes || 0),
      dificuldade: String(recipe.dificuldade || "Facil"),
      foto: String(recipe.foto || ""),
      fotoThumb: String(recipe.fotoThumb || ""),
      ingredientes: Array.isArray(recipe.ingredientes) ? recipe.ingredientes.filter(Boolean) : [],
      modoPreparo: Array.isArray(recipe.modoPreparo) ? recipe.modoPreparo.filter(Boolean) : [],
      dica: String(recipe.dica || "").trim(),
      criadoEm: recipe.criadoEm ? String(recipe.criadoEm) : "",
      atualizadoEm: recipe.atualizadoEm ? String(recipe.atualizadoEm) : "",
      categoriaIcone: recipe.categoriaIcone || "",
      categoriaCor: recipe.categoriaCor || ""
    };
  }

  function serializeComparableValue(value) {
    return JSON.stringify(value === undefined ? null : value);
  }

  function valuesEqual(a, b) {
    return serializeComparableValue(a) === serializeComparableValue(b);
  }

  function getGroupValue(recipe, group) {
    if (!recipe) {
      return null;
    }

    if (group.fields.length === 1) {
      return cloneValue(recipe[group.fields[0]]);
    }

    return group.fields.reduce(function (accumulator, field) {
      accumulator[field] = cloneValue(recipe[field]);
      return accumulator;
    }, {});
  }

  function applyGroupValue(target, group, recipe) {
    if (!target || !recipe) {
      return;
    }

    group.fields.forEach(function (field) {
      target[field] = cloneValue(recipe[field]);
    });
  }

  function compareRecipeVersions(baseRecipe, localRecipe, remoteRecipe, preferredSide) {
    var base = normalizeConflictRecipe(baseRecipe);
    var local = normalizeConflictRecipe(localRecipe) || normalizeConflictRecipe({});
    var remote = normalizeConflictRecipe(remoteRecipe);
    var side = preferredSide === "remote" ? "remote" : "local";

    if (!base || !base.id) {
      return {
        hasConflict: false,
        deletedRemotely: false,
        conflicts: [],
        baseRecipe: base,
        localRecipe: local,
        remoteRecipe: remote,
        mergedRecipe: normalizeConflictRecipe(local)
      };
    }

    if (!remote) {
      return {
        hasConflict: true,
        deletedRemotely: true,
        conflicts: [{
          key: "receita",
          label: "Receita",
          base: base.titulo || "Receita existente",
          local: local.titulo || "Sua versao atual",
          remote: "Receita removida no GitHub."
        }],
        baseRecipe: base,
        localRecipe: local,
        remoteRecipe: null,
        mergedRecipe: side === "remote" ? null : normalizeConflictRecipe(local)
      };
    }

    var merged = normalizeConflictRecipe(remote);
    var conflicts = [];

    CONFLICT_GROUPS.forEach(function (group) {
      var baseValue = getGroupValue(base, group);
      var localValue = getGroupValue(local, group);
      var remoteValue = getGroupValue(remote, group);
      var localChanged = !valuesEqual(localValue, baseValue);
      var remoteChanged = !valuesEqual(remoteValue, baseValue);

      if (localChanged && remoteChanged && !valuesEqual(localValue, remoteValue)) {
        conflicts.push({
          key: group.key,
          label: group.label,
          base: baseValue,
          local: localValue,
          remote: remoteValue
        });
        applyGroupValue(merged, group, side === "remote" ? remote : local);
        return;
      }

      if (localChanged) {
        applyGroupValue(merged, group, local);
        return;
      }

      if (remoteChanged) {
        applyGroupValue(merged, group, remote);
        return;
      }

      applyGroupValue(merged, group, base);
    });

    merged.id = local.id || remote.id || base.id || "";
    merged.criadoEm = base.criadoEm || remote.criadoEm || local.criadoEm || "";
    merged.atualizadoEm = remote.atualizadoEm || local.atualizadoEm || base.atualizadoEm || "";

    return {
      hasConflict: conflicts.length > 0,
      deletedRemotely: false,
      conflicts: conflicts,
      baseRecipe: base,
      localRecipe: local,
      remoteRecipe: remote,
      mergedRecipe: merged
    };
  }

  function buildConflictSignature(conflictState) {
    return JSON.stringify({
      id: conflictState && conflictState.localRecipe ? conflictState.localRecipe.id : "",
      deletedRemotely: Boolean(conflictState && conflictState.deletedRemotely),
      conflicts: (conflictState && conflictState.conflicts || []).map(function (conflict) {
        return {
          key: conflict.key,
          base: conflict.base,
          local: conflict.local,
          remote: conflict.remote
        };
      })
    });
  }

  function resolveConflictChoice(conflictState, choice) {
    var preferredSide = choice === "remote" ? "remote" : "local";

    if (!conflictState) {
      return null;
    }

    if (conflictState.deletedRemotely) {
      return preferredSide === "remote"
        ? null
        : normalizeConflictRecipe(conflictState.localRecipe);
    }

    return compareRecipeVersions(
      conflictState.baseRecipe,
      conflictState.localRecipe,
      conflictState.remoteRecipe,
      preferredSide
    ).mergedRecipe;
  }

  function ensureCategory(data, recipe) {
    var categoriaId = String(recipe.categoriaId || "");
    var categoriaNome = String(recipe.categoriaNome || "").trim();

    if (!categoriaId) {
      return;
    }

    if (data.categorias.some(function (category) { return category.id === categoriaId; })) {
      return;
    }

    data.categorias.push({
      id: categoriaId,
      nome: categoriaNome || categoriaId,
      icone: recipe.categoriaIcone || "🍽️",
      cor: recipe.categoriaCor || "#C4845A"
    });
  }

  function upsertRecipe(data, recipe) {
    var index = data.receitas.findIndex(function (item) {
      return String(item.id) === String(recipe.id);
    });

    if (index >= 0) {
      data.receitas[index] = recipe;
    } else {
      data.receitas.push(recipe);
    }
  }

  function validateRepositorySize(data) {
    var bytes = new Blob([JSON.stringify(data)]).size;

    if (bytes > MAX_REPOSITORY_BYTES) {
      throw new Error("O arquivo de receitas ficou grande demais para o GitHub. Reduza fotos antigas e tente novamente.");
    }
  }

  function estimateRecipeSize(recipe) {
    return new Blob([JSON.stringify(recipe || {})]).size;
  }

  function findRecipeInData(data, id) {
    if (!data || !Array.isArray(data.receitas)) {
      return null;
    }

    return data.receitas.find(function (recipe) {
      return String(recipe.id) === String(id);
    }) || null;
  }

  async function prepareRecipeForSave(localRecipe, baseSnapshot, remoteData, options) {
    var normalizedLocal = normalizeRecipe(localRecipe);
    var normalizedBase = normalizeConflictRecipe(baseSnapshot);
    var remoteRecipe = normalizedLocal.id ? findRecipeInData(remoteData, normalizedLocal.id) : null;

    if (!normalizedBase || !normalizedBase.id) {
      return normalizedLocal;
    }

    var comparison = compareRecipeVersions(normalizedBase, normalizedLocal, remoteRecipe);

    if (!comparison.hasConflict) {
      return normalizeRecipe(Object.assign({}, comparison.mergedRecipe, {
        id: normalizedLocal.id,
        criadoEm: comparison.mergedRecipe && comparison.mergedRecipe.criadoEm
          ? comparison.mergedRecipe.criadoEm
          : normalizedLocal.criadoEm
      }));
    }

    logDiagnostic({
      source: "storage",
      kind: "conflict",
      status: "detected",
      message: comparison.deletedRemotely
        ? "A receita foi removida em outro dispositivo durante a edicao."
        : "Conflito detectado com outra edicao desta receita.",
      details: comparison.conflicts.map(function (conflict) {
        return conflict.label;
      }).join(", ")
    });

    var saveOptions = options || {};
    var conflictSelections = saveOptions.conflictSelections || (saveOptions.conflictSelections = {});
    var signature = buildConflictSignature(comparison);
    var resolution = conflictSelections[signature];

    if (!resolution) {
      if (typeof saveOptions.conflictResolver !== "function") {
        throw createStorageError("Conflito detectado ao salvar esta receita.", "conflict_detected", {
          conflict: comparison
        });
      }

      resolution = await saveOptions.conflictResolver(comparison);

      if (!resolution || resolution.choice === "cancel") {
        throw createStorageError("Salvamento cancelado para revisar o conflito.", "conflict_cancelled", {
          conflict: comparison
        });
      }

      conflictSelections[signature] = resolution;
    }

    var resolvedRecipe = resolveConflictChoice(comparison, resolution.choice);

    if (!resolvedRecipe) {
      throw createStorageError("A versao remota removeu esta receita. Nenhuma alteracao foi gravada.", "remote_deleted", {
        conflict: comparison
      });
    }

    logDiagnostic({
      source: "storage",
      kind: "conflict",
      status: "resolved",
      message: resolution.choice === "remote"
        ? "Conflito resolvido priorizando a versao remota."
        : "Conflito resolvido priorizando suas mudancas locais.",
      details: comparison.conflicts.map(function (conflict) {
        return conflict.label;
      }).join(", ")
    });

    return normalizeRecipe(Object.assign({}, resolvedRecipe, {
      id: normalizedLocal.id,
      criadoEm: resolvedRecipe.criadoEm || normalizedLocal.criadoEm
    }));
  }

  function removeLocalRecipe(id) {
    var localData = getLocalData();
    var nextData = {
      receitas: localData.receitas.filter(function (recipe) {
        return String(recipe.id) !== String(id);
      }),
      categorias: localData.categorias
    };

    if (nextData.receitas.length) {
      persistLocalData(nextData);
    } else {
      clearLocalData();
    }
  }

  async function getAllRecipes() {
    var loaded = await carregar();
    return loaded.data.receitas.slice();
  }

  async function getRecipeById(id) {
    var receitas = await getAllRecipes();
    return receitas.find(function (recipe) {
      return String(recipe.id) === String(id);
    }) || null;
  }

  async function getRecipesByCategory(categoryId) {
    var receitas = await getAllRecipes();
    return receitas.filter(function (recipe) {
      return recipe.categoriaId === categoryId;
    });
  }

  async function getCategories() {
    var loaded = await carregar();
    return loaded.data.categorias.map(function (category) {
      return Object.assign({}, category, {
        totalReceitas: loaded.data.receitas.filter(function (recipe) {
          return recipe.categoriaId === category.id;
        }).length
      });
    });
  }

  async function getCategoryById(categoryId) {
    var categorias = await getCategories();
    return categorias.find(function (category) {
      return category.id === categoryId;
    }) || null;
  }

  async function getSpaceReport() {
    var loaded = await carregar();
    var totalBytes = new Blob([JSON.stringify(normalizeData(loaded.data))]).size;
    var recipes = loaded.data.receitas
      .map(function (recipe) {
        return {
          id: recipe.id,
          titulo: recipe.titulo,
          bytes: estimateRecipeSize(recipe),
          hasPhoto: Boolean(recipe.foto)
        };
      })
      .sort(function (a, b) {
        return b.bytes - a.bytes;
      });

    return {
      maxBytes: MAX_REPOSITORY_BYTES,
      totalBytes: totalBytes,
      percentUsed: Math.min(100, Math.round((totalBytes / MAX_REPOSITORY_BYTES) * 100)),
      threshold: totalBytes >= MAX_REPOSITORY_BYTES * 0.95
        ? "critical"
        : totalBytes >= MAX_REPOSITORY_BYTES * 0.8
          ? "warning"
          : totalBytes >= MAX_REPOSITORY_BYTES * 0.6
            ? "attention"
            : "ok",
      recipes: recipes
    };
  }

  async function saveRecipe(recipe, options) {
    var baseSnapshot = recipe && recipe._lastSyncedSnapshot
      ? normalizeConflictRecipe(recipe._lastSyncedSnapshot)
      : null;
    var normalized = normalizeRecipe(recipe);
    var saveOptions = options || {};

    if (window.GitHubSync.hasToken()) {
      var current = await window.GitHubSync.lerReceitas();
      var recipeToPersist = await prepareRecipeForSave(normalized, baseSnapshot, current.data, saveOptions);
      var nextData = cloneData(current.data);

      ensureCategory(nextData, recipeToPersist);
      upsertRecipe(nextData, recipeToPersist);
      validateRepositorySize(nextData);

      await window.GitHubSync.salvarComRetry(
        nextData,
        current.sha,
        (recipe.id ? "Atualiza receita: " : "Adiciona receita: ") + recipeToPersist.titulo,
        async function (latestData) {
          var retryRecipe = await prepareRecipeForSave(recipeToPersist, baseSnapshot, latestData, saveOptions);
          ensureCategory(latestData, retryRecipe);
          upsertRecipe(latestData, retryRecipe);
          validateRepositorySize(latestData);
          return latestData;
        }
      );

      removeLocalRecipe(recipeToPersist.id);
      invalidateCache();
      noteSyncSuccess("github", "Alteracao sincronizada com sucesso.");
      return Object.assign({}, recipeToPersist, {
        _lastSyncedSnapshot: normalizeConflictRecipe(recipeToPersist)
      });
    }

    var localData = getLocalData();
    ensureCategory(localData, normalized);
    upsertRecipe(localData, normalized);
    persistLocalData(localData);
    invalidateCache();
    logDiagnostic({
      source: "storage",
      kind: "write",
      status: "local",
      message: "Receita salva apenas neste navegador.",
      details: normalized.titulo
    });
    setSyncState({
      state: "sem-token",
      message: "Receita salva neste navegador. Configure um token para sincronizar com outros dispositivos.",
      source: "local"
    });
    return normalized;
  }

  async function deleteRecipe(id) {
    var recipeId = String(id);
    var localData = getLocalData();
    var hasLocalRecipe = localData.receitas.some(function (recipe) {
      return String(recipe.id) === recipeId;
    });

    if (!window.GitHubSync.hasToken()) {
      if (!hasLocalRecipe) {
        throw new Error("Configure um token GitHub para excluir receitas sincronizadas.");
      }

      localData.receitas = localData.receitas.filter(function (recipe) {
        return String(recipe.id) !== recipeId;
      });

      if (localData.receitas.length) {
        persistLocalData(localData);
      } else {
        clearLocalData();
      }

      invalidateCache();
      logDiagnostic({
        source: "storage",
        kind: "delete",
        status: "local",
        message: "Receita excluida apenas neste navegador.",
        details: recipeId
      });
      setSyncState({
        state: "sem-token",
        message: "Receita excluida apenas deste navegador.",
        source: "local"
      });
      return;
    }

    var remote = await window.GitHubSync.lerReceitas();
    var nextData = cloneData(remote.data);
    var hadRemoteRecipe = nextData.receitas.some(function (recipe) {
      return String(recipe.id) === recipeId;
    });

    if (!hadRemoteRecipe && !hasLocalRecipe) {
      throw new Error("Receita nao encontrada.");
    }

    if (hadRemoteRecipe) {
      nextData.receitas = nextData.receitas.filter(function (recipe) {
        return String(recipe.id) !== recipeId;
      });
      validateRepositorySize(nextData);

      await window.GitHubSync.salvarComRetry(
        nextData,
        remote.sha,
        "Remove receita",
        function (latestData) {
          latestData.receitas = latestData.receitas.filter(function (recipe) {
            return String(recipe.id) !== recipeId;
          });
          validateRepositorySize(latestData);
          return latestData;
        }
      );
    }

    if (hasLocalRecipe) {
      removeLocalRecipe(recipeId);
    }

    invalidateCache();
    noteSyncSuccess("github", "Receita removida e sincronizada.");
  }

  async function refreshSync() {
    invalidateCache();
    return carregar(true);
  }

  async function initDefaultData() {
    clearLegacyDefaultRecipes();
    setSyncState(getSyncStatus());
  }

  window.NRStorage = {
    getAllRecipes: getAllRecipes,
    getRecipeById: getRecipeById,
    getRecipesByCategory: getRecipesByCategory,
    getCategories: getCategories,
    getCategoryById: getCategoryById,
    getSpaceReport: getSpaceReport,
    getSyncStatus: getSyncStatus,
    saveRecipe: saveRecipe,
    deleteRecipe: deleteRecipe,
    refreshSync: refreshSync,
    initDefaultData: initDefaultData,
    slugify: slugify,
    captureConflictSnapshot: normalizeConflictRecipe,
    clearLocalData: clearLocalData,
    estimateRecipeSize: estimateRecipeSize,
    __private: {
      normalizeData: normalizeData,
      compareDates: compareDates,
      mergeRecipes: mergeRecipes,
      mergeCategories: mergeCategories,
      mergeData: mergeData,
      normalizeRecipe: normalizeRecipe,
      normalizeConflictRecipe: normalizeConflictRecipe,
      compareRecipeVersions: compareRecipeVersions,
      buildConflictSignature: buildConflictSignature,
      resolveConflictChoice: resolveConflictChoice,
      prepareRecipeForSave: prepareRecipeForSave,
      validateRepositorySize: validateRepositorySize
    }
  };
})();
