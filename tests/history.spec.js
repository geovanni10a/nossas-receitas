const { test, expect } = require("@playwright/test");
const { buildRemotePayload, categories } = require("./helpers");

function decodeRecipesFromRequest(route) {
  const body = JSON.parse(route.request().postData() || "{}");
  return JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
}

test("admin exibe o historico e restaura uma receita removida", async ({ page }) => {
  const removedRecipe = {
    id: "receita-perdida",
    titulo: "Receita perdida",
    categoriaId: categories[0].id,
    categoriaNome: categories[0].nome,
    tags: ["historia"],
    tempoPreparo: "35 min",
    tempoForno: "40 min",
    porcoes: 10,
    dificuldade: "Facil",
    foto: "",
    fotoThumb: "",
    ingredientes: ["2 ovos", "1 xicara de farinha"],
    modoPreparo: ["Misture", "Asse"],
    dica: "Versao que existia antes da exclusao.",
    criadoEm: "2026-04-18T10:00:00.000Z",
    atualizadoEm: "2026-04-18T10:00:00.000Z"
  };
  const deleteCommitSha = "deletecommit1234567890";
  const previousCommitSha = "beforedelete123456789";
  let remoteState = buildRemotePayload({ receitas: [] });

  await page.addInitScript(() => {
    window.localStorage.setItem("nr_github_token", "ghp_test_history");
  });

  await page.route("https://api.github.com/repos/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/commits?")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify([
          {
            sha: deleteCommitSha,
            commit: {
              message: "Remove receita: Receita perdida",
              author: {
                name: "Geovanni",
                date: "2026-04-18T18:00:00.000Z"
              }
            },
            parents: [{ sha: previousCommitSha }],
            html_url: "https://github.com/geovanni10a/nossas-receitas/commit/" + deleteCommitSha
          }
        ])
      });
      return;
    }

    if (url.includes("/contents/data/receitas.json")) {
      if (route.request().method() === "PUT") {
        remoteState = decodeRecipesFromRequest(route);

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

      const refMatch = url.match(/[?&]ref=([^&]+)/);
      const ref = refMatch ? decodeURIComponent(refMatch[1]) : "main";
      let snapshot = remoteState;

      if (ref === deleteCommitSha) {
        snapshot = buildRemotePayload({ receitas: [] });
      } else if (ref === previousCommitSha) {
        snapshot = buildRemotePayload({ receitas: [removedRecipe] });
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          sha: "teste-sha",
          content: Buffer.from(JSON.stringify(snapshot, null, 2)).toString("base64")
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/admin.html");

  await expect(page.locator("#historico-commits")).toContainText("Remove receita: Receita perdida");
  await expect(page.locator("#historico-detalhe")).toContainText("Receita perdida");
  await expect(page.locator("#historico-detalhe")).toContainText("Removida");

  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#historico-detalhe .historico-mudanca .botao-secundario");

  await expect(page.locator("#toast")).toContainText("Receita restaurada do historico com sucesso");
  expect(remoteState.receitas).toHaveLength(1);
  expect(remoteState.receitas[0].titulo).toBe("Receita perdida");
});
