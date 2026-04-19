const { test, expect } = require("@playwright/test");
const { categories, mockSupabase } = require("./helpers");

const longRecipe = {
  id: "mobile-scroll-test",
  titulo: "Bolo para validar mobile",
  categoriaId: "doces",
  categoriaNome: categories[0].nome,
  tags: ["bolo", "mobile"],
  tempoPreparo: "45 min",
  tempoForno: "50 min",
  porcoes: 12,
  dificuldade: "Medio",
  foto: "",
  fotoThumb: "",
  ingredientes: Array.from({ length: 18 }, (_, index) => `Ingrediente mobile ${index + 1}`),
  modoPreparo: Array.from({ length: 16 }, (_, index) => `Passo mobile ${index + 1} com bastante texto para garantir altura suficiente e validar a rolagem da pagina inteira no viewport compacto.`),
  dica: "Receita longa para validar a experiencia mobile.",
  criadoEm: "2026-04-15T10:30:00.000Z",
  atualizadoEm: "2026-04-15T10:30:00.000Z"
};

test("livro usa busca expansivel e pagina unica no mobile", async ({ page }) => {
  await mockSupabase(page, { recipes: [longRecipe], categories });
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto("/livro.html?receita=mobile-scroll-test&categoria=doces");

  const toggleSearch = page.locator("#toggle-search-book");
  const searchShell = page.locator("#busca-shell");

  await expect(toggleSearch).toBeVisible();
  await expect(searchShell).not.toBeVisible();

  await toggleSearch.click();
  await expect(searchShell).toBeVisible();
  await expect(page.locator("#busca-receitas")).toBeFocused();

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });

  expect(hasOverflow).toBe(false);

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });

  await expect.poll(async () => {
    return page.evaluate(() => window.scrollY);
  }).toBeGreaterThan(0);
});
