(function () {
  var REPO_OWNER = "geovanni10a";
  var REPO_NAME = "nossas-receitas";
  var FILE_PATH = "data/receitas.json";
  var BRANCH = "main";
  var TOKEN_KEY = "nr_github_token";
  var API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + FILE_PATH;

  function categoriasIniciais() {
    return [
      { id: "doces", nome: "Doces & Sobremesas", icone: "🍰", cor: "#C4845A" },
      { id: "massas", nome: "Massas & Grãos", icone: "🍝", cor: "#A0522D" },
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

  function buildReadError(status, payload) {
    var message = payload && payload.message ? payload.message : "";

    if (status === 403 && message.toLowerCase().indexOf("rate limit") !== -1) {
      return new Error("Limite de requisicoes da API atingido. Aguarde alguns minutos ou configure um token GitHub no painel admin.");
    }

    return new Error("Erro ao ler receitas do GitHub: " + status + " - " + (message || "falha desconhecida"));
  }

  function buildWriteError(status, payload) {
    var message = payload && payload.message ? payload.message : "";

    if (status === 403 && message.toLowerCase().indexOf("rate limit") !== -1) {
      return new Error("Limite de requisicoes da API atingido. Aguarde alguns minutos ou tente novamente mais tarde.");
    }

    return new Error("Erro ao salvar no GitHub: " + status + " - " + (message || "falha desconhecida"));
  }

  async function lerReceitas() {
    var url = API_URL + "?ref=" + encodeURIComponent(BRANCH) + "&t=" + Date.now();
    var response = await window.fetch(url, {
      headers: buildHeaders(true)
    });

    if (response.status === 404) {
      return { data: dadosIniciais(), sha: null };
    }

    if (!response.ok) {
      throw buildReadError(response.status, await safeJson(response));
    }

    var payload = await response.json();
    var encodedContent = String(payload.content || "").replace(/\n/g, "");
    var parsed = encodedContent ? JSON.parse(base64ToUtf8(encodedContent)) : dadosIniciais();

    return {
      data: normalizeData(parsed),
      sha: payload.sha || null
    };
  }

  async function salvarReceitas(data, sha, mensagemCommit) {
    if (!hasToken()) {
      throw new Error("Token GitHub nao configurado. Configure o token no painel admin.");
    }

    var body = {
      message: mensagemCommit || "Atualiza receitas",
      content: utf8ToBase64(JSON.stringify(normalizeData(data), null, 2)),
      branch: BRANCH
    };

    if (sha) {
      body.sha = sha;
    }

    var response = await window.fetch(API_URL, {
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
      var isConflict = error.message.indexOf("409") !== -1 || error.message.indexOf("422") !== -1;

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
    getRepoInfo: function () {
      return {
        owner: REPO_OWNER,
        repo: REPO_NAME,
        branch: BRANCH,
        filePath: FILE_PATH
      };
    }
  };
})();
