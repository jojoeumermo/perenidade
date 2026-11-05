# Departamentos fundidos e termos com texto guardado (etapa 8, B10 e B15)

SQL: `supabase/migracoes/2026-11-departamentos-termos.sql` (idempotente; vai no fim do `install.sql` na integração).
Teste: `npm run testar:departamentos-termos` (PGlite, como os `testar-banco*`).

## B10. UI/UX e Desenvolvimento, e a arte na Comunicação

| Antes | Depois |
| --- | --- |
| função `design` | vira `marketing` (Comunicação: marketing, divulgação, arte e design gráfico), com a mesma data de entrada |
| função `desenvolvimento` | mesmo id, agora chamada "UI/UX e Desenvolvimento" (cuida das telas e do código) |
| representante do departamento `design` | representante da Comunicação (`jornalismo`) |
| página do departamento Design (quadro, pedidos, bastões) | tudo vai para a página da Comunicação; a página Design some da lista |
| candidatura, inscrição, convite, aviso e pedido de ajuda endereçados a `design` | mapeados para `marketing` |

Por que ninguém perde acesso: `interno.tem('design')` já valia para quem tem `marketing` (materiais, imagens, Estúdio de design,
pedidos de arte do podcast). O Estúdio de design continua aberto a marketing, jornalismo e coordenação (`interno.desenha()`).
Quem fazia arte também não ganha acesso ao código: o diagnóstico técnico segue só da coordenação e do desenvolvimento.
Cada pessoa convertida recebe um único aviso explicando a mudança (e que o UI/UX está no outro departamento: a coordenação dá a função).

Escolhas que merecem olho da coordenação:
- O canal e o grupo de conversa `design` **não foram fundidos**: o texto já cifrado só abre com a chave do grupo. Ficam como
  "Arte e design (Comunicação)", e quem é da Comunicação (marketing) segue dentro. Dá para arquivar depois.
- O banco ainda aceita `design` como apelido (gatilho `lucia_unificar_design`), para navegador ou versão antiga do site não quebrar.
  A tela não oferece mais `design` (função `papelAposentado` em `components/painel/comum.tsx`).
- O histórico de cargos registra as trocas como feitas pelo sistema.

### Para a integração (install.sql)
Ao juntar o `install.sql`, pôr esta migração depois do bloco de `departamentos_info` e do `public.termo_meu`/`termo_voluntario_aceitar`
originais, e (opcional) tirar o `design` das listas de papéis. Não precisa: a migração em ordem final dá o mesmo resultado, e o teste
prova que instalar de novo e reaplicar não muda nada. A lista de funções públicas conferida perto do fim do `install.sql` não muda.

## B15. Termos: ninguém fica sem texto

- Termo de voluntário: o painel só abre com o aceite da versão vigente **e** o texto guardado (`interno.termos_aceites`).
- Quem aceitou "sem o texto" (só a data no perfil, com ou sem versão) ganha a versão `anterior` e volta a ver o termo ao abrir o painel.
  Antes, quem tinha a versão em branco nem via o termo. O aceite antigo continua listado para a coordenação como "antigo" até a pessoa aceitar.
- `termo_voluntario_aceitar()` agora recusa (`falta_termo`) quando não há texto guardado da versão vigente: o fluxo é sempre
  `termo_registrar` (guarda o texto, o SHA-256 e a data) e depois `termo_voluntario_aceitar`. Os testes de ponta a ponta usam `aceitarTermo` em `e2e/ajuda.ts`.
- Termo de adesão das Horas: `termo_meu()` devolve `sem_texto`; a aba Horas pede para ler e aceitar de novo (sem perder horas).
- Nada de dado novo de pessoa; a maioridade e o responsável (menor de 18) seguem como já eram, dentro do texto guardado.

## Fora do escopo
- i18n em en, es, fr, ru e zh: só o pt foi atualizado (rótulos de função da candidatura). Os demais ficam como rascunho.
