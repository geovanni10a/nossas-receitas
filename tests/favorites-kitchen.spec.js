const { test, expect } = require("@playwright/test");
const { buildRemotePayload, categories, mockGitHubContent } = require("./helpers");

const featuredRecipe = {
  id: "favorita-da-casa",
  titulo: "Bolo de domingo",
  categoriaId: categories[0].id,
  categoriaNome: categories[0].nome,
  tags: ["bolo", "casa"],
  tempoPreparo: "30 min",
  tempoForno: "40 min",
  porcoes: 10,
  dificuldade: "Facil",
  foto: "",
  fotoThumb: "",
  ingredientes: ["2 ovos", "1 xicara de farinha"],
  modoPreparo: [
    "Misture os ingredientes secos.",
    "Acrescente os liquidos e mexa bem."
  ],
  dica: "Receita boa para testar favoritos e cozinha agora.",
  criadoEm: "2026-04-18T10:30:00.000Z",
  atualizadoEm: "2026-04-18T10:30:00.000Z"
};

test.beforeEach(async ({ page }) => {
  await mockGitHubContent(page, {
    payload: buildRemotePayload({ receitas: [] })
  });

  await page.addInitScript(([seedCategories, seedRecipe]) => {
    window.localStorage.setItem("nr_initialized", "true");
    window.localStorage.setItem("nr_cleaned_defaults", "true");
    window.localStorage.setItem("nr_categories", JSON.stringify(seedCategories));
    window.localStorage.setItem("nr_recipes", JSON.stringify([seedRecipe]));
  }, [categories, featuredRecipe]);
});

test("favoritar uma receita persiste e cria destaque no indice", async ({ page }) => {
  await page.goto("/livro.html?receita=favorita-da-casa&categoria=doces");

  const favoriteButton = page.locator("[data-favorite-toggle]");

  await expect(favoriteButton).toHaveAttribute("aria-pressed", "false");
  await favoriteButton.click();
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");

  await expect.poll(async () => {
    return page.evaluate(() => JSON.parse(window.localStorage.getItem("nr_favoritos") || "[]"));
  }).toEqual(["favorita-da-casa"]);

  await page.goto("/livro.html");
  await expect(page.locator(".favoritos-destaque")).toContainText("Favoritas da casa");
  await expect(page.locator(".favoritos-destaque")).toContainText("Bolo de domingo");

  await page.goto("/livro.html?receita=favorita-da-casa&categoria=doces");
  await expect(page.locator("[data-favorite-toggle]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-favorite-chip]")).toBeVisible();
});

test("modo cozinha amplia os passos e usa Wake Lock quando disponivel", async ({ page }) => {
  await page.addInitScript(() => {
    window.__wakeLockStats = { requests: 0, releases: 0 };

    Object.defineProperty(window.navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async function () {
          window.__wakeLockStats.requests += 1;

          return {
            released: false,
            async release() {
              this.released = true;
              window.__wakeLockStats.releases += 1;
            },
            addEventListener() {},
            removeEventListener() {}
          };
        }
      }
    });
  });

  await page.goto("/livro.html?receita=favorita-da-casa&categoria=doces");

  const kitchenButton = page.locator("[data-kitchen-toggle]");
  const detail = page.locator(".detalhe-receita");
  const firstStep = page.locator(".passo-item").first();
  const stepFontBefore = await firstStep.evaluate((element) => {
    return parseFloat(window.getComputedStyle(element).fontSize);
  });

  await kitchenButton.click();

  await expect(detail).toHaveClass(/is-kitchen-mode/);
  await expect(page.locator("[data-kitchen-banner]")).toBeVisible();
  await expect(page).toHaveURL(/cozinha=1/);
  await expect.poll(async () => {
    return page.evaluate(() => window.__wakeLockStats.requests);
  }).toBe(1);

  const stepFontAfter = await firstStep.evaluate((element) => {
    return parseFloat(window.getComputedStyle(element).fontSize);
  });

  expect(stepFontAfter).toBeGreaterThan(stepFontBefore);

  await kitchenButton.click();
  await expect(detail).not.toHaveClass(/is-kitchen-mode/);
  await expect(page).not.toHaveURL(/cozinha=1/);
  await expect.poll(async () => {
    return page.evaluate(() => window.__wakeLockStats.releases);
  }).toBe(1);
});
