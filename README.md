# Nossas Receitas

Site estatico em HTML, CSS e JavaScript puro com visual de livro de receitas antigo, leitura publica pelo GitHub Pages e sincronizacao opcional via GitHub Contents API.

## Deploy no GitHub Pages

1. Faca fork ou clone deste repositorio no GitHub.
2. No repositorio, acesse: `Settings -> Pages -> Source -> Branch: main -> Folder: / (root)`.
3. Clique em `Save`. Em cerca de 1 minuto, o site estara em: `https://SEU-USUARIO.github.io/nossas-receitas/`
4. Para adicionar receitas: acesse `https://SEU-USUARIO.github.io/nossas-receitas/admin.html`
5. A leitura do livro funciona sem token. Para salvar receitas no repositorio, configure um token GitHub no painel admin.

## Como funciona a sincronizacao

- As receitas compartilhadas ficam em `data/receitas.json`.
- O site le esse arquivo diretamente do repositorio usando a GitHub Contents API.
- Para gravar alteracoes, o admin usa um token pessoal salvo somente no `localStorage` do navegador atual.
- Sem token, o painel ainda consegue salvar receitas apenas neste navegador como fallback local.
- Se o navegador tiver receitas antigas em `localStorage`, o painel oferece migracao automatica para o GitHub assim que um token valido for configurado.

## Como criar o token

1. Abra [github.com/settings/tokens/new](https://github.com/settings/tokens/new).
2. Em `Note`, use algo como `Nossas Receitas - Sync`.
3. Para repositorio publico, marque a permissao `public_repo`.
4. Gere o token, copie e cole em `admin.html`.

## Limites e cuidados

- O token fica salvo apenas no navegador/dispositivo onde voce o configurou.
- GitHub pode aplicar rate limit em leituras sem token. Se isso acontecer, configure um token ou aguarde alguns minutos.
- Fotos muito grandes deixam `data/receitas.json` pesado. O painel recorta e compacta a imagem antes de salvar, mas ainda vale preferir fotos leves.
- Se o arquivo JSON crescer demais, o painel bloqueia o salvamento e pede para reduzir fotos antigas.

## Estrutura

- `index.html`: capa do livro e abertura.
- `livro.html`: indice, categorias, lista e detalhe da receita.
- `admin.html`: painel de cadastro, edicao, token e migracao.
- `data/receitas.json`: base sincronizada no repositorio.
- `css/`: estilos segmentados por responsabilidade.
- `js/`: sincronizacao, persistencia, busca, renderizacao, navegacao e admin.
- `assets/`: capa e placeholder visual.

## Observacoes

- O projeto nao usa build step e pode ser aberto diretamente pelo `index.html`.
- Para testes automatizados locais, use `npm test`.
- O repositorio atual esta publicado em [github.com/geovanni10a/nossas-receitas](https://github.com/geovanni10a/nossas-receitas).
- O site atual esta em [geovanni10a.github.io/nossas-receitas](https://geovanni10a.github.io/nossas-receitas/).
