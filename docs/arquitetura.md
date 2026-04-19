# Arquitetura do Nossas Receitas

Nosso objetivo eh manter o projeto o mais simples possivel: HTML/CSS/JS puro hospedado no GitHub Pages, com um backend gerenciado (Supabase) que cuida da persistencia e da sincronizacao entre dispositivos. Sem build step, sem framework.

## Camadas

```
GitHub Pages (CDN estatica)
        |
        |  serve index.html, livro.html, admin.html, css/, js/
        v
Navegador do cliente
        |  js/supabase-client.js carrega @supabase/supabase-js pelo CDN
        v
Supabase Postgres + REST
        |  tabelas `receitas` e `categorias`
        +-- RLS com policies publicas de leitura e escrita
```

Nao existe servidor proprio. O navegador fala direto com o Supabase via REST e o GitHub Pages so hospeda arquivos.

## Modulos JavaScript

| Modulo | Responsabilidade |
|---|---|
| [js/supabase-client.js](../js/supabase-client.js) | Instancia o cliente Supabase e expoe `window.NRSupabase` com `listRecipes`, `listCategories`, `upsertRecipe`, `upsertCategory`, `removeRecipe`. |
| [js/storage.js](../js/storage.js) | Camada de alto nivel `window.NRStorage`. Cacheia no `localStorage`, decide quando pedir do Supabase, emite eventos `nr:sync-changed` e `nr:favorites-changed`, e normaliza receitas. |
| [js/sync-status.js](../js/sync-status.js) | Componente de badge que escuta `nr:sync-changed` e exibe `carregando`, `sincronizado`, `offline` ou `erro`. |
| [js/busca.js](../js/busca.js) | Busca textual (normalizacao NFD + lowercase) por titulo e tags, debounce. |
| [js/dom.js](../js/dom.js) | Helper `h(tag, attrs, ...children)` para montar DOM sem concatenar HTML. |
| [js/categorias.js](../js/categorias.js) | Render do indice (4 categorias fixas) e da lista de receitas por categoria, com os botoes "Abrir" e "Adicionar aqui". |
| [js/receita.js](../js/receita.js) | Render da folha de detalhe, favorito, modo cozinha e botao de editar. |
| [js/livro.js](../js/livro.js) | Roteamento interno (hash/params), transicao de pagina, busca no header. |
| [js/admin.js](../js/admin.js) | Formulario de criar/editar/excluir, compressao de foto, tags, auto-save de rascunho. |
| [js/validation.js](../js/validation.js) | `window.NRValidation.validateRecipe(...)` central com ~10 regras. |
| [js/pwa.js](../js/pwa.js) | Registra o service worker, dispara install prompt. |
| [js/utils.js](../js/utils.js) | Helpers genericos (escapeHtml, slugify de apoio, formatacao de datas). |

## Fluxo de leitura (carregar receitas)

1. [livro.html](../livro.html) carrega `js/supabase-client.js` (cria cliente Supabase) e `js/storage.js`.
2. A primeira chamada a `NRStorage.getAllRecipes()` entra em `carregar()`.
3. `carregar()` dispara `NRSupabase.listRecipes()` + `NRSupabase.listCategories()` em paralelo.
4. Ao chegar a resposta:
   - Cache em memoria: `cache = { recipes, categories }`.
   - Cache persistente: `localStorage.nr_cache_recipes` e `nr_cache_categories`.
   - `localStorage.nr_last_sync` = timestamp ISO atual.
   - Dispara evento `nr:sync-changed` com estado `sincronizado`.
5. Se `fetch` falhar (offline, Supabase fora, RLS negando), `carregar()` cai para o cache local e emite estado `offline` ou `erro`.

## Fluxo de escrita (`saveRecipe`)

```
admin.js buildRecipePayload()
      |
      v
NRStorage.saveRecipe(recipe)
      |
      |  normalizeRecipe() ajusta defaults + timestamp
      |  ensureCategoryExists() cria categoria nova se precisar
      |
      v
NRSupabase.upsertRecipe(normalized)  (POST + Prefer: resolution=merge-duplicates)
      |
      v
sucesso: invalidateCache() + noteSyncSuccess()
falha:   erro propaga e o admin mostra toast
```

A logica de retry/backoff vive dentro do SDK oficial do Supabase. O projeto nao implementa re-tentativa manual porque o fluxo tipico eh online e raramente conflita (uso familiar).

## Exclusao (`deleteRecipe`)

- `admin.js` chama `NRStorage.deleteRecipe(id)` depois de confirmar com o usuario.
- `NRSupabase.removeRecipe(id)` roda `DELETE /rest/v1/receitas?id=eq.<id>`.
- Caso o id esteja em `nr_favoritos`, ele eh removido do array.
- Cache invalidado, badge de sync atualizado, navegacao volta para `livro.html`.

## Eventos globais

Todos os modulos conversam por eventos em `window`. Isso evita estado compartilhado e facilita testes.

| Evento | Origem | Consumidores |
|---|---|---|
| `nr:sync-changed` | `storage.js` | `sync-status.js`, paginas que mostram o badge. |
| `nr:favorites-changed` | `storage.js` | `receita.js`, lista de favoritos no indice. |
| `nr:theme-changed` | `sync-status.js` / toggles | Pode ser ouvido por quem precisa recalcular pintura (ex. screenshot). |
| `nr:motion-changed` | `sync-status.js` | `livro.js` para decidir se anima transicao. |

## Cache local (`localStorage`)

| Chave | Uso |
|---|---|
| `nr_cache_recipes` | Ultima lista de receitas (serve offline). |
| `nr_cache_categories` | Ultima lista de categorias. |
| `nr_last_sync` | Timestamp ISO da ultima sincronizacao. |
| `nr_favoritos` | IDs de receitas favoritadas (ordem manual). |
| `nr_theme` | `auto`, `light` ou `dark`. |
| `nr_prefs_motion` | `auto`, `reduced` ou `full`. |
| `nr_draft_<id>` | Rascunho do formulario (auto-save a cada 5s). |

## Sincronizacao entre dispositivos

Sem token, sem login. O pacto eh simples: todo dispositivo aponta para o mesmo projeto Supabase. Como RLS libera leitura e escrita para anonimos, cada aparelho que abrir o GitHub Pages ja eh um cliente completo.

Trade-off: a chave publishable fica visivel no codigo. Se um dia isso virar problema (ex. spam ou vandalismo), a mitigacao eh ligar Supabase Auth e trocar as policies para exigir `auth.uid()` na escrita.

## PWA e offline

- [service-worker.js](../service-worker.js) mantem caches separados: `APP_SHELL_CACHE` (HTML/CSS/JS/assets), `RUNTIME_CACHE` (recursos dinamicos como fontes Google) e `RECIPE_CACHE` (para `data/receitas.json`, legado que ainda pode ser util como seed).
- Estrategia network-first para navegacao: se a rede falha, cai para o shell cacheado; se nao existir, mostra `offline.html`.
- Stale-while-revalidate para estaticos.
- O cache versionado usa o prefixo `nr-v2-supabase`; qualquer mudanca relevante deve bumpar o `VERSION`.

## Testes

- [tests/unit/](../tests/unit) com Vitest + JSDOM. Cobrem `storage`, `busca`, `validation`, `dom`, `utils`, `categorias`, `receita`.
- [tests/*.spec.js](../tests) com Playwright. Cada spec usa `mockSupabase(page, { recipes, categories })` em [tests/helpers.js](../tests/helpers.js) para interceptar chamadas ao Supabase e devolver fixtures deterministicas.
- [tests/visual-regression.spec.js](../tests/visual-regression.spec.js) captura screenshots de capa, indice, categoria, detalhe, admin e variacoes mobile/dark. Snapshots vivem em `tests/visual-regression.spec.js-snapshots/` e sao versionados.

## Convencoes de estilo

- JS em ES5-ish com `var` + funcoes nomeadas — compativel com qualquer navegador moderno sem transpile.
- DOM sempre montado via `window.NRDom.h()` ou `textContent`. `innerHTML` so para HTML ja sanitizado.
- CSS com tokens em [css/base.css](../css/base.css). Modo escuro via `[data-theme="dark"]` no `<html>`.
- Sem dependencias npm em producao. Vitest e Playwright ficam em `devDependencies`.

## Como cresce

Qualquer recurso novo de dados deveria ser uma coluna em `receitas` ou uma tabela nova no Supabase (ex. `tags`, `usuarios`, `comentarios`). A camada `js/supabase-client.js` concentra o contrato com o backend; `js/storage.js` traduz para a API que o restante do frontend consome. Fique nessa fronteira e o codigo continua simples.
