const { test, expect } = require("@playwright/test");
const { categories, mockSupabase } = require("./helpers");

const longRecipe = {
  id: "scroll-test",
  titulo: "Bolo em formato de coração",
  categoriaId: "doces",
  categoriaNome: categories[0].nome,
  tags: ["bolo", "teste", "scroll"],
  tempoPreparo: "45 min",
  tempoForno: "50 min",
  porcoes: 12,
  dificuldade: "Medio",
  foto: "",
  fotoThumb: "",
  ingredientes: Array.from({ length: 16 }, (_, index) => `Ingrediente de teste ${index + 1}`),
  modoPreparo: Array.from({ length: 14 }, (_, index) => `Passo de teste ${index + 1} com bastante texto para esticar a altura da receita e validar a rolagem corretamente dentro da folha do livro.`),
  dica: "Receita longa para validar scroll interno.",
  criadoEm: "2026-04-15T10:30:00.000Z",
  atualizadoEm: "2026-04-15T10:30:00.000Z"
};

test.beforeEach(async ({ page }) => {
  await mockSupabase(page, { recipes: [longRecipe], categories });
});

test("a folha da receita rola quando o conteudo e longo", async ({ page }) => {
  await page.goto("/livro.html?receita=scroll-test&categoria=doces");

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
