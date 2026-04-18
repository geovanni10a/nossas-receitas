const { test, expect } = require("@playwright/test");
const { mockGitHubContent } = require("./helpers");

test("admin mostra diagnostico recente e exporta o log", async ({ page }) => {
  await mockGitHubContent(page);
  await page.goto("/admin.html");

  await expect(page.locator("#diagnostico-lista")).toContainText("Leitura do GitHub concluida");

  const downloadPromise = page.waitForEvent("download");
  await page.click("#btn-exportar-log");
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("nossas-receitas-log.txt");
});
