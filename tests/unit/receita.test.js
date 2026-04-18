const { createBrowserEnv } = require("./helpers/browser-env");

describe("NRReceita", () => {
  let env;
  let recipeApi;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScripts(["js/utils.js", "js/dom.js", "js/receita.js"]);
    recipeApi = env.window.NRReceita;
  });

  afterEach(() => {
    env.close();
  });

  it("renderiza a receita usando nos DOM e preserva texto malicioso como texto", async () => {
    const malicious = '<img src=x onerror="alert(1)">';

    env.window.NRStorage = {
      getRecipeById: vi.fn().mockResolvedValue({
        id: "recipe-1",
        titulo: malicious,
        categoriaId: "doces",
        tags: [malicious, "seguro"],
        tempoPreparo: "30 min",
        tempoForno: "40 min",
        porcoes: 8,
        dificuldade: "Facil",
        foto: "",
        ingredientes: [malicious],
        modoPreparo: [malicious],
        dica: malicious
      }),
      getCategoryById: vi.fn().mockResolvedValue({
        id: "doces",
        nome: "Doces & Sobremesas"
      }),
      getRecipesByCategory: vi.fn().mockResolvedValue([
        { id: "recipe-1", categoriaId: "doces" }
      ])
    };

    const node = await recipeApi.renderRecipeDetail("recipe-1");

    expect(node.nodeType).toBe(1);
    expect(node.querySelector("h1").textContent).toBe(malicious);
    expect(node.querySelector("h1 img")).toBeNull();
    expect(node.querySelector(".lista-ingredientes li").textContent).toBe(malicious);
    expect(node.querySelector(".receita-tag").textContent).toBe("#" + malicious);
    expect(node.innerHTML).toContain("&lt;img src=x onerror=\"alert(1)\"&gt;");
  });

  it("marca e desmarca passos ao vincular interacoes", async () => {
    env.window.NRStorage = {
      getRecipeById: vi.fn().mockResolvedValue({
        id: "recipe-2",
        titulo: "Bolo",
        categoriaId: "doces",
        tags: [],
        tempoPreparo: "30 min",
        tempoForno: "",
        porcoes: 6,
        dificuldade: "Facil",
        foto: "",
        ingredientes: ["Farinha"],
        modoPreparo: ["Misture tudo"],
        dica: ""
      }),
      getCategoryById: vi.fn().mockResolvedValue({
        id: "doces",
        nome: "Doces & Sobremesas"
      }),
      getRecipesByCategory: vi.fn().mockResolvedValue([
        { id: "recipe-1", categoriaId: "doces" },
        { id: "recipe-2", categoriaId: "doces" }
      ])
    };

    const node = await recipeApi.renderRecipeDetail("recipe-2");
    const container = env.window.document.createElement("div");
    container.appendChild(node);
    recipeApi.bindRecipeInteractions(container);

    const button = container.querySelector(".passo-item");

    expect(button.getAttribute("aria-pressed")).toBe("false");

    button.click();
    expect(button.classList.contains("is-done")).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    button.click();
    expect(button.classList.contains("is-done")).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
