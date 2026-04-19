const { test, expect } = require("@playwright/test");
const { categories, mockSupabase } = require("./helpers");

const offlineRecipe = {
  id: "bolo-offline",
  titulo: "Bolo salvo para modo offline",
  categoriaId: "doces",
  categoriaNome: categories[0].nome,
  tags: ["offline", "pwa"],
  tempoPreparo: "35 min",
  tempoForno: "40 min",
  porcoes: 8,
  dificuldade: "Facil",
  foto: "",
  fotoThumb: "",
  ingredientes: ["2 ovos", "1 xicara de farinha"],
  modoPreparo: ["Misture tudo", "Asse ate dourar"],
  dica: "Receita criada para testar o cache offline.",
  criadoEm: "2026-04-18T10:30:00.000Z",
  atualizadoEm: "2026-04-18T10:30:00.000Z"
};

async function waitForServiceWorker(page) {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker));
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));

  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  }
}

test("livro continua acessivel offline apos a primeira visita", async ({ page }) => {
  await mockSupabase(page, { recipes: [offlineRecipe], categories });

  await page.goto("/livro.html?categoria=doces");
  await expect(page.locator(".item-lista h3")).toContainText("Bolo salvo para modo offline");
  await waitForServiceWorker(page);

  await page.context().setOffline(true);
  await page.reload();

  await expect(page.locator(".item-lista h3")).toContainText("Bolo salvo para modo offline");
  await expect(page.locator("#sync-status-book")).toContainText("Offline");
});

test("service worker entrega a tela offline para navegacao fora do cache", async ({ page }) => {
  await mockSupabase(page, { recipes: [offlineRecipe], categories });

  await page.goto("/index.html");
  await waitForServiceWorker(page);

  await page.context().setOffline(true);
  await page.goto("/rota-que-nao-existe.html");

  await expect(page).toHaveURL(/\/rota-que-nao-existe\.html$/);
  await expect(page.locator("h1")).toContainText("O livro ficou sem conexao agora.");
  await expect(page.locator(".offline-card")).toContainText("Receitas carregadas antes continuam disponiveis neste aparelho.");
});
