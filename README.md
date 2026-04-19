# Nossas Receitas

Livro de receitas da familia com visual de caderno antigo. HTML, CSS e JavaScript puro, sem build step. O site e hospedado no GitHub Pages e as receitas ficam no Supabase, entao qualquer dispositivo com o link consulta e edita sem precisar configurar nada.

- **Site publicado:** https://geovanni10a.github.io/nossas-receitas/
- **Repositorio:** https://github.com/geovanni10a/nossas-receitas
- **Backend:** projeto Supabase `rurqwnwomrssnhxhsgfh`

## Principais recursos

- Capa, indice, 4 categorias, folha dupla com rolagem interna e transicao de pagina.
- Busca unica "Pesquisar" no header, filtrando titulo e tags.
- Modo claro, modo escuro automatico (`prefers-color-scheme`) e toggle manual.
- Favoritos locais e modo "cozinha agora" com Wake Lock para manter a tela ligada.
- Botao "Adicionar receita" abrindo formulario com upload de foto, auto-save de rascunho e pre-selecao de categoria.
- PWA instalavel com cache offline do shell, tela `offline.html` e fallback para a ultima copia das receitas.
- CSP ativa nas 3 paginas, sanitizacao de XSS e tipografia acessivel (WCAG AA).

## Deploy no GitHub Pages

1. Faca fork ou clone do repositorio.
2. No repositorio, acesse `Settings -> Pages -> Source -> Branch: main -> Folder: / (root)` e salve.
3. Em cerca de 1 minuto o site estara em `https://SEU-USUARIO.github.io/nossas-receitas/`.
4. Atualize o arquivo [js/supabase-client.js](js/supabase-client.js) com a URL e a chave publica (`publishable`) do seu projeto Supabase.
5. Pronto: qualquer dispositivo que abrir a URL do GitHub Pages ja enxerga, cria e edita receitas.

## Configurando o Supabase (primeira vez)

1. Crie um projeto novo em [supabase.com](https://supabase.com) (plano free serve). Anote a URL `https://<projeto>.supabase.co` e a chave publica `publishable`.
2. Abra o SQL Editor e rode o conteudo de [sql/schema.sql](sql/schema.sql). Ele cria as tabelas `categorias` e `receitas`, liga RLS e ja planta as 4 categorias padrao.
3. Em [js/supabase-client.js](js/supabase-client.js), substitua a URL e a chave pelas do seu projeto. A chave publishable pode ficar versionada — ela so libera leitura/escrita protegidas por RLS.
4. Opcional: ajuste as policies em `sql/schema.sql` se quiser restringir escrita a usuarios autenticados.

> Cada dispositivo novo so precisa abrir o link do GitHub Pages. Nada de token, login ou configuracao manual.

## Scripts

```bash
npm install            # instala Playwright e Vitest
npm test               # roda vitest (unit) + playwright (E2E)
npm run test:unit      # apenas unit
npm run test:e2e       # apenas Playwright
npm run test:headed    # Playwright com navegador visivel
```

A primeira vez que rodar os testes visuais `tests/visual-regression.spec.js` precisa gerar os snapshots com `npx playwright test --update-snapshots`. Depois basta `npm run test:e2e`.

## Estrutura

- [index.html](index.html), [livro.html](livro.html), [admin.html](admin.html): as tres paginas do site.
- [data/receitas.json](data/receitas.json): exemplo/seed opcional. A verdade de producao fica no Supabase.
- [sql/schema.sql](sql/schema.sql): schema e policies do Supabase.
- [css/](css): estilos segmentados (`base`, `livro`, `receita`, `categorias`, `admin`).
- [js/](js): modulos vanilla — `supabase-client`, `storage`, `sync-status`, `busca`, `dom`, `categorias`, `receita`, `livro`, `validation`, `admin`, `pwa`, `utils`.
- [tests/](tests): Playwright (E2E + visual regression) e [tests/unit/](tests/unit) com Vitest.
- [docs/arquitetura.md](docs/arquitetura.md): visao tecnica do fluxo de leitura/escrita.
- [docs/troubleshooting.md](docs/troubleshooting.md): o que fazer quando algo da errado.

## Limites conhecidos

- Fotos ficam em base64 dentro da linha da receita (limite de 100 KB para `foto` + 15 KB para `fotoThumb`).
- A chave publishable autoriza leitura e escrita publica. Sem autenticacao, qualquer pessoa com a chave pode gravar. Se isso for um problema, ative Supabase Auth e aperte as policies.
- O cache offline atualiza via service worker; apos uma troca grande de versao pode ser preciso fechar o app e abrir de novo para ver o codigo novo.
- A suite Playwright usa um servidor estatico local em `127.0.0.1:4173` e mocka o Supabase — nao bate no projeto real.

## Licenca

Uso pessoal e familiar.
