const { createBrowserEnv } = require("./helpers/browser-env");

describe("NRCategorias", () => {
  let env;
  let categoriasApi;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScripts(["js/dom.js", "js/categorias.js"]);
    categoriasApi = env.window.NRCategorias;
    env.window.NRUtils = {
      safeImageSource: vi.fn((value, fallback) => value || fallback)
    };
  });

  afterEach(() => {
    env.close();
  });

  it("renderiza a lista da categoria usando nos DOM e preserva texto malicioso como texto", async () => {
    const malicious = '<img src=x onerror="alert(1)">';

    env.window.NRStorage = {
      getCategoryById: vi.fn().mockResolvedValue({
        id: "doces",
        nome: "Doces & Sobremesas"
      }),
      getRecipesByCategory: vi.fn().mockResolvedValue([
        {
          id: "recipe-1",
          categoriaId: "doces",
          titulo: malicious,
          dica: malicious,
          foto: "",
          fotoThumb: "",
          tempoPreparo: "25 min",
          dificuldade: "Facil"
        }
      ])
    };

    const node = await categoriasApi.renderCategoryRecipes("doces");

    expect(node.nodeType).toBe(1);
    expect(node.querySelector(".item-lista h3").textContent).toBe(malicious);
    expect(node.querySelector(".item-lista h3 img")).toBeNull();
    expect(node.querySelector(".item-lista p").textContent).toBe(malicious);
    expect(node.innerHTML).toContain("&lt;img src=x onerror=\"alert(1)\"&gt;");
  });

  it("gera o preview da capa como fragmento de nos DOM", async () => {
    env.window.NRStorage = {
      getCategories: vi.fn().mockResolvedValue([
        {
          id: "doces",
          nome: "Doces & Sobremesas",
          icone: "🍰",
          totalReceitas: 3
        },
        {
          id: "bebidas",
          nome: "Bebidas",
          icone: "☕",
          totalReceitas: 1
        }
      ])
    };

    const preview = await categoriasApi.previewMarkup();
    const host = env.window.document.createElement("div");

    host.appendChild(preview);

    expect(host.querySelectorAll(".preview-categoria")).toHaveLength(2);
    expect(host.textContent).toContain("🍰 Doces & Sobremesas");
    expect(host.textContent).toContain("1 registradas");
  });
});
