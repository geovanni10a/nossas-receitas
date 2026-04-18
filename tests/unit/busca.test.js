const { createBrowserEnv } = require("./helpers/browser-env");

describe("NRBusca", () => {
  let env;
  let busca;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScript("js/busca.js");
    busca = env.window.NRBusca;
  });

  afterEach(() => {
    env.close();
  });

  it("normaliza acentos, caixa e espacos", () => {
    expect(busca.normalize("  Crème Brûlée  ")).toBe("creme brulee");
  });

  it("nao dispara busca com menos de dois caracteres", async () => {
    const getAllRecipes = vi.fn();

    env.window.NRStorage = {
      getAllRecipes,
      getCategories: vi.fn()
    };

    await expect(busca.search("a")).resolves.toEqual([]);
    expect(getAllRecipes).not.toHaveBeenCalled();
  });

  it("busca por titulo e tag sem diferenciar acentos", async () => {
    env.window.NRStorage = {
      getAllRecipes: vi.fn().mockResolvedValue([
        { id: "1", titulo: "Bolo de Cenoura", tags: ["forno", "classico"], categoriaId: "doces" },
        { id: "2", titulo: "Pao de Queijo", tags: ["rapido"], categoriaId: "massas" },
        { id: "3", titulo: "Limao Siciliano", tags: ["citrico"], categoriaId: "bebidas" }
      ]),
      getCategories: vi.fn().mockResolvedValue([
        { id: "doces", nome: "Doces & Sobremesas" },
        { id: "massas", nome: "Massas & Graos" },
        { id: "bebidas", nome: "Bebidas" }
      ])
    };

    await expect(busca.search("cenóura")).resolves.toEqual([
      { id: "1", titulo: "Bolo de Cenoura", categoria: "Doces & Sobremesas" }
    ]);

    await expect(busca.search("rápido")).resolves.toEqual([
      { id: "2", titulo: "Pao de Queijo", categoria: "Massas & Graos" }
    ]);
  });

  it("limita os resultados a oito receitas", async () => {
    env.window.NRStorage = {
      getAllRecipes: vi.fn().mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({
        id: String(index + 1),
        titulo: "Bolo " + (index + 1),
        tags: ["doce"],
        categoriaId: "doces"
      }))),
      getCategories: vi.fn().mockResolvedValue([
        { id: "doces", nome: "Doces & Sobremesas" }
      ])
    };

    const results = await busca.search("bolo");

    expect(results).toHaveLength(8);
    expect(results[0].id).toBe("1");
    expect(results[7].id).toBe("8");
  });

  it("debounce executa apenas a ultima chamada", async () => {
    const received = [];
    const debounced = busca.debounce((value) => {
      received.push(value);
    }, 20);

    debounced("primeira");
    debounced("segunda");
    debounced("terceira");

    await new Promise((resolve) => env.window.setTimeout(resolve, 40));

    expect(received).toEqual(["terceira"]);
  });
});
