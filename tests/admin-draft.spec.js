const { test, expect } = require("@playwright/test");
const { mockGitHubContent } = require("./helpers");

test("admin recupera rascunho automaticamente apos recarregar", async ({ page }) => {
  await mockGitHubContent(page);
  await page.goto("/admin.html");

  await page.fill("#titulo", "Torta de teste");
  await page.fill("#tempo-preparo", "35 min");
  await page.fill("#ingredientes-lista input", "2 ovos");
  await page.fill("#passos-lista input", "Misture tudo com calma.");

  await page.reload();

  await expect(page.locator("#toast")).toContainText("Rascunho recuperado automaticamente");
  await expect(page.locator("#titulo")).toHaveValue("Torta de teste");
  await expect(page.locator("#tempo-preparo")).toHaveValue("35 min");
  await expect(page.locator("#ingredientes-lista input")).toHaveValue("2 ovos");
  await expect(page.locator("#passos-lista input")).toHaveValue("Misture tudo com calma.");
});
