const { createBrowserEnv } = require("./helpers/browser-env");

describe("NRDom", () => {
  let env;
  let domApi;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScript("js/dom.js");
    domApi = env.window.NRDom;
  });

  afterEach(() => {
    env.close();
  });

  it("cria elementos com texto escapado automaticamente", () => {
    const element = domApi.h("div", { className: "caixa" }, '<img src=x onerror="alert(1)">');

    expect(element.className).toBe("caixa");
    expect(element.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(element.innerHTML).toBe("&lt;img src=x onerror=\"alert(1)\"&gt;");
  });

  it("aceita arrays de filhos e dataset sem concatenar HTML", () => {
    const element = domApi.h(
      "ul",
      { dataset: { section: "ingredientes" } },
      [
        domApi.h("li", null, "Farinha"),
        domApi.h("li", null, "Ovos")
      ]
    );

    expect(element.dataset.section).toBe("ingredientes");
    expect(Array.from(element.querySelectorAll("li")).map((item) => item.textContent)).toEqual(["Farinha", "Ovos"]);
  });

  it("liga eventos a partir de atributos onX", () => {
    const onClick = vi.fn();
    const button = domApi.h("button", { onClick: onClick, type: "button" }, "Salvar");

    button.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
