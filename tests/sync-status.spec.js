const { test, expect } = require("@playwright/test");
const { mockGitHubContent } = require("./helpers");

test("livro mostra badge sem token apos leitura publica", async ({ page }) => {
  await mockGitHubContent(page);

  await page.goto("/livro.html");

  await expect(page.locator("#sync-status-book")).toContainText("Sem token");
  await expect(page.locator("#sync-status-book")).toContainText("Leitura publica ativa");
});

test("livro troca o badge para offline quando a conexao cai", async ({ page }) => {
  await mockGitHubContent(page);

  await page.goto("/livro.html");
  await page.context().setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
  });

  await expect(page.locator("#sync-status-book")).toContainText("Offline");
});
