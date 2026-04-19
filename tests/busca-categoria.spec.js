const { test, expect } = require("@playwright/test");
const { categories, mockSupabase } = require("./helpers");

const recipes = [
  {
    id: "bolo-fuba",
    titulo: "Bolo de fuba",
    categoriaId: "doces",
    categoriaNome: categories[0].nome,
    tags: ["bolo", "cafe"],
    tempoPreparo: "20 min",
    tempoForno: "40 min",
    porcoes: 10,
    dificuldade: "Facil",
    foto: "",
    fotoThumb: "",
    ingredientes: ["3 ovos", "2 xicaras de fuba"],
    modoPreparo: ["Bata tudo", "Leve ao forno"],
    dica: "Sirva com cafe quente.",
    criadoEm: "2026-04-01T10:00:00.000Z",
    atualizadoEm: "2026-04-01T10:00:00.000Z"
  },
  {
    id: "brigadeiro",
    titulo: "Brigadeiro cremoso",
    categoriaId: "doces",
    categoriaNome: categories[0].nome,
    tags: ["doce", "chocolate"],
    tempoPreparo: "15 min",
    tempoForno: "",
    porcoes: 20,
    dificuldade: "Facil",
    foto: "",
    fotoThumb: "",
    ingredientes: ["1 lata de leite condensado", "4 colheres de chocolate"],
    modoPreparo: ["Misture tudo", "Cozinhe em fogo baixo"],
    dica: "Nao deixe endurecer demais.",
    criadoEm: "2026-04-02T10:00:00.000Z",
    atualizadoEm: "2026-04-02T10:00:00.000Z"
  },
  {
    id: "spaghetti-alho",
    titulo: "Spaghetti ao alho e oleo",
    categoriaId: "massas",
    categoriaNome: categories[1].nome,
    tags: ["massa", "rapido"],
    tempoPreparo: "15 min",
    tempoForno: "",
    porcoes: 4,
    dificuldade: "Facil",
    foto: "",
    fotoThumb: "",
    ingredientes: ["500 g de spaghetti", "4 dentes de alho"],
    modoPreparo: ["Cozinhe a massa", "Doure o alho e misture"],
    dica: "Reserve um pouco da agua do cozimento.",
    criadoEm: "2026-04-03T10:00:00.000Z",
    atualizadoEm: "2026-04-03T10:00:00.000Z"
  }
];

test.beforeEach(async ({ page }) => {
  await mockSupabase(page, { recipes, categories });
});

test("busca filtra receitas por titulo e abre sugestao", async ({ page }) => {
  await page.goto("/livro.html");

  const input = page.locator("#busca-receitas");
  await input.fill("Brigadeiro");

  const dropdown = page.locator("#busca-resultados");
  await expect(dropdown).toBeVisible();
  await expect(dropdown).toContainText("Brigadeiro cremoso");
  await expect(dropdown).not.toContainText("Spaghetti");

  await dropdown.locator("button").first().click();
  await expect(page).toHaveURL(/receita=brigadeiro/);
  await expect(page.locator(".detalhe-receita h1")).toContainText("Brigadeiro cremoso");
});

test("placeholder e label da busca mostram apenas 'Pesquisar'", async ({ page }) => {
  await page.goto("/livro.html");

  const input = page.locator("#busca-receitas");
  await expect(input).toHaveAttribute("placeholder", "Pesquisar");
  const label = page.locator("label[for='busca-receitas']");
  const labelText = (await label.textContent() || "").trim();
  expect(labelText.length).toBeGreaterThan(0);
  expect(labelText.toLowerCase()).toContain("pesquisar");
});

test("categoria exibe apenas receitas daquele grupo", async ({ page }) => {
  await page.goto("/livro.html?categoria=doces");

  const items = page.locator(".item-lista");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText(/Bolo de fuba|Brigadeiro/);

  await page.goto("/livro.html?categoria=massas");
  const massaItems = page.locator(".item-lista");
  await expect(massaItems).toHaveCount(1);
  await expect(massaItems.first()).toContainText("Spaghetti");
});

test("card de categoria oferece 'Adicionar aqui' com categoria pre-selecionada", async ({ page }) => {
  await page.goto("/livro.html");

  const cardMassas = page.locator(".categoria-card", { hasText: categories[1].nome });
  await expect(cardMassas).toBeVisible();
  const addButton = cardMassas.locator("a", { hasText: /Adicionar/ });
  await expect(addButton).toHaveAttribute("href", /admin\.html\?categoria=massas/);

  await addButton.click();
  await page.waitForURL(/admin\.html\?categoria=massas/);
  await expect(page.locator("#categoria")).toHaveValue("massas");
});
