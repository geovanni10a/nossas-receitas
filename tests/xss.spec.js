const { test, expect } = require("@playwright/test");
const { categories, mockSupabase } = require("./helpers");

test("conteudo malicioso e exibido como texto sem executar scripts", async ({ page }) => {
  const malicious = '<img src=x onerror=alert(1)>';
  const maliciousRecipe = {
    id: "xss-recipe",
    titulo: malicious,
    categoriaId: categories[0].id,
    categoriaNome: categories[0].nome,
    tags: [malicious, "seguro"],
    tempoPreparo: "25 min",
    tempoForno: "",
    porcoes: 6,
    dificuldade: "Facil",
    foto: "",
    fotoThumb: "",
    ingredientes: [malicious],
    modoPreparo: [malicious],
    dica: malicious,
    criadoEm: "2026-04-18T10:30:00.000Z",
    atualizadoEm: "2026-04-18T10:30:00.000Z"
  };
  let dialogTriggered = false;

  page.on("dialog", async (dialog) => {
    dialogTriggered = true;
    await dialog.dismiss();
  });

  await mockSupabase(page, { recipes: [maliciousRecipe] });

  await page.goto("/livro.html?receita=xss-recipe");

  await expect(page.locator(".detalhe-receita h1")).toContainText(malicious);
  await page.fill("#busca-receitas", "img");
  await expect(page.locator("#busca-resultados")).toContainText(malicious);
  expect(dialogTriggered).toBe(false);
});
