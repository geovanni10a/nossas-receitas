# Nossas Receitas

Site estático em HTML, CSS e JavaScript puro com visual de livro de receitas antigo, persistência em `localStorage` e painel local para criar ou editar receitas.

## Deploy no GitHub Pages

1. Faça fork ou clone deste repositório no GitHub.
2. No repositório, acesse: `Settings` → `Pages` → `Source` → `Branch: main` → `Folder: / (root)`.
3. Clique em `Save`. Em cerca de 1 minuto, o site estará em: `https://danisepeda.github.io/nossas-receitas/`
4. Para adicionar receitas: acesse `https://danisepeda.github.io/nossas-receitas/admin.html`
5. Atenção: as receitas ficam salvas no navegador (`localStorage`). Para backup, use o botão "Exportar receitas" (a implementar na v1.1).

## Estrutura

- `index.html`: capa do livro e abertura.
- `livro.html`: índice, categorias, lista e detalhe da receita.
- `admin.html`: painel local de cadastro e edição.
- `css/`: estilos segmentados por responsabilidade.
- `js/`: persistência, navegação, busca, renderização e admin.
- `assets/`: capa e placeholder visual.

## Observações

- O projeto não usa build step e pode ser aberto diretamente pelo `index.html`.
- Os dados são pessoais e locais ao navegador/dispositivo em uso.
- No primeiro acesso, o livro começa vazio e pronto para receber suas próprias receitas.
