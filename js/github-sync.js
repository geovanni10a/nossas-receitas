(function () {
  var DEFAULT_OWNER = "geovanni10a";
  var DEFAULT_REPO = "nossas-receitas";
  var DEFAULT_BRANCH = "main";
  var FILE_PATH = "data/receitas.json";
  var TOKEN_KEY = "nr_github_token";
  var REPO_OVERRIDE_KEY = "nr_repo_override";
  var CACHE_KEY_PREFIX = "nr_github_cache:";

  function categoriasIniciais() {
    return [
      { id: "doces", nome: "Doces & Sobremesas", icone: "🍰", cor: "#C4845A" },
      { id: "massas", nome: "Massas & Graos", icone: "🍝", cor: "#A0522D" },
      { id: "carnes", nome: "Carnes & Aves", icone: "🥩", cor: "#8B4513" },
      { id: "saladas", nome: "Saladas & Entradas", icone: "🥗", cor: "#6B7C5C" },
      { id: "bebidas", nome: "Bebidas", icone: "🥤", cor: "#7B9EA6" },
      { id: "vegetariano", nome: "Vegetariano & Vegano", icone: "🌿", cor: "#5A7A4A" },
      { id: "especiais", nome: "Especiais & Festas", icone: "🎄", cor: "#9B4B6B" }
    ];
  }

  function dadosIniciais() {
    return {
      receitas: [],
      categorias: categoriasIniciais()
    };
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function normalizeData(data) {
    var source = data || {};
    var categorias = Array.isArray(source.categorias) && source.categorias.length
      ? source.categorias
      : categoriasIniciais();

    return {
      receitas: Array.isArray(source.receitas) ? source.receitas : [],
      categorias: categorias
    };
  }

  function sanitizeRepoPart(value, fallback) {
    var normalized = String(value || "")
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.git$/i, "");

    return normalized || fallback;
  }

  function inferRepoInfo() {
    var host = String(window.location.hostname || "").toLowerCase();
    var pathParts = String(window.location.pathname || "")
      .split("/")
      .filter(Boolean);
    var ownerMatch = host.match(/^([a-z0-9-]+)\.github\.io$/i);
    var inferredRepo = pathParts[0] && pathParts[0].indexOf(".") === -1 ? pathParts[0] : DEFAULT_REPO;

    return {
      owner: ownerMatch ? sanitizeRepoPart(ownerMatch[1], DEFAULT_OWNER) : DEFAULT_OWNER,
      repo: sanitizeRepoPart(inferredRepo, DEFAULT_REPO),
      branch: DEFAULT_BRANCH,
      filePath: FILE_PATH,
      source: ownerMatch ? "pages" : "default"
    };
  }

  function getRepoOverride() {
    try {
      var raw = window.localStorage.getItem(REPO_OVERRIDE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function setRepoOverride(config) {
    var owner = sanitizeRepoPart(config && config.owner, "");
    var repo = sanitizeRepoPart(config && config.repo, "");
    var branch = sanitizeRepoPart(config && config.branch, DEFAULT_BRANCH);

    if (!owner || !repo) {
      window.localStorage.removeItem(REPO_OVERRIDE_KEY);
      return null;
    }

    window.localStorage.setItem(REPO_OVERRIDE_KEY, JSON.stringify({
      owner: owner,
      repo: repo,
      branch: branch
    }));

    return getRepoInfo();
  }

  function clearRepoOverride() {
    window.localStorage.removeItem(REPO_OVERRIDE_KEY);
  }

  function getRepoInfo() {
    var inferred = inferRepoInfo();
    var override = getRepoOverride();

    if (!override) {
      return inferred;
    }

    return {
      owner: sanitizeRepoPart(override.owner, inferred.owner),
      repo: sanitizeRepoPart(override.repo, inferred.repo),
      branch: sanitizeRepoPart(override.branch, inferred.branch),
      filePath: FILE_PATH,
      source: "override"
    };
  }

  function getApiUrl() {
    var repoInfo = getRepoInfo();
    return "https://api.github.com/repos/" + repoInfo.owner + "/" + repoInfo.repo + "/contents/" + repoInfo.filePath;
  }

  function logDiagnostic(entry) {
    if (window.NRDiagnostics) {
      window.NRDiagnostics.log(entry);
    }
  }

  function getCacheStorageKey(repoInfo) {
    var target = repoInfo || getRepoInfo();
    return CACHE_KEY_PREFIX + [target.owner, target.repo, target.branch, target.filePath].join("/");
  }

  function getToken() {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    window.localStorage.setItem(TOKEN_KEY, String(token || "").trim());
  }

  function hasToken() {
    return Boolean(getToken());
  }

  function clearToken() {
    window.localStorage.removeItem(TOKEN_KEY);
  }

  function buildHeaders(includeToken) {
    var headers = {
      Accept: "application/vnd.github+json"
    };

    if (includeToken && hasToken()) {
      headers.Authorization = "Bearer " + getToken();
    }

    return headers;
  }

  function safeJson(response) {
    return response.json().catch(function () {
      return {};
    });
  }

  function readCachedSnapshot(repoInfo) {
    try {
      var raw = window.localStorage.getItem(getCacheStorageKey(repoInfo));

      if (!raw) {
        return null;
      }

      var parsed = JSON.parse(raw);

      if (!parsed || !parsed.data) {
        return null;
      }

      return {
        etag: String(parsed.etag || ""),
        sha: parsed.sha || null,
        savedAt: String(parsed.savedAt || ""),
        data: normalizeData(parsed.data)
      };
    } catch (error) {
      return null;
    }
  }

  function writeCachedSnapshot(repoInfo, snapshot) {
    try {
      window.localStorage.setItem(getCacheStorageKey(repoInfo), JSON.stringify({
        etag: String(snapshot && snapshot.etag || ""),
        sha: snapshot && snapshot.sha ? String(snapshot.sha) : null,
        savedAt: new Date().toISOString(),
        data: normalizeData(snapshot && snapshot.data)
      }));
    } catch (error) {
      // Ignora falhas de cache para nao interromper a leitura principal.
    }
  }

  function utf8ToBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var chunkSize = 32768;
    var binary = "";
    var index = 0;

    while (index < bytes.length) {
      binary += String.fromCharCode.apply(null, bytes.slice(index, index + chunkSize));
      index += chunkSize;
    }

    return window.btoa(binary);
  }

  function base64ToUtf8(base64) {
    var binary = window.atob(base64);
    var bytes = new Uint8Array(binary.length);
    var index = 0;

    while (index < binary.length) {
      bytes[index] = binary.charCodeAt(index);
      index += 1;
    }

    return new TextDecoder().decode(bytes);
  }

  function createError(message, status, code, details) {
    var error = new Error(message);
    error.status = status || 0;
    error.code = code || "github_error";

    if (details && typeof details === "object") {
      Object.keys(details).forEach(function (key) {
        error[key] = details[key];
      });
    }

    return error;
  }

  function getRateLimitResetMs(headers, nowMs) {
    var retryAfter = Number(headers && headers.get && headers.get("Retry-After") || 0);
    var resetAt = Number(headers && headers.get && headers.get("X-RateLimit-Reset") || 0);
    var currentTime = typeof nowMs === "number" ? nowMs : Date.now();

    if (retryAfter > 0) {
      return retryAfter * 1000;
    }

    if (resetAt > 0) {
      return Math.max(0, (resetAt * 1000) - currentTime);
    }

    return 0;
  }

  function formatRetryDelay(ms) {
    var safeMs = Math.max(0, Number(ms || 0));

    if (!safeMs) {
      return "alguns instantes";
    }

    if (safeMs < 60000) {
      return Math.max(1, Math.ceil(safeMs / 1000)) + "s";
    }

    if (safeMs < 3600000) {
      return Math.max(1, Math.ceil(safeMs / 60000)) + " min";
    }

    return Math.max(1, Math.ceil(safeMs / 3600000)) + " h";
  }

  function isRateLimitResponse(status, payload) {
    var message = payload && payload.message ? String(payload.message).toLowerCase() : "";
    return status === 429 || (status === 403 && message.indexOf("rate limit") !== -1);
  }

  function buildRateLimitMessage(headers, fallback) {
    var retryAfterMs = getRateLimitResetMs(headers);
    var message = fallback || "Limite de requisicoes da API atingido.";

    if (retryAfterMs > 0) {
      message += " Tente novamente em cerca de " + formatRetryDelay(retryAfterMs) + ".";
    }

    return {
      message: message,
      retryAfterMs: retryAfterMs
    };
  }

  function buildReadError(status, payload, headers) {
    var message = payload && payload.message ? payload.message : "";

    if (status === 401) {
      return createError("Token invalido ou expirado. Gere outro token e tente novamente.", status, "invalid_token");
    }

    if (isRateLimitResponse(status, payload)) {
      var rateLimit = buildRateLimitMessage(headers, "Limite de requisicoes da API atingido.");
      return createError(
        rateLimit.message + " Configure um token GitHub no painel admin para ganhar mais folga.",
        status,
        "rate_limit",
        { retryAfterMs: rateLimit.retryAfterMs }
      );
    }

    if (status === 403) {
      return createError("O token nao tem permissao para ler este repositorio. Revise o owner/repo e as permissoes.", status, "forbidden");
    }

    if (status === 404) {
      return createError("Repositorio, branch ou arquivo de receitas nao encontrado. Revise owner, repo e branch no wizard.", status, "repo_not_found");
    }

    return createError("Erro ao ler receitas do GitHub: " + status + " - " + (message || "falha desconhecida"), status, "read_failed");
  }

  function buildWriteError(status, payload, headers) {
    var message = payload && payload.message ? payload.message : "";

    if (status === 401) {
      return createError("Token invalido ou expirado. Gere outro token e tente novamente.", status, "invalid_token");
    }

    if (isRateLimitResponse(status, payload)) {
      var rateLimit = buildRateLimitMessage(headers, "Limite de requisicoes da API atingido.");
      return createError(rateLimit.message, status, "rate_limit", {
        retryAfterMs: rateLimit.retryAfterMs
      });
    }

    if (status === 403) {
      return createError("O token nao tem permissao de escrita neste repositorio. Confira se ele pode editar o conteudo.", status, "write_forbidden");
    }

    if (status === 404) {
      return createError("Repositorio, branch ou arquivo de receitas nao encontrado para gravacao.", status, "repo_not_found");
    }

    return createError("Erro ao salvar no GitHub: " + status + " - " + (message || "falha desconhecida"), status, "write_failed");
  }

  function wait(delayMs) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, Math.max(0, Number(delayMs || 0)));
    });
  }

  function shouldRetryWrite(error) {
    var status = Number(error && error.status || 0);
    var code = String(error && error.code || "");

    return status === 409
      || status === 422
      || code === "rate_limit"
      || status === 429
      || status === 500
      || status === 502
      || status === 503
      || status === 504;
  }

  function getRetryDelay(attemptNumber, error, randomFn) {
    var jitterSource = typeof randomFn === "function" ? randomFn : Math.random;
    var baseDelay = 100 * Math.pow(2, Math.max(0, Number(attemptNumber || 1) - 1));
    var jitter = Math.round(jitterSource() * 100);
    var retryAfterMs = Math.max(0, Number(error && error.retryAfterMs || 0));

    return Math.max(baseDelay + jitter, retryAfterMs);
  }

  async function lerReceitas() {
    var repoInfo = getRepoInfo();
    var url = getApiUrl() + "?ref=" + encodeURIComponent(repoInfo.branch) + "&t=" + Date.now();
    var cachedSnapshot = readCachedSnapshot(repoInfo);
    var headers = buildHeaders(true);

    if (cachedSnapshot && cachedSnapshot.etag) {
      headers["If-None-Match"] = cachedSnapshot.etag;
    }

    var response = await window.fetch(url, {
      headers: headers
    });

    if (response.status === 304 && cachedSnapshot) {
      logDiagnostic({
        source: "github-sync",
        kind: "read",
        status: "cache",
        message: "Leitura do GitHub validada via cache ETag.",
        details: repoInfo.owner + "/" + repoInfo.repo + "@" + repoInfo.branch
      });
      return {
        data: normalizeData(cachedSnapshot.data),
        sha: cachedSnapshot.sha || null,
        repoInfo: repoInfo,
        etag: cachedSnapshot.etag || "",
        fromCache: true
      };
    }

    if (response.status === 304) {
      response = await window.fetch(url, {
        headers: buildHeaders(true)
      });
    }

    if (response.status === 404) {
      logDiagnostic({
        source: "github-sync",
        kind: "read",
        status: "info",
        message: "Arquivo remoto ainda nao existe; usando estrutura inicial.",
        details: repoInfo.owner + "/" + repoInfo.repo + "@" + repoInfo.branch
      });
      return { data: dadosIniciais(), sha: null, repoInfo: repoInfo };
    }

    if (!response.ok) {
      var readError = buildReadError(response.status, await safeJson(response), response.headers);
      logDiagnostic({
        source: "github-sync",
        kind: "read",
        status: "error",
        message: readError.message,
        details: repoInfo.owner + "/" + repoInfo.repo + "@" + repoInfo.branch
      });
      throw readError;
    }

    var payload = await response.json();
    var encodedContent = String(payload.content || "").replace(/\n/g, "");
    var parsed = encodedContent ? JSON.parse(base64ToUtf8(encodedContent)) : dadosIniciais();
    var normalized = normalizeData(parsed);
    var etag = response.headers && response.headers.get ? String(response.headers.get("ETag") || "") : "";

    writeCachedSnapshot(repoInfo, {
      etag: etag,
      sha: payload.sha || null,
      data: normalized
    });
    logDiagnostic({
      source: "github-sync",
      kind: "read",
      status: "success",
      message: "Leitura do GitHub concluida.",
      details: repoInfo.owner + "/" + repoInfo.repo + "@" + repoInfo.branch
    });

    return {
      data: normalized,
      sha: payload.sha || null,
      repoInfo: repoInfo,
      etag: etag,
      fromCache: false
    };
  }

  async function salvarReceitas(data, sha, mensagemCommit) {
    var repoInfo = getRepoInfo();
    var body;
    var response;

    if (!hasToken()) {
      throw createError("Token GitHub nao configurado. Configure o token no painel admin.", 0, "missing_token");
    }

    body = {
      message: mensagemCommit || "Atualiza receitas",
      content: utf8ToBase64(JSON.stringify(normalizeData(data), null, 2)),
      branch: repoInfo.branch
    };

    if (sha) {
      body.sha = sha;
    }

    response = await window.fetch(getApiUrl(), {
      method: "PUT",
      headers: Object.assign({}, buildHeaders(true), {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      var writeError = buildWriteError(response.status, await safeJson(response), response.headers);
      logDiagnostic({
        source: "github-sync",
        kind: "write",
        status: "error",
        message: writeError.message,
        details: repoInfo.owner + "/" + repoInfo.repo + "@" + repoInfo.branch
      });
      throw writeError;
    }

    logDiagnostic({
      source: "github-sync",
      kind: "write",
      status: "success",
      message: mensagemCommit || "Atualizacao enviada ao GitHub.",
      details: repoInfo.owner + "/" + repoInfo.repo + "@" + repoInfo.branch
    });

    return response.json();
  }

  async function salvarComRetry(data, sha, mensagemCommit, rebuildData, tentativas) {
    var maxAttempts = Math.max(1, typeof tentativas === "number" ? tentativas : 3);
    var currentData = normalizeData(data);
    var currentSha = sha || null;
    var attempt = 1;

    while (attempt <= maxAttempts) {
      try {
        return await salvarReceitas(currentData, currentSha, mensagemCommit);
      } catch (error) {
        if (!shouldRetryWrite(error) || attempt >= maxAttempts) {
          throw error;
        }

        logDiagnostic({
          source: "github-sync",
          kind: "write",
          status: "retry",
          message: "Nova tentativa de gravacao apos erro temporario.",
          details: "Tentativa " + (attempt + 1) + " de " + maxAttempts + ": " + (error.message || error.code || "erro sem detalhe")
        });

        if (error.status === 409 || error.status === 422) {
          var latest = await lerReceitas();
          currentData = typeof rebuildData === "function"
            ? normalizeData(await rebuildData(cloneData(latest.data)))
            : currentData;
          currentSha = latest.sha || null;
        }

        await wait(getRetryDelay(attempt, error));
        attempt += 1;
      }
    }
  }

  window.GitHubSync = {
    lerReceitas: lerReceitas,
    salvarReceitas: salvarReceitas,
    salvarComRetry: salvarComRetry,
    getToken: getToken,
    setToken: setToken,
    hasToken: hasToken,
    clearToken: clearToken,
    getCategoriasIniciais: categoriasIniciais,
    getRepoInfo: getRepoInfo,
    getRepoOverride: getRepoOverride,
    setRepoOverride: setRepoOverride,
    clearRepoOverride: clearRepoOverride,
    inferRepoInfo: inferRepoInfo,
    __private: {
      normalizeData: normalizeData,
      sanitizeRepoPart: sanitizeRepoPart,
      createError: createError,
      buildReadError: buildReadError,
      buildWriteError: buildWriteError,
      getCacheStorageKey: getCacheStorageKey,
      readCachedSnapshot: readCachedSnapshot,
      writeCachedSnapshot: writeCachedSnapshot,
      getRateLimitResetMs: getRateLimitResetMs,
      formatRetryDelay: formatRetryDelay,
      shouldRetryWrite: shouldRetryWrite,
      getRetryDelay: getRetryDelay
    }
  };
})();
