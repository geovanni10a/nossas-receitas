const { createBrowserEnv } = require("./helpers/browser-env");

describe("NRValidation", () => {
  let env;
  let validation;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScript("js/validation.js");
    validation = env.window.NRValidation;
  });

  afterEach(() => {
    env.close();
  });

  it("aprova uma receita valida", () => {
    const result = validation.validateRecipe({
      titulo: "Bolo de cenoura",
      categoria: "doces",
      novaCategoria: "",
      ingredientes: ["2 ovos", "1 xicara de farinha"],
      modoPreparo: ["Misture", "Asse"],
      porcoes: "8",
      tags: ["bolo", "forno"],
      dificuldade: "Facil",
      isProcessingPhoto: false
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("exige titulo", () => {
    expect(validation.validateRecipe({
      titulo: "",
      categoria: "doces",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      dificuldade: "Facil"
    }).errors.titulo).toContain("obrigatorio");
  });

  it("limita o tamanho do titulo", () => {
    expect(validation.validateRecipe({
      titulo: "x".repeat(101),
      categoria: "doces",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      dificuldade: "Facil"
    }).errors.titulo).toContain("100 caracteres");
  });

  it("exige categoria", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      dificuldade: "Facil"
    }).errors.categoria).toContain("Escolha");
  });

  it("exige nome para nova categoria", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "__new__",
      novaCategoria: "",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      dificuldade: "Facil"
    }).errors.novaCategoria).toContain("nova categoria");
  });

  it("limita o tamanho da nova categoria", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "__new__",
      novaCategoria: "x".repeat(61),
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      dificuldade: "Facil"
    }).errors.novaCategoria).toContain("60 caracteres");
  });

  it("exige ingredientes", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "doces",
      ingredientes: [],
      modoPreparo: ["Misture"],
      dificuldade: "Facil"
    }).errors.ingredientes).toContain("ingrediente");
  });

  it("limita o tamanho de cada ingrediente", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "doces",
      ingredientes: ["x".repeat(161)],
      modoPreparo: ["Misture"],
      dificuldade: "Facil"
    }).errors.ingredientes).toContain("160 caracteres");
  });

  it("exige passos", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "doces",
      ingredientes: ["1 ovo"],
      modoPreparo: [],
      dificuldade: "Facil"
    }).errors.modoPreparo).toContain("passo");
  });

  it("limita o tamanho de cada passo", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "doces",
      ingredientes: ["1 ovo"],
      modoPreparo: ["x".repeat(321)],
      dificuldade: "Facil"
    }).errors.modoPreparo).toContain("320 caracteres");
  });

  it("exige porcoes inteiras positivas quando informadas", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "doces",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      porcoes: "0",
      dificuldade: "Facil"
    }).errors.porcoes).toContain("maior que zero");
  });

  it("limita a quantidade e o tamanho das tags", () => {
    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "doces",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      tags: Array.from({ length: 13 }, (_, index) => "tag" + index),
      dificuldade: "Facil"
    }).errors.tags).toContain("12 tags");

    expect(validation.validateRecipe({
      titulo: "Bolo",
      categoria: "doces",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      tags: ["x".repeat(25)],
      dificuldade: "Facil"
    }).errors.tags).toContain("24 caracteres");
  });

  it("rejeita dificuldade invalida e foto em processamento", () => {
    const result = validation.validateRecipe({
      titulo: "Bolo",
      categoria: "doces",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture"],
      dificuldade: "Expert",
      isProcessingPhoto: true
    });

    expect(result.errors.dificuldade).toContain("dificuldade valida");
    expect(result.errors.foto).toContain("processamento");
  });
});
