const { test, expect } = require("@playwright/test");
const { categories, mockSupabase } = require("./helpers");

const featuredRecipes = [
  {
    id: "bolo-coracao",
    titulo: "Bolo em formato de coração",
    categoriaId: "doces",
    categoriaNome: categories[0].nome,
    tags: ["bolo", "doce", "festivo"],
    tempoPreparo: "25 min",
    tempoForno: "45 min",
    porcoes: 12,
    dificuldade: "Medio",
    foto: "",
    fotoThumb: "",
    ingredientes: [
      "3 ovos em temperatura ambiente",
      "2 xicaras de acucar refinado",
      "2 xicaras de farinha de trigo",
      "1 xicara de leite morno",
      "1 colher de sopa de fermento"
    ],
    modoPreparo: [
      "Bata os ovos com o acucar ate formar um creme claro.",
      "Adicione o leite morno e misture com cuidado.",
      "Incorpore a farinha peneirada aos poucos.",
      "Por ultimo, acrescente o fermento e transfira para a forma em formato de coracao.",
      "Leve ao forno preaquecido a 180C por cerca de 45 minutos."
    ],
    dica: "Passe manteiga e farinha na forma para desenformar sem perder o formato.",
    criadoEm: "2026-04-15T10:30:00.000Z",
    atualizadoEm: "2026-04-18T10:30:00.000Z"
  },
  {
    id: "lasanha-bolonhesa",
    titulo: "Lasanha à bolonhesa",
    categoriaId: "massas",
    categoriaNome: categories[1].nome,
    tags: ["massa", "almoço"],
    tempoPreparo: "40 min",
    tempoForno: "30 min",
    porcoes: 8,
    dificuldade: "Medio",
    foto: "",
    fotoThumb: "",
    ingredientes: [
      "500 g de massa para lasanha",
      "400 g de patinho moido",
      "500 ml de molho de tomate",
      "300 g de queijo mussarela",
      "200 g de presunto"
    ],
    modoPreparo: [
      "Refogue a carne com cebola e alho ate dourar.",
      "Adicione o molho de tomate e cozinhe em fogo baixo.",
      "Monte a lasanha alternando massa, molho, presunto e mussarela.",
      "Cubra com queijo ralado e leve ao forno por 30 minutos."
    ],
    dica: "Deixe descansar 10 minutos antes de servir para firmar as camadas.",
    criadoEm: "2026-04-12T12:00:00.000Z",
    atualizadoEm: "2026-04-16T12:00:00.000Z"
  },
  {
    id: "salada-de-grao",
    titulo: "Salada fria de grão-de-bico",
    categoriaId: "saladas",
    categoriaNome: categories[3].nome,
    tags: ["salada", "leve"],
    tempoPreparo: "15 min",
    tempoForno: "",
    porcoes: 4,
    dificuldade: "Facil",
    foto: "",
    fotoThumb: "",
    ingredientes: [
      "2 xicaras de grao-de-bico cozido",
      "1 tomate picado sem sementes",
      "1/2 cebola roxa em tiras",
      "Salsinha a gosto",
      "Azeite, limao e sal"
    ],
    modoPreparo: [
      "Misture o grao-de-bico com o tomate e a cebola.",
      "Tempere com azeite, suco de limao e sal.",
      "Finalize com salsinha picada e leve a geladeira por 20 minutos."
    ],
    dica: "Funciona muito bem como acompanhamento de carnes grelhadas.",
    criadoEm: "2026-04-10T18:45:00.000Z",
    atualizadoEm: "2026-04-17T18:45:00.000Z"
  }
];

async function stabilizeForScreenshot(page) {
  await page.addStyleTag({
    content: [
      "*, *::before, *::after {",
      "  animation-duration: 0s !important;",
      "  animation-delay: 0s !important;",
      "  transition-duration: 0s !important;",
      "  transition-delay: 0s !important;",
      "  caret-color: transparent !important;",
      "}"
    ].join("\n")
  });
}

test.beforeEach(async ({ page }) => {
  await mockSupabase(page, { recipes: featuredRecipes, categories });
  await page.addInitScript(() => {
    window.localStorage.setItem("nr_prefs_motion", "reduced");
  });
});

test("capa visual (index.html modo claro)", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#conteudo-principal")).toBeVisible();
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("capa-clara.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("capa visual (index.html modo escuro)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/index.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("capa-escura.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("indice completo com 4 categorias (livro.html)", async ({ page }) => {
  await page.goto("/livro.html");
  await expect(page.locator(".categoria-card").first()).toBeVisible();
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("indice-categorias.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("lista de receitas dentro de uma categoria", async ({ page }) => {
  await page.goto("/livro.html?categoria=doces");
  await expect(page.locator(".item-lista").first()).toBeVisible();
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("categoria-doces.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("detalhe da receita (folha de livro)", async ({ page }) => {
  await page.goto("/livro.html?receita=bolo-coracao&categoria=doces");
  await expect(page.locator(".detalhe-receita")).toBeVisible();
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("detalhe-receita.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("detalhe da receita em modo escuro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/livro.html?receita=bolo-coracao&categoria=doces");
  await expect(page.locator(".detalhe-receita")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("detalhe-receita-escuro.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("tela de adicionar receita em branco", async ({ page }) => {
  await page.goto("/admin.html");
  await expect(page.locator("#recipe-form")).toBeVisible();
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("adicionar-receita.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("tela de adicionar receita com categoria pre-selecionada", async ({ page }) => {
  await page.goto("/admin.html?categoria=massas");
  await expect(page.locator("#recipe-form")).toBeVisible();
  await expect(page.locator("#categoria")).toHaveValue("massas");
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("adicionar-receita-pre-selecionada.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("visual mobile do indice (375 px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/livro.html");
  await expect(page.locator(".categoria-card").first()).toBeVisible();
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("mobile-indice.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("visual mobile da receita (375 px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/livro.html?receita=bolo-coracao&categoria=doces");
  await expect(page.locator(".detalhe-receita")).toBeVisible();
  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("mobile-detalhe.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});
