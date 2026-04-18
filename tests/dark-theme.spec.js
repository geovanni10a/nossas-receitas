const { test, expect } = require("@playwright/test");
const { mockGitHubContent } = require("./helpers");

test("tema automatico respeita prefers-color-scheme dark no carregamento", async ({ page }) => {
  await mockGitHubContent(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/index.html");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#toggle-theme-home")).toContainText("Tema automatico");
});

test("toggle de tema persiste entre navegacoes", async ({ page }) => {
  await mockGitHubContent(page);
  await page.goto("/livro.html");
  const themeButton = page.locator("#toggle-theme-book");

  await themeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(async () => {
    return page.evaluate(() => window.localStorage.getItem("nr_theme"));
  }).toBe("dark");

  await page.goto("/admin.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#toggle-theme-admin")).toContainText("Tema escuro");
});
