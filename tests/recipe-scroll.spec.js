const { test, expect } = require("@playwright/test");

const categories = [
  { id: "doces-sobremesas", nome: "Doces & Sobremesas", icone: "🍰", cor: "#C4845A" },
  { id: "massas-graos", nome: "Massas & Grãos", icone: "🍝", cor: "#D9A066" },
  { id: "carnes-aves", nome: "Carnes & Aves", icone: "🍗", cor: "#A0522D" },
  { id: "saladas-entradas", nome: "Saladas & Entradas", icone: "🥗", cor: "#6B7C5C" },
  { id: "bebidas", nome: "Bebidas", icone: "🍹", cor: "#B07A54" },
  { id: "vegetariano-vegano", nome: "Vegetariano & Vegano", icone: "🌿", cor: "#7D8C62" },
  { id: "especiais-festas", nome: "Especiais & Festas", icone: "🎉", cor: "#C4845A" }
];

const longRecipe = {
  id: "scroll-test",
  titulo: "Bolo em formato de coração",
  categoriaId: "doces-sobremesas",
  tags: ["bolo", "teste", "scroll"],
  tempoPreparo: "45 min",
  tempoForno: "50 min",
  porcoes: 12,
  dificuldade: "Médio",
  foto: "",
  ingredientes: Array.from({ length: 16 }, (_, index) => `Ingrediente de teste ${index + 1}`),
  modoPreparo: Array.from({ length: 14 }, (_, index) => `Passo de teste ${index + 1} com bastante texto para esticar a altura da receita e validar a rolagem corretamente dentro da folha do livro.`),
  dica: "Receita longa para validar scroll interno.",
  criadoEm: "2026-04-15T10:30:00.000Z",
  atualizadoEm: "2026-04-15T10:30:00.000Z"
};

test.beforeEach(async ({ page }) => {
  const remotePayload = {
    receitas: [],
    categorias: categories
  };

  await page.route("https://api.github.com/repos/geovanni10a/nossas-receitas/contents/data/receitas.json**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        sha: "teste-sha",
        content: Buffer.from(JSON.stringify(remotePayload, null, 2)).toString("base64")
      })
    });
  });

  await page.addInitScript(([seedCategories, seedRecipe]) => {
    window.localStorage.setItem("nr_initialized", "true");
    window.localStorage.setItem("nr_cleaned_defaults", "true");
    window.localStorage.setItem("nr_categories", JSON.stringify(seedCategories));
    window.localStorage.setItem("nr_recipes", JSON.stringify([seedRecipe]));
  }, [categories, longRecipe]);
});

test("a folha da receita rola quando o conteudo e longo", async ({ page }) => {
  await page.goto("/livro.html?receita=scroll-test&categoria=doces-sobremesas");

  const pageContent = page.locator("#front-content");
  await expect(page.locator(".detalhe-receita")).toBeVisible();

  const metricsBefore = await pageContent.evaluate((element) => ({
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight
  }));

  expect(metricsBefore.scrollHeight).toBeGreaterThan(metricsBefore.clientHeight);

  const box = await pageContent.boundingBox();
  if (!box) {
    throw new Error("Nao foi possivel localizar a area rolavel da folha.");
  }

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
  await page.mouse.wheel(0, 1200);

  await expect.poll(async () => {
    return pageContent.evaluate((element) => element.scrollTop);
  }).toBeGreaterThan(0);
});
