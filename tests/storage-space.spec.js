const { test, expect } = require("@playwright/test");
const { buildRemotePayload, categories, mockGitHubContent } = require("./helpers");

test("admin mostra alerta progressivo quando receitas.json passa de 60%", async ({ page }) => {
  const heavyPhoto = "data:image/jpeg;base64," + "A".repeat(620000);
  const receitas = Array.from({ length: 2 }, (_, index) => ({
    id: "pesada-" + index,
    titulo: "Receita pesada " + index,
    categoriaId: categories[0].id,
    tags: ["foto"],
    tempoPreparo: "20 min",
    tempoForno: "",
    porcoes: 4,
    dificuldade: "Facil",
    foto: heavyPhoto,
    ingredientes: ["Ingrediente"],
    modoPreparo: ["Passo"],
    dica: "",
    criadoEm: "2026-04-18T10:30:00.000Z",
    atualizadoEm: "2026-04-18T10:30:00.000Z"
  }));

  await mockGitHubContent(page, {
    payload: buildRemotePayload({ receitas })
  });

  await page.goto("/admin.html");

  await expect(page.locator("#espaco-resumo")).toContainText("%");
  await expect(page.locator("#espaco-alerta")).toContainText(/60%|80%|95%/);
  await expect(page.locator("#espaco-lista")).toContainText("Receita pesada 0");
});
