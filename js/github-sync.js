(function () {
  var DEFAULT_OWNER = "geovanni10a";
  var DEFAULT_REPO = "nossas-receitas";
  var DEFAULT_BRANCH = "main";
  var FILE_PATH = "data/receitas.json";
  var TOKEN_KEY = "nr_github_token";
  var REPO_OVERRIDE_KEY = "nr_repo_override";

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

  function createError(message, status, code) {
    var error = new Error(message);
    error.status = status || 0;
    error.code = code || "github_error";
    return error;
  }

  function buildReadError(status, payload) {
    var message = payload && payload.message ? payload.message : "";

    if (status === 401) {
      return createError("Token invalido ou expirado. Gere outro token e tente novamente.", status, "invalid_token");
    }

    if (status === 403 && message.toLowerCase().indexOf("rate limit") !== -1) {
      return createError("Limite de requisicoes da API atingido. Aguarde alguns minutos ou configure um token GitHub no painel admin.", status, "rate_limit");
    }

    if (status === 403) {
      return createError("O token nao tem permissao para ler este repositorio. Revise o owner/repo e as permissoes.", status, "forbidden");
    }

    if (status === 404) {
      return createError("Repositorio, branch ou arquivo de receitas nao encontrado. Revise owner, repo e branch no wizard.", status, "repo_not_found");
    }

    return createError("Erro ao ler receitas do GitHub: " + status + " - " + (message || "falha desconhecida"), status, "read_failed");
  }

  function buildWriteError(status, payload) {
    var message = payload && payload.message ? payload.message : "";

    if (status === 401) {
      return createError("Token invalido ou expirado. Gere outro token e tente novamente.", status, "invalid_token");
    }

    if (status === 403 && message.toLowerCase().indexOf("rate limit") !== -1) {
      return createError("Limite de requisicoes da API atingido. Aguarde alguns minutos ou tente novamente mais tarde.", status, "rate_limit");
    }

    if (status === 403) {
      return createError("O token nao tem permissao de escrita neste repositorio. Confira se ele pode editar o conteudo.", status, "write_forbidden");
    }

    if (status === 404) {
      return createError("Repositorio, branch ou arquivo de receitas nao encontrado para gravacao.", status, "repo_not_found");
    }

    return createError("Erro ao salvar no GitHub: " + status + " - " + (message || "falha desconhecida"), status, "write_failed");
  }

  async function lerReceitas() {
    var repoInfo = getRepoInfo();
    var url = getApiUrl() + "?ref=" + encodeURIComponent(repoInfo.branch) + "&t=" + Date.now();
    var response = await window.fetch(url, {
      headers: buildHeaders(true)
    });

    if (response.status === 404) {
      return { data: dadosIniciais(), sha: null, repoInfo: repoInfo };
    }

    if (!response.ok) {
      throw buildReadError(response.status, await safeJson(response));
    }

    var payload = await response.json();
    var encodedContent = String(payload.content || "").replace(/\n/g, "");
    var parsed = encodedContent ? JSON.parse(base64ToUtf8(encodedContent)) : dadosIniciais();

    return {
      data: normalizeData(parsed),
      sha: payload.sha || null,
      repoInfo: repoInfo
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
      throw buildWriteError(response.status, await safeJson(response));
    }

    return response.json();
  }

  async function salvarComRetry(data, sha, mensagemCommit, rebuildData, tentativas) {
    var retriesLeft = typeof tentativas === "number" ? tentativas : 2;
    var currentData = normalizeData(data);
    var currentSha = sha || null;

    try {
      return await salvarReceitas(currentData, currentSha, mensagemCommit);
    } catch (error) {
      var isConflict = error.status === 409 || error.status === 422;

      if (!isConflict || retriesLeft <= 0) {
        throw error;
      }

      var latest = await lerReceitas();
      var mergedData = typeof rebuildData === "function"
        ? normalizeData(await rebuildData(cloneData(latest.data)))
        : currentData;

      return salvarComRetry(mergedData, latest.sha, mensagemCommit, rebuildData, retriesLeft - 1);
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
    inferRepoInfo: inferRepoInfo
  };
})();
