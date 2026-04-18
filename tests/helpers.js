const categories = [
  { id: "doces", nome: "Doces & Sobremesas", icone: "🍰", cor: "#C4845A" },
  { id: "massas", nome: "Massas & Graos", icone: "🍝", cor: "#A0522D" },
  { id: "carnes", nome: "Carnes & Aves", icone: "🥩", cor: "#8B4513" },
  { id: "saladas", nome: "Saladas & Entradas", icone: "🥗", cor: "#6B7C5C" },
  { id: "bebidas", nome: "Bebidas", icone: "🥤", cor: "#7B9EA6" },
  { id: "vegetariano", nome: "Vegetariano & Vegano", icone: "🌿", cor: "#5A7A4A" },
  { id: "especiais", nome: "Especiais & Festas", icone: "🎄", cor: "#9B4B6B" }
];

const apiPattern = "https://api.github.com/repos/**/contents/data/receitas.json**";

function buildRemotePayload(overrides = {}) {
  return {
    receitas: [],
    categorias: categories,
    ...overrides
  };
}

async function mockGitHubContent(page, options = {}) {
  const status = typeof options.status === "number" ? options.status : 200;
  const payload = buildRemotePayload(options.payload || {});
  const sha = options.sha || "teste-sha";
  const message = options.message || "Erro simulado";

  await page.route(apiPattern, async (route) => {
    if (status !== 200) {
      await route.fulfill({
        status,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ message })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        sha,
        content: Buffer.from(JSON.stringify(payload, null, 2)).toString("base64")
      })
    });
  });
}

module.exports = {
  apiPattern,
  categories,
  buildRemotePayload,
  mockGitHubContent
};
