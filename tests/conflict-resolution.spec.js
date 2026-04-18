const { test, expect } = require("@playwright/test");
const { apiPattern, buildRemotePayload, categories } = require("./helpers");

function decodeRecipesFromRequest(route) {
  const body = JSON.parse(route.request().postData() || "{}");
  return JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
}

test("admin abre o modal de conflito e reaproveita a escolha no merge em 3 vias", async ({ page }) => {
  const baseRecipe = {
    id: "receita-conflito",
    titulo: "Bolo base",
    categoriaId: categories[0].id,
    categoriaNome: categories[0].nome,
    tags: ["bolo"],
    tempoPreparo: "30 min",
    tempoForno: "",
    porcoes: 8,
    dificuldade: "Facil",
    foto: "",
    fotoThumb: "",
    ingredientes: ["2 ovos"],
    modoPreparo: ["Misture tudo"],
    dica: "Dica base",
    criadoEm: "2026-04-18T10:30:00.000Z",
    atualizadoEm: "2026-04-18T10:30:00.000Z"
  };
  const remoteEditedRecipe = Object.assign({}, baseRecipe, {
    titulo: "Bolo da Maria",
    tempoPreparo: "45 min",
    atualizadoEm: "2026-04-18T11:30:00.000Z"
  });
  let remoteState = buildRemotePayload({
    receitas: [baseRecipe]
  });
  let putCount = 0;
  let finalSavedState = null;

  await page.addInitScript(() => {
    window.localStorage.setItem("nr_github_token", "ghp_test_conflict");
  });

  await page.route(apiPattern, async (route) => {
    if (route.request().method() === "PUT") {
      putCount += 1;

      if (putCount === 1) {
        remoteState = buildRemotePayload({
          receitas: [remoteEditedRecipe]
        });

        await route.fulfill({
          status: 409,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ message: "sha mismatch" })
        });
        return;
      }

      finalSavedState = decodeRecipesFromRequest(route);
      remoteState = finalSavedState;

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          content: { sha: "novo-sha" },
          commit: { sha: "novo-commit" }
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        sha: "teste-sha",
        content: Buffer.from(JSON.stringify(remoteState, null, 2)).toString("base64")
      })
    });
  });

  await page.goto("/admin.html?id=receita-conflito");
  await page.fill("#titulo", "Bolo da Geovanni");
  await page.fill("#dica", "Dica local");
  await page.click("#btn-salvar-receita");

  const modal = page.locator("#conflito-modal-shell");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("alteracoes concorrentes");
  await expect(modal).toContainText("Titulo");
  await expect(modal).toContainText("Bolo base");
  await expect(modal).toContainText("Bolo da Geovanni");
  await expect(modal).toContainText("Bolo da Maria");

  await page.click("#conflito-modal-shell .botao-primario");
  await expect(page.locator("#toast")).toContainText("Receita sincronizada com sucesso");

  expect(finalSavedState).not.toBeNull();
  expect(finalSavedState.receitas).toHaveLength(1);
  expect(finalSavedState.receitas[0].titulo).toBe("Bolo da Geovanni");
  expect(finalSavedState.receitas[0].tempoPreparo).toBe("45 min");
  expect(finalSavedState.receitas[0].dica).toBe("Dica local");
});
