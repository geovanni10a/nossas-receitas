const { createBrowserEnv } = require("./helpers/browser-env");

function jsonResponse(body, init) {
  return new Response(JSON.stringify(body), {
    headers: Object.assign({ "Content-Type": "application/json" }, init && init.headers ? init.headers : {}),
    status: init && init.status ? init.status : 200
  });
}

function encodedPayload(data, sha) {
  return {
    content: Buffer.from(JSON.stringify(data), "utf8").toString("base64"),
    sha: sha || "sha-1"
  };
}

describe("GitHubSync", () => {
  let env;
  let sync;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScript("js/github-sync.js");
    sync = env.window.GitHubSync;
  });

  afterEach(() => {
    env.close();
  });

  it("normaliza dados e aplica categorias padrao quando faltam", () => {
    const normalized = sync.__private.normalizeData({ receitas: [{ id: "1" }] });

    expect(normalized.receitas).toHaveLength(1);
    expect(normalized.categorias).toHaveLength(7);
  });

  it("infere owner e repo a partir de um GitHub Pages", () => {
    env.close();
    env = createBrowserEnv({
      url: "https://maria.github.io/caderno-da-vovo/livro.html"
    });
    env.loadScript("js/github-sync.js");
    sync = env.window.GitHubSync;

    expect(sync.inferRepoInfo()).toMatchObject({
      owner: "maria",
      repo: "caderno-da-vovo",
      branch: "main",
      source: "pages"
    });
  });

  it("constroi erro de leitura especifico para token invalido", () => {
    const error = sync.__private.buildReadError(401, { message: "Bad credentials" });

    expect(error.code).toBe("invalid_token");
    expect(error.message).toContain("Token invalido");
  });

  it("constroi erro de leitura com tempo restante de rate-limit", () => {
    const resetAt = Math.floor((Date.now() + 120000) / 1000);
    const error = sync.__private.buildReadError(
      403,
      { message: "API rate limit exceeded" },
      new Headers({ "X-RateLimit-Reset": String(resetAt) })
    );

    expect(error.code).toBe("rate_limit");
    expect(error.retryAfterMs).toBeGreaterThan(0);
    expect(error.message).toContain("Tente novamente em cerca de");
  });

  it("usa ETag e cache local quando o GitHub responde 304", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(encodedPayload({
        receitas: [{ id: "1", titulo: "Bolo" }],
        categorias: [{ id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A" }]
      }, "sha-primeiro"), {
        status: 200,
        headers: { ETag: "\"etag-1\"" }
      }))
      .mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: "\"etag-1\"" } }));

    env.close();
    env = createBrowserEnv({ fetch: fetchMock });
    env.loadScript("js/github-sync.js");
    sync = env.window.GitHubSync;

    const first = await sync.lerReceitas();
    const second = await sync.lerReceitas();

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.data.receitas[0].titulo).toBe("Bolo");
    expect(fetchMock.mock.calls[1][0]).toContain("?ref=main");
    expect(fetchMock.mock.calls[1][1].headers["If-None-Match"]).toBe("\"etag-1\"");
  });

  it("lista commits recentes do arquivo de receitas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([
      {
        sha: "abc123456789",
        commit: {
          message: "Atualiza receita: Bolo\n\nDetalhes extras",
          author: {
            name: "Geovanni",
            date: "2026-04-18T12:00:00.000Z"
          }
        },
        parents: [{ sha: "parent987654321" }],
        html_url: "https://github.com/geovanni10a/nossas-receitas/commit/abc123456789"
      }
    ]));

    env.close();
    env = createBrowserEnv({ fetch: fetchMock });
    env.loadScript("js/github-sync.js");
    sync = env.window.GitHubSync;

    const entries = await sync.listarHistoricoReceitas(5);

    expect(fetchMock.mock.calls[0][0]).toContain("/commits?path=");
    expect(entries[0]).toMatchObject({
      sha: "abc123456789",
      shortSha: "abc1234",
      message: "Atualiza receita: Bolo",
      parentSha: "parent987654321",
      authorName: "Geovanni"
    });
  });

  it("carrega um snapshot de receitas em uma ref especifica", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(encodedPayload({
      receitas: [{ id: "1", titulo: "Bolo antigo" }],
      categorias: [{ id: "doces", nome: "Doces", icone: "ðŸ°", cor: "#C4845A" }]
    }, "sha-ref")));

    env.close();
    env = createBrowserEnv({ fetch: fetchMock });
    env.loadScript("js/github-sync.js");
    sync = env.window.GitHubSync;

    const snapshot = await sync.lerReceitasEmRef("commit-antigo");

    expect(fetchMock.mock.calls[0][0]).toContain("ref=commit-antigo");
    expect(snapshot.sha).toBe("sha-ref");
    expect(snapshot.data.receitas[0].titulo).toBe("Bolo antigo");
  });

  it("refaz o merge em conflito antes de tentar salvar de novo", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "sha mismatch" }, { status: 409 }))
      .mockResolvedValueOnce(jsonResponse(encodedPayload({
        receitas: [{ id: "1", titulo: "Versao remota", atualizadoEm: "2026-04-18T12:00:00.000Z" }],
        categorias: [{ id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A" }]
      }, "sha-remoto"), { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ content: {}, commit: { sha: "novo-commit" } }, { status: 200 }));
    const delays = [];

    env.close();
    env = createBrowserEnv({ fetch: fetchMock });
    env.loadScript("js/github-sync.js");
    sync = env.window.GitHubSync;
    env.window.localStorage.setItem("nr_github_token", "ghp_token");
    env.window.setTimeout = (callback, delay) => {
      delays.push(delay);
      callback();
      return 1;
    };

    const result = await sync.salvarComRetry(
      {
        receitas: [{ id: "1", titulo: "Versao local" }],
        categorias: [{ id: "doces", nome: "Doces", icone: "🍰", cor: "#C4845A" }]
      },
      "sha-antigo",
      "Atualiza receita",
      (latestData) => {
        latestData.receitas[0].titulo = "Mesclada";
        return latestData;
      }
    );

    const retryBody = JSON.parse(fetchMock.mock.calls[2][1].body);

    expect(result.commit.sha).toBe("novo-commit");
    expect(delays[0]).toBeGreaterThanOrEqual(100);
    expect(retryBody.sha).toBe("sha-remoto");
    expect(Buffer.from(retryBody.content, "base64").toString("utf8")).toContain("Mesclada");
  });

  it("aplica backoff quando recebe rate-limit e salva na tentativa seguinte", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "API rate limit exceeded" }, {
        status: 403,
        headers: { "X-RateLimit-Reset": String(Math.floor((Date.now() + 2000) / 1000)) }
      }))
      .mockResolvedValueOnce(jsonResponse({ content: {}, commit: { sha: "ok" } }, { status: 200 }));
    const delays = [];

    env.close();
    env = createBrowserEnv({ fetch: fetchMock });
    env.loadScript("js/github-sync.js");
    sync = env.window.GitHubSync;
    env.window.localStorage.setItem("nr_github_token", "ghp_token");
    env.window.setTimeout = (callback, delay) => {
      delays.push(delay);
      callback();
      return 1;
    };

    await expect(sync.salvarComRetry({
      receitas: [],
      categorias: sync.getCategoriasIniciais()
    }, null, "Atualiza receitas")).resolves.toMatchObject({
      commit: { sha: "ok" }
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delays[0]).toBeGreaterThanOrEqual(100);
  });

  it("interrompe apos tres tentativas quando o erro persiste", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "server error" }, { status: 500 }));
    const delays = [];

    env.close();
    env = createBrowserEnv({ fetch: fetchMock });
    env.loadScript("js/github-sync.js");
    sync = env.window.GitHubSync;
    env.window.localStorage.setItem("nr_github_token", "ghp_token");
    env.window.setTimeout = (callback, delay) => {
      delays.push(delay);
      callback();
      return 1;
    };

    await expect(sync.salvarComRetry({
      receitas: [],
      categorias: sync.getCategoriasIniciais()
    }, null, "Atualiza receitas")).rejects.toMatchObject({
      code: "write_failed",
      status: 500
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(delays).toHaveLength(2);
  });
});
