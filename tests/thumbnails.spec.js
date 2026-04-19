const { test, expect } = require("@playwright/test");
const { apiPattern, buildRemotePayload, categories } = require("./helpers");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnM0V8AAAAASUVORK5CYII=",
  "base64"
);

function decodeRecipesFromRequest(route) {
  const body = JSON.parse(route.request().postData() || "{}");
  return JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
}

function dataUrlByteSize(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  const padding = (base64.match(/=*$/) || [""])[0].length;

  return Math.ceil((base64.length * 3) / 4) - padding;
}

test("nova receita com foto salva miniatura otimizada", async ({ page }) => {
  let remoteState = buildRemotePayload();
  let savedData = null;

  await page.addInitScript(() => {
    window.localStorage.setItem("nr_github_token", "ghp_test_thumb");
  });

  await page.route(apiPattern, async (route) => {
    if (route.request().method() === "PUT") {
      savedData = decodeRecipesFromRequest(route);
      remoteState = savedData;

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

  await page.goto("/admin.html");
  await page.fill("#titulo", "Bolo com foto");
  await page.fill("#ingredientes-lista input", "2 ovos");
  await page.fill("#passos-lista input", "Misture tudo");
  await page.setInputFiles("#foto", {
    name: "foto.png",
    mimeType: "image/png",
    buffer: tinyPng
  });

  await expect(page.locator("#foto-status")).toBeHidden({ timeout: 5000 });
  await page.click("#btn-salvar-receita");
  await expect(page.locator("#toast")).toContainText("Receita sincronizada com sucesso");

  expect(savedData).not.toBeNull();
  expect(savedData.receitas).toHaveLength(1);
  expect(savedData.receitas[0].foto).toContain("data:image/webp;base64,");
  expect(savedData.receitas[0].fotoThumb).toContain("data:image/webp;base64,");
  expect(savedData.receitas[0].fotoThumb.length).toBeLessThan(savedData.receitas[0].foto.length);
  expect(dataUrlByteSize(savedData.receitas[0].foto)).toBeLessThanOrEqual(100 * 1024);
  expect(dataUrlByteSize(savedData.receitas[0].fotoThumb)).toBeLessThanOrEqual(15 * 1024);
});

test("painel migra receitas antigas sem miniatura", async ({ page }) => {
  let remoteState = buildRemotePayload({
    receitas: [{
      id: "legacy-thumb",
      titulo: "Receita antiga",
      categoriaId: categories[0].id,
      categoriaNome: categories[0].nome,
      tags: [],
      tempoPreparo: "25 min",
      tempoForno: "",
      porcoes: 6,
      dificuldade: "Facil",
      foto: "data:image/png;base64," + tinyPng.toString("base64"),
      fotoThumb: "",
      ingredientes: ["1 ovo"],
      modoPreparo: ["Misture tudo"],
      dica: "",
      criadoEm: "2026-04-18T10:30:00.000Z",
      atualizadoEm: "2026-04-18T10:30:00.000Z"
    }]
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("nr_github_token", "ghp_test_thumb");
  });

  await page.route(apiPattern, async (route) => {
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

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        sha: "teste-sha",
        content: Buffer.from(JSON.stringify(remoteState, null, 2)).toString("base64")
      })
    });
  });

  await page.goto("/admin.html");

  await expect(page.locator("#thumb-migracao-shell")).toContainText("Miniaturas antigas pendentes");
  await page.click("#thumb-migracao-shell .botao-secundario");
  await expect(page.locator("#toast")).toContainText("Miniatura antiga gerada com sucesso");

  expect(remoteState.receitas[0].fotoThumb).toContain("data:image/webp;base64,");
  expect(dataUrlByteSize(remoteState.receitas[0].fotoThumb)).toBeLessThanOrEqual(15 * 1024);
  await expect(page.locator("#thumb-migracao-shell")).toBeEmpty();
});
