# Alumia: relatório de transparência e rótulos assináveis

Duas coisas que dão conta, para fora, do que a moderação faz: o **relatório de transparência** público e os
**rótulos e listas de bloqueio assináveis**, que deixam cada pessoa escolher em quem confia para filtrar a própria linha.

- Banco: `supabase/migracoes/20261115-alumia-o9-transparencia.sql` (roda depois de `20261114-alumia-onda8-fim.sql`; pode rodar
  duas vezes).
- Telas: `components/rede/protecao/TelaDaTransparencia.tsx` (`/alumia/transparencia`), `components/rede/rotulos/TelaDosRotulos.tsx`
  (`/alumia/rotulos`), `components/rede/rotulos/TarjaDoRotulo.tsx` (a tarja no cartão, pelo encaixe) e
  `components/rede/rotulos/PainelDaTransparencia.tsx` (o bloco do painel de controle, só a coordenação).
- Textos: `i18n/rede/rotulos/{pt,en,es,fr,ru,zh}.json`. Números e listas fechadas: `components/rede/rotulos/regras.ts`.
- Teste: `scripts/testar-alumia-o9-transparencia.mjs` (PGlite, a migração rodada três vezes sobre o `install.sql`).

## 1. O relatório de transparência

Público, para qualquer pessoa, com ou sem conta, também com a entrada da Alumia fechada (a função `public.alumia_transparencia`
fica fora da porta, e a página está em `LIVRES` do portão). Sai **por trimestre** e só tem **números agregados**.

### O que entra

| Bloco | O que conta | De onde vem |
| --- | --- | --- |
| Denúncias por tipo | recebidas no trimestre e, dessas, decididas até o fechamento (procedentes e descartadas), para cada categoria | `interno.rede_denuncias` |
| Posts tirados do ar | posts diferentes retirados (pela mediação ou pelo painel) | `interno.rede_moderacao`, ação `remover` |
| Contas | suspensas, banidas, retidas por precaução e redes barradas por prazo; cada conta conta uma vez por linha no trimestre | `interno.alumia_sancoes` e `interno.rede_moderacao` |
| Recursos | pedidos de revisão recebidos, decididos e revertidos | `interno.rede_recursos` |
| Rótulos | marcas postas, contestadas e tiradas pela mediação | `interno.alumia_rotulos_registro` |
| Pedidos de órgãos públicos | total, contas alcançadas, por tipo de órgão, por tipo de pedido e por resposta | `interno.alumia_transp_pedidos` |

### As regras do número

- **De 3 em diante, o número; abaixo disso, "menos de 3"**, também o zero. O banco nunca devolve 0, 1 ou 2 (função
  `interno.alumia_transp_n`); o teste confere cada número do relatório.
- **Nenhum número pequeno sai pela subtração.** Onde total e partes se somam (recebidas e a soma por tipo; decididas, procedentes
  e descartadas; recursos recebidos, decididos e revertidos; os três cortes dos pedidos de autoridade), um 1 ou 2 escondido
  poderia ser calculado quando todo o resto do grupo aparece. A supressão complementar (`interno.alumia_transp_proteger`) esconde
  também a menor parte à mostra do grupo, que sai como "reservado" (na tela, "sem número"), e repete até nenhum 1 ou 2 se deduzir,
  nem em cadeia. Zero que se deduz não aponta para ninguém e pode sair pela conta.
- **Nada por pessoa**: nenhum id, codinome, @, trecho de post, número de processo ou nome de quem decidiu sai do banco nesta função.
- **O trimestre sai 15 dias depois de acabar** (o quarto trimestre de 2026, de 1º de outubro a 31 de dezembro, sai em 15 de janeiro
  de 2027). A folga dá tempo de decidir o que chegou no fim dele. O trimestre corrente nunca aparece: um contador que sobe ao vivo
  ajudaria a ligar um número a um caso.
- **Gravado na primeira leitura, sem mudar depois.** Quando um trimestre pode sair, a primeira chamada grava os números da
  moderação em `interno.alumia_transp_trimestres` (só inserção: gatilhos barram alterar, apagar e esvaziar, até para o dono do
  banco). Apagar uma conta, a faxina das denúncias antigas ou uma decisão tardia não reescrevem um relatório publicado.
- **Os pedidos de autoridade são contados na hora** (não ficam gravados): a coordenação registra cada pedido com a data em que ele
  chegou, e um registro atrasado ainda aparece no trimestre certo. Uma resposta que muda (de "em análise" para "recusado") muda o
  número.
- Mostra os 12 trimestres mais recentes. O primeiro é o quarto de 2026 (`interno.alumia_transp_comeco`).

### Pedidos de órgãos públicos

A coordenação registra no painel (bloco **Transparência**) cada pedido de dados, de identificação de quem escreveu, de retirada de
conteúdo ou de preservação de dados que chegar de um órgão público. Guarda só tipos: a data em que chegou, o tipo de órgão
(Justiça, polícia, Ministério Público, Justiça Eleitoral, órgão do governo, órgão de outro país, outro), o tipo de pedido, a
resposta (em análise, atendido, atendido em parte, recusado, não tínhamos o dado), a data da resposta e quantas contas o pedido
alcançava. **Não há campo de texto**: nada de número de processo, nome, @ ou trecho. Pedido registrado **não se apaga** (não
existe a função); se errar, a coordenação corrige. Cada registro e cada correção vão para o registro do painel.

### O aviso de ordem sigilosa

No alto da página, uma frase: "Até <data>, a Alumia não recebeu nenhuma ordem judicial nem pedido de autoridade que proíba contar
que ele existe." A coordenação **renova** a frase no painel, escrevendo `NÃO RECEBEMOS ORDEM SIGILOSA` (sem diferença de
maiúsculas, acentos e espaços); a data passa a ser a de hoje. A frase vale **90 dias**. Sem renovar, a página passa a dizer
sozinha que a frase não foi renovada desde a última data (e, antes da primeira renovação, que ainda não foi publicada).

- Quem recebe uma ordem sigilosa simplesmente **não renova**: ninguém precisa escrever nada que a ordem proíba.
- Cada renovação é uma linha nova em `interno.alumia_transp_canario` (só inserção): ninguém volta a data de uma renovação.
- Só a coordenação renova e registra pedidos (`interno.alumia_painel_exige(true)`); o admin da Alumia, a vice e a mediação não.

## 2. Rótulos e listas de bloqueio assináveis

Pedido da terceira lista (L3-21), com a troca registrada no backlog: um rótulo público seria uma marca na pessoa e uma lista de
pessoas, o que a Alumia não faz. Ficou assim:

1. **Só rotula** uma organização **com selo** que abriu o serviço e escreveu as regras dela (40 a 1500 letras), ou a **mediação**
   da Alumia (uma linha só, criada pela migração). Organização que perde o selo, ou cuja conta é suspensa, para de valer na hora
   (as marcas ficam, sem efeito); fechar o serviço faz o mesmo.
2. **Lista fechada de rótulos**: assédio coordenado, golpe, spam, conta falsa e discurso de ódio. Ninguém escreve rótulo livre.
3. **O rótulo só existe para quem assina** aquele rotulador: não aparece no perfil, na busca, no cartão de quem não assina, nem
   para a própria pessoa marcada nos posts dela (ela vê em **Rótulos sobre você**).
4. **Quem assina escolhe o efeito**: **avisar** (uma tarja no cartão diz quem marcou e qual rótulo) ou **esconder** (os posts
   marcados e os posts das contas marcadas saem da linha de quem assina; é a **lista de bloqueio assinável**).
5. **Nada sai do ar** por causa de um rótulo: para quem não assina, nada muda. Tirar do ar continua sendo da denúncia e da mediação.
6. **Quem foi marcado é avisado na hora** (aviso da Alumia, sem dizer qual pessoa marcou), lê o rótulo e o motivo e **contesta**
   uma vez. A contestação vai para a fila da mediação. **Outra pessoa** da mediação decide: manter (a marca volta a valer e não se
   contesta de novo) ou tirar. Quem pôs a marca nunca decide, nem quando a marca é da mediação.
7. **O rotulador responde por cada marca**: marcar, retirar, contestar, manter e tirar vão para `interno.alumia_rotulos_registro`
   (só inserção, sem o alvo e sem chave estrangeira: apagar uma conta não reescreve o registro, e o registro não guarda quem era).
8. **Quem assina não aparece para ninguém**, nem como número. O catálogo mostra de cada rotulador só as regras, quantas marcas valem
   e quantas foram tiradas no recurso (a partir de 3).
9. Organização **não marca quem é da equipe** (coordenação, vice, mediação); ninguém marca a si mesmo, a própria organização ou os
   posts dela; até 30 marcas por hora por pessoa.

### Onde aparece

- `/alumia/rotulos`: como funciona, os rotuladores (assinar com avisar ou esconder), as marcas sobre mim (com a contestação),
  **Rotular** (para quem gere uma organização rotuladora ou é da mediação: colar o endereço do post ou o @, escolher o rótulo,
  escrever o motivo, e a lista das marcas que valem, com retirar), **Contestações para a mediação** (só para quem tem papel de
  cuidado) e **Abrir o serviço de rótulos da sua organização**.
- A tarja no cartão, pelo encaixe `anexosDoCartao` (`components/rede/rotulos/encaixe.tsx`). Os cartões de uma página pedem juntos
  (uma chamada por página, até 100 posts).

### O efeito "esconder" no banco

`interno.alumia_rotulo_esconde(post, quem)` diz se o post sai da linha de quem lê. Ela entra em `interno.rede_silenciado` (o
mesmo lugar da soneca de pessoa e de palavra), o filtro que toda lista usa.
