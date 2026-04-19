const { test, expect } = require("@playwright/test");
const { categories, mockSupabase } = require("./helpers");

const baseRecipe = {
  id: "receita-crud",
  titulo: "Receita para editar",
  categoriaId: "doces",
  categoriaNome: categories[0].nome,
  tags: ["teste"],
  tempoPreparo: "20 min",
  tempoForno: "30 min",
  porcoes: 6,
  dificuldade: "Facil",
  foto: "",
  fotoThumb: "",
  ingredientes: ["2 ovos", "1 xicara de farinha"],
  modoPreparo: ["Misture tudo", "Asse por 30 minutos"],
  dica: "Dica original.",
  criadoEm: "2026-04-10T10:00:00.000Z",
  atualizadoEm: "2026-04-10T10:00:00.000Z"
};

test("criar receita nova via formulario redireciona para o livro", async ({ page }) => {
  await mockSupabase(page, { recipes: [], categories });
  await page.goto("/admin.html?categoria=doces");

  await expect(page.locator("#categoria")).toHaveValue("doces");
  await page.fill("#titulo", "Torta nova de teste");
  await page.fill("#tempo-preparo", "25 min");
  await page.fill("#porcoes", "8");
  await page.fill("#ingredientes-lista input", "2 ovos grandes");
  await page.fill("#passos-lista input", "Misture todos os ingredientes em uma tigela.");

  await page.click("#btn-salvar-receita");

  await expect(page.locator("#toast")).toContainText("Receita salva");
  await page.waitForURL(/livro\.html\?receita=/);
  await expect(page.locator(".detalhe-receita h1")).toContainText("Torta nova de teste");
});

test("editar receita existente atualiza o titulo", async ({ page }) => {
  await mockSupabase(page, { recipes: [baseRecipe], categories });
  await page.goto("/admin.html?id=receita-crud");

  await expect(page.locator("#admin-titulo")).toContainText("Editar receita");
  await expect(page.locator("#titulo")).toHaveValue("Receita para editar");

  await page.fill("#titulo", "Receita editada com sucesso");
  await page.click("#btn-salvar-receita");

  await expect(page.locator("#toast")).toContainText("Receita salva");
  await page.waitForURL(/livro\.html\?receita=receita-crud/);
  await expect(page.locator(".detalhe-receita h1")).toContainText("Receita editada com sucesso");
});

test("excluir receita remove ela do livro", async ({ page }) => {
  await mockSupabase(page, { recipes: [baseRecipe], categories });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/admin.html?id=receita-crud");
  await expect(page.locator("#delete-recipe")).toBeVisible();

  await page.click("#delete-recipe");

  await page.waitForURL(/livro\.html$/);
  await page.goto("/livro.html?categoria=doces");
  await expect(page.locator(".item-lista")).toHaveCount(0);
});
