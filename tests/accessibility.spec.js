const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { categories, mockSupabase } = require("./helpers");

const sampleRecipe = {
  id: "receita-acessivel",
  titulo: "Bolo para auditoria",
  categoriaId: categories[0].id,
  categoriaNome: categories[0].nome,
  tags: ["bolo", "teste"],
  tempoPreparo: "25 min",
  tempoForno: "35 min",
  porcoes: 8,
  dificuldade: "Facil",
  foto: "",
  fotoThumb: "",
  ingredientes: ["2 ovos", "1 xicara de farinha"],
  modoPreparo: ["Misture", "Asse"],
  dica: "Receita base para auditoria acessivel.",
  criadoEm: "2026-04-18T10:30:00.000Z",
  atualizadoEm: "2026-04-18T10:30:00.000Z"
};

async function expectNoAxeViolations(page) {
  const results = await new AxeBuilder({ page }).analyze();
  const violationSummary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.length
  }));

  expect(violationSummary).toEqual([]);
}

test("index.html passa na auditoria axe", async ({ page }) => {
  await mockSupabase(page, { recipes: [sampleRecipe], categories });

  await page.goto("/index.html");
  await expect(page.locator("#conteudo-principal")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("livro.html passa na auditoria axe", async ({ page }) => {
  await mockSupabase(page, { recipes: [sampleRecipe], categories });

  await page.goto("/livro.html?receita=receita-acessivel&categoria=doces");
  await expect(page.locator(".detalhe-receita")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("admin.html passa na auditoria axe", async ({ page }) => {
  await mockSupabase(page, { recipes: [sampleRecipe], categories });

  await page.goto("/admin.html");
  await expect(page.locator("#recipe-form")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("skip link move o foco para o conteudo principal", async ({ page }) => {
  await mockSupabase(page, { recipes: [sampleRecipe], categories });

  await page.goto("/livro.html");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#conteudo-principal")).toBeFocused();
});
