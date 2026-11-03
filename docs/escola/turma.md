# Turmas por curso, monitoria, círculo, seminário, orientação, banca e cartaz (E4-15)

Pacote da onda 3 da Etapa 4. Ideias D1-15, D1-16, D1-18, R1-37, R1-38, R1-39 e R1-68. Sem back-end novo: usa
`turma_curso` e `turma_curso_entrar` do E4-02 (docs/escola/banco.md), por `lib/escola/banco.ts`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `lib/escola/turma-do-curso.ts` | Puro (roda no Node): `turmaDoCurso`, `icsDosEncontros`, validação da monitoria e dos orientadores, círculos, `registroDaBanca`, frases do cartaz. |
| `content/escola/monitoria.json` | Lista curada pela coordenação. Começa vazia. |
| `content/escola/orientadores.json` | Lista curada pela coordenação. Começa vazia. |
| `components/escola/turma/TurmaDoCurso.tsx` | `EntrarNaTurma` (entrar, consentimento, sair, sala) e `CronogramaDaTurma` (semanas, progresso, .ics). |
| `components/escola/turma/Monitoria.tsx` | Monitores do mês e "Quero ser monitor(a)". |
| `components/escola/turma/Seminario.tsx` | Roteiro e cronômetro de 10 minutos com aviso aos 8. |
| `components/escola/turma/Orientacao.tsx` | Orientadores com vaga e como pedir. |
| `components/escola/turma/CirculoDeCultura.tsx` | Os 5 passos do círculo, no aparelho. |
| `components/escola/turma/BancaPopular.tsx` | Ficha de devolutiva e registro na caderneta. |
| `components/escola/turma/CartazDaTurma.tsx` | Cartaz coletivo com o componente `Cartaz`; PNG e PDF. |
| `app/[lang]/escola/turmas/page.tsx` | Lista: cursos com turma neste mês e no próximo (substitui a provisória). |
| `app/[lang]/escola/turmas/[curso]/page.tsx` | A turma de um curso. |
| `app/[lang]/escola/turmas/{circulo,banca,cartaz}/page.tsx` | As três ferramentas. |
| `app/[lang]/turmas/page.tsx` | Só um link "Turmas por curso", atrás do recurso `escola`. A Turma do mês não mudou. |
| `i18n/escola/turma/*.json` | Textos nos 6 idiomas. |
| `styles/escola-turma.css` | Visual (Caderno do Povo), 360 px de entrada. |
| `scripts/testar-escola-turma.mjs` | `npm run testar:escola-turma`. |
| `e2e/escola-turma.spec.ts` | Com as funções do banco simuladas. |

As rotas novas ficam abaixo de `/escola`, que já está em `lib/interdicao.ts` (área "estudo"): não houve linha nova lá.

## Turma do mês do curso (D1-15)

- Módulo do mês: `(ano × 12 + mês) % número de módulos` (rodízio determinístico; meses seguidos andam um módulo).
- Quatro semanas (dias 1, 8, 15 e 22), duas aulas por semana. Módulo com mais de 8 aulas entra com as 8 primeiras e o
  aviso "continua no mês que vem"; módulo menor deixa as últimas semanas para pôr em dia.
- Encontro: a primeira quarta-feira a partir do começo de cada semana, às 19h30 de Brasília (UTC−3). A quarta da semana 4
  cai sempre entre os dias 22 e 28, então nenhum encontro sai do mês. O último encontro é o seminário.
- Só cursos com pelo menos `MIN_AULAS` aulas têm turma. Este mês e o próximo vêm de `mesesDaTurma()` (lib/turma-do-mes.ts);
  as páginas se refazem a cada hora.
- O .ics leva os 4 encontros em UTC, sem duração e com o link da página do curso. Nunca leva a sala.

### Conta, consentimento e saída

- Entrar exige conta (como a Turma do mês). Sem conta, o botão explica e leva a `/entrar`.
- Curso sensível (`sensivel: true` no curso, ou `sensivel` devolvido pelo banco — hoje o Ano de formação política e
  História do Brasil e das lutas do povo): antes de entrar aparece um quadro destacado com o texto do desenho e a
  explicação da lei. Só com "Concordo" marcado o pedido sai, com `p_consentimento=true`. Sem marcar, nada é enviado.
- Base legal conferida no texto da Lei 13.709/2018 (cópia local em `leis-do-brasil`): art. 5º, II (opinião política é
  dado pessoal sensível), art. 11, I (consentimento específico e destacado), art. 8º, § 1º (cláusula destacada) e § 5º
  (revogação a qualquer momento, por procedimento gratuito e facilitado).
- "Sair da turma" fica sempre visível para quem está dentro e chama `turma_curso_entrar` com `p_entrar=false`, que apaga a
  linha no banco (em qualquer mês; o banco nunca barra a saída).
- A sala só aparece para quem entrou, no mês corrente, pelo mesmo caminho da Turma do mês (Jitsi, `lib/jitsi.ts`).
- O servidor não recebe nada além disso: o progresso de cada aula vem do aparelho.

## Monitoria (D1-16) — processo da coordenação

1. A pessoa se forma no curso (no aparelho dela) e vê "Quero ser monitor(a)" na página da turma. O botão só leva a
   `/voluntarie-se`; ela escreve "monitoria do curso X" no formulário que já existe. Nada é enviado sozinho.
2. A coordenação conversa com a pessoa, combina o horário e pede autorização para o apelido aparecer.
3. Acrescenta em `content/escola/monitoria.json` um item por mês:
   `{"curso": "slug", "mes": "AAAA-MM", "apelido": "Como quer ser chamada", "horario": "terças, 20h", "autorizacao": true}`.
4. `npm run testar:escola-turma` confere a lista. Item sem `"autorizacao": true`, com curso que não existe ou mês errado
   faz o teste falhar e a página não mostra a lista (ela só vale inteira).

**Retirar um nome:** apague o item do arquivo (ou todos os itens da pessoa) e publique. Pedido de retirada vale na hora,
sem pedir justificativa. Itens de meses passados também podem sair: a página só mostra o mês corrente.

## Orientação do projeto final (R1-38) — processo da coordenação

- `content/escola/orientadores.json`:
  `{"apelido": "…", "cursos": ["slug"], "vagasSemestre": 0 a 5, "contato": {"tipo": "rede", "valor": "@perfil"}, "autorizacao": true}`.
- Contato `rede`: o @ do perfil público na Rede Lúcia (a página manda procurar o perfil em /comunidade).
  Contato `email-do-instituto`: só o e-mail público do Instituto (`site.newsletter` em `lib/site.ts`); e-mail pessoal
  faz o teste falhar.
- A coordenação baixa `vagasSemestre` quando alguém começa a ser orientado; com 0, a pessoa some da lista do curso.
- Retirar um nome: apagar o item. O papel "mentoria" do painel continua igual.

## Círculo de cultura digital (D1-18)

Tudo no aparelho de quem facilita. Os círculos ficam em `lucia:escola:circulos` (chave reservada em
`lib/escola/estudante.ts`, entra na cópia de segurança e sai no "apagar meus dados"): no máximo 10 círculos, cada um
com até 30 palavras, tema, até 10 perguntas próprias e até `MAX_AULAS` aulas. "Apagar" e "Apagar todos" tiram do aparelho.

1. Universo vocabular: palavras e problemas, sem nomes de pessoas (a tela pede).
2. Tema gerador.
3. Problematização com 5 perguntas-guia e as que a pessoa escrever.
4. Busca local no `/<idioma>/indice-leve.json` (só aulas, mesmo motor da busca do alto) e sequência do modo turma
   (`codificarSequencia`, link com `#t=…` e QR), dentro de `MAX_AULAS`.
5. Sem aula: "Pedir aula sobre este tema" leva a `/contribuir` (o caminho de pedidos que já existe: "Uma ideia") com o
   texto do pedido pronto para copiar. O formulário não foi mudado e não recebe nada automaticamente.

**Fonte:** o artigo citado foi aberto e conferido em 03/11/2026 (PDF em
periodicos.ufes.br/prodiscente/article/view/18600/12608): GUIMARÃES, Alessandro et al. "A palavra é... Paulo Freire".
Pró-Discente, Vitória (ES), v. 23, n. 1, p. 61-78, jan./jun. 2017. O resumo diz que o artigo trabalha o pensamento de
Freire por palavras geradoras, "em um simulacro do próprio Círculo da Cultura". O artigo NÃO descreve os 5 passos: a
página diz que eles são uma adaptação do Instituto.

## Seminário (R1-37)

O último encontro do mês. Roteiro (pergunta, o que estudei, exemplo do bairro, pergunta para a turma) e cronômetro de 10
minutos com aviso aos 8, contado pelo relógio do aparelho. A inscrição é combinada na sala; nada vai ao servidor.

## Banca popular online (R1-39)

Roteiro de 30 minutos (10 de apresentação, 15 de conversa, 5 de devolutiva), três pessoas (educador, colega, alguém do
território). Ficha por competência (clareza, ligação com o curso, ligação com a vida, próximo passo), sem nota, para
imprimir ou preencher. "Registrar na minha caderneta" chama `acrescentarNaCaderneta({tipo: 'banca', curso, data,
titulo: 'Projeto apresentado em banca', detalhe, pessoas})`. Nomes só com a caixa de permissão marcada. O E4-14 lê o
registro como projeto "banca". A banca presencial fica para depois. **Feito pelo E4-14:** `bancaDoCurso` e `apresentacaoFeita` (lib/escola/formatura.ts) leem esse registro e marcam a etapa "apresentação" do projeto final (docs/escola/formatura.md).

## Cartaz da turma (R1-68) — processo da Galeria

1. Quem facilita escolhe o curso, confere o semestre e digita uma frase de cada pessoa (até 24, de até 140 caracteres).
   Sem nome completo: a tela avisa quando a frase parece ter um. As frases ficam só na memória da página.
2. "Baixar imagem (PNG)" desenha o cartaz no aparelho; "Imprimir ou salvar em PDF" usa a impressão do navegador (só a
   folha sai no papel).
3. Com a turma de acordo, alguém envia o PNG pela Gaveta Aberta (`/gaveta`), no formulário que já existe: tipo "outro",
   licença CC BY-SA 4.0. Nada é preenchido nem enviado automaticamente (o preenchimento é do E4-14).
4. A coordenação confere (sem nome completo, sem rosto, licença certa) e acrescenta o cartaz em `content/galeria.json`.

## Testes

- `npm run testar:escola-turma`: rodízio, módulo grande, mês seguinte, quartas certas em 5 anos de meses, .ics,
  validação da monitoria e dos orientadores (sem autorização falha), listas reais, sequência dentro de `MAX_AULAS`,
  círculos (no máximo 10), registro da banca, aviso de nome, páginas e textos do consentimento.
- `e2e/escola-turma.spec.ts` (`NEXT_PUBLIC_RECURSOS=escola npm run dev:local`): lista, sem conta leva a /entrar, curso
  sensível sem "Concordo" não chama a função, sair manda `p_entrar=false`, cronograma e .ics, círculo gera link, banca
  registra na caderneta, cartaz exporta, 360 px.
