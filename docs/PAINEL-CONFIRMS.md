# Painel: confirmações e perguntas sem janela do navegador (pacote confirms)

Todo `window.confirm` e `window.prompt` do painel (components/painel, incluindo design/ e podcast/) foi trocado pelas janelas do painel novo (Radix Dialog, em `components/painel/ui/Dialogo.tsx`). São 59 confirmações e 13 perguntas, com a mesma lógica e os mesmos textos. Não há mais `alert` no painel.

## Como usar
- `await confirmarFrase("Apagar a aula? Isso não tem volta.")` devolve `true` ou `false`. A primeira frase vira o título da janela e o resto o texto. O verbo do começo vira o nome do botão ("Apagar", "Enviar", "Encerrar"). Verbos que apagam, tiram do ar ou fecham (apagar, remover, retirar, tirar, sair, encerrar, cancelar, recusar, desligar, fechar, pausar) e frases com "não tem volta" ganham o tom de perigo: o foco começa em "Cancelar", assim um Enter sem querer não destrói nada.
- `await perguntarTexto("Nome da paleta:", valorInicial)` devolve o texto ou `null` se cancelou (mesma regra do prompt antigo). Aceita `valorInicial` nulo.
- Para texto sob medida: `confirmar({ titulo, texto, confirmar, perigo })` e `perguntar({ ... })` (já existiam). Usado nas duas assinaturas de certificado de Horas, cuja declaração é longa.
- As funções que chamam precisam ser `async`; foram ajustadas.

## Tradução
`Idioma.tsx` continua trocando `window.confirm/alert/prompt` para as outras partes do site. No painel, `confirmarFrase` e `perguntarTexto` traduzem a frase inteira com `traduzirNoPainel` antes de dividir em título e texto, então o dicionário atual vale.

## Teste
`npm run testar:painel-confirms` (scripts/testar-painel-confirms.mjs) falha se sobrar `window.confirm`, `window.prompt`, `window.alert` ou chamada solta a `confirm(`, `prompt(`, `alert(` em components/painel e app/[lang]/painel (comentários ignorados), se faltar import de ui, se houver `await` sem função `async`, ou se `<DialogosDoPainel />` sair do Painel.tsx. A atribuição em Idioma.tsx não conta, porque não é chamada.

## Não feito
- Encaixe das seções nos moldes Fila, Tabela, Registro e Configuração: nenhuma foi trocada. Cada seção tem estado próprio e a troca sem conferência visual no navegador arrisca quebrar função; fica para uma rodada com revisão visual.
- Outros componentes do site (Caderno, Comentarios, IDE e outros) ainda usam confirm do navegador; não são do painel e não foram tocados.
- Sem conferência visual das janelas em celular e tema escuro.
