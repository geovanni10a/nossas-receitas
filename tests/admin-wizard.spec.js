const { test, expect } = require("@playwright/test");
const { apiPattern, buildRemotePayload, categories, mockGitHubContent } = require("./helpers");

test("wizard valida token e mostra o repo e total de receitas", async ({ page }) => {
  const receitas = [
    {
      id: "bolo-validacao",
      titulo: "Bolo de teste",
      categoriaId: categories[0].id,
      tags: ["teste"],
      tempoPreparo: "30 min",
      tempoForno: "35 min",
      porcoes: 8,
      dificuldade: "Facil",
      foto: "",
      ingredientes: ["1 xicara de farinha"],
      modoPreparo: ["Misture tudo"],
      dica: "",
      criadoEm: "2026-04-18T10:30:00.000Z",
      atualizadoEm: "2026-04-18T10:30:00.000Z"
    }
  ];

  await mockGitHubContent(page, {
    payload: buildRemotePayload({ receitas })
  });

  await page.goto("/admin.html");
  await page.fill("#campo-token", "ghp_test_123");
  await page.click("#btn-salvar-token");

  await expect(page.locator("#status-token")).toContainText("Sincronizacao ativa");
  await expect(page.locator("#wizard-resumo")).toContainText("Owner: geovanni10a");
  await expect(page.locator("#wizard-resumo")).toContainText("Repositorio: nossas-receitas");
  await expect(page.locator("#wizard-resumo")).toContainText("Total de receitas lidas: 1");
});

test("wizard mostra mensagem especifica para token invalido", async ({ page }) => {
  await page.route(apiPattern, async (route) => {
    const hasAuth = Boolean(route.request().headers().authorization);

    await route.fulfill({
      status: hasAuth ? 401 : 200,
      contentType: "application/json; charset=utf-8",
      body: hasAuth
        ? JSON.stringify({ message: "Bad credentials" })
        : JSON.stringify({
            sha: "teste-sha",
            content: Buffer.from(JSON.stringify(buildRemotePayload(), null, 2)).toString("base64")
          })
    });
  });

  await page.goto("/admin.html");
  await page.fill("#campo-token", "ghp_invalido");
  await page.click("#btn-salvar-token");

  await expect(page.locator("#status-token")).toContainText("O GitHub recusou o token");
});
