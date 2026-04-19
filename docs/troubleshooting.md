# O que fazer quando algo estranho acontecer

Este guia eh pra quem so quer que o livro de receitas funcione. Se nada aqui ajudar, manda foto da tela para quem cuida do projeto.

## "A pagina abriu em branco"

- Fecha a aba, abre de novo.
- Se continuar branco, tenta abrir em uma aba anonima / privativa.
- Se mesmo assim nao abrir, pode ser que o servidor da Supabase esteja fora do ar. Volta daqui 5 minutos.

## "As receitas nao aparecem"

1. Olha o canto onde tem o texto de status: pode estar escrito `Offline` ou `Sem conexao`. Verifica o Wi-Fi do aparelho.
2. Se estiver escrito `Erro`, clica no botao `Atualizar agora` ao lado.
3. Se continuar vazio, volta pra capa e tenta abrir o livro de novo.
4. Ainda vazio? Provavelmente o Supabase esta fora. Em geral volta sozinho em alguns minutos.

## "Salvei uma receita mas nao apareceu em outro celular"

- No outro celular, puxa a tela pra baixo pra recarregar, ou clica no botao `Atualizar agora`.
- Receitas sincronizam em segundos, mas cada dispositivo precisa recarregar pra ver o que foi gravado.
- Se continuar nao aparecendo, verifica se os dois aparelhos estao abrindo a mesma URL (`https://geovanni10a.github.io/nossas-receitas/`).

## "Apaguei uma receita sem querer"

- Se foi ha poucos segundos e ainda esta na mesma aba, nao da pra desfazer direto. Mas se voce ainda tem outro aparelho com a receita aberto na tela (por exemplo, um celular da familia), **nao recarregue esse aparelho** — copia os ingredientes e passos para um bloco de notas, e cadastra a receita de novo pelo botao `Adicionar receita`.
- O Supabase guarda um backup automatico (Point-In-Time Recovery). Se a receita for importante, avise quem administra o projeto pra restaurar.

## "A foto da receita fica torta ou cortada"

- O sistema corta a foto no centro em formato proximo de quadrado (600x600). Se a parte importante nao estiver no meio, fotografa de novo com o prato centralizado.
- Fotos muito grandes (acima de 5 MB) podem demorar pra processar. Tente escolher uma imagem menor ou tire direto do celular.

## "Aparece `Nao foi possivel falar com o Supabase`"

- 9 em cada 10 vezes eh queda momentanea. Espera 1-2 minutos e clica em `Atualizar agora`.
- Se persistir por mais de 10 minutos, olha o [status do Supabase](https://status.supabase.com). Se estiver tudo verde la, chama quem cuida do projeto.

## "Quero usar o livro sem internet"

- Funciona, desde que o aparelho ja tenha aberto o site pelo menos uma vez com internet.
- Abre o site normalmente: ele mostra as receitas que ja estavam carregadas na ultima visita.
- Receitas criadas offline nao sincronizam ate voltar a internet — evita gravar coisa importante sem conexao.

## "Como instalo o livro como app?"

- No Chrome (Android ou desktop), abre o menu e escolhe `Instalar Nossas Receitas` (ou `Adicionar a tela inicial`).
- No Safari do iPhone, toca no botao de compartilhar e depois em `Adicionar a Tela de Inicio`.
- Depois de instalar, o icone do livro aparece igual a um app e abre em tela cheia.

## "Quero mudar pra modo escuro / claro"

- Clica no icone de sol/lua no topo de qualquer tela.
- Ele alterna entre `auto` (segue o sistema), `claro` e `escuro`. A escolha fica salva no proprio aparelho.

## "Quero tirar uma receita dos favoritos"

- Abre a receita no livro e clica no coracao que fica no topo dela. Ele vira coracao vazio.

## "Quero comecar do zero as receitas no Supabase"

1. Entra no painel do Supabase do projeto.
2. Em `Table editor`, seleciona `receitas` e clica em `Delete all rows`.
3. Opcionalmente, repete para `categorias` (mas depois precisa rodar o script de seed em [sql/schema.sql](../sql/schema.sql) pra voltar as 4 categorias padrao).
4. No livro, clica em `Atualizar agora` ou recarrega a pagina.

## "O site esta mostrando uma versao antiga"

- O service worker pode estar entregando cache velho. Faz isso:
  1. Abre a aba de `DevTools` (F12) -> `Application` -> `Service Workers`.
  2. Clica em `Unregister` no service worker do site.
  3. Recarrega a pagina.
- Em celular, entra em `Configuracoes -> Apps -> Nossas Receitas -> Armazenamento -> Limpar cache`, ou desinstala e instala o app novamente.

## Contato

- Duvidas tecnicas: abra uma issue em [nossas-receitas/issues](https://github.com/geovanni10a/nossas-receitas/issues).
- Problema familiar: chama no grupo da familia.
