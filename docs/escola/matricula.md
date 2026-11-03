# Matrícula, carteirinha, plano da semana e quem volta (E4-08)

Pacote da onda 2 da Etapa 4 (ideias D1-9, D1-10 e R1-52). Tudo fica **no aparelho** de quem estuda. O servidor só recebe um +1 anônimo de matrícula (`contar_escola`, do E4-02). Índice da Escola: [docs/ESCOLA.md](../ESCOLA.md).

## O que tem

| Peça | Arquivo | O que faz |
| --- | --- | --- |
| Matrícula | `app/[lang]/escola/matricula/page.tsx`, `components/escola/matricula/FluxoDaMatricula.tsx` | uma pergunta por tela, nivelamento opcional, sugestão de cursos, apelido opcional, tela final; para quem já tem: editar, refazer, trancar curso, apagar |
| Pergunta | `components/escola/matricula/PerguntaDeVida.tsx` | botões grandes, "Voltar", "Pular" e "Ouvir a pergunta" (leitor das aulas, `lib/vozes/leitor.ts`) |
| Sugestão | `components/escola/matricula/SugestaoDeCursos.tsx` e `lib/escola/matricula.ts` | de 1 a 3 cursos, por regra (`sugerirCursos`), com caixa de marcar |
| Carteirinha | `app/[lang]/escola/carteirinha/page.tsx`, `components/escola/carteirinha/Carteirinha.tsx` e `BaixarCarteirinha.tsx` | frente e verso, imprimir do tamanho do cartão, baixar imagem (PNG) |
| Plano | `app/[lang]/escola/plano/page.tsx`, `components/escola/plano/PlanoDaSemana.tsx` e `lib/escola/plano.ts` | plano da semana por regra local, sem IA |
| Quem volta | `components/escola/QuemVolta.tsx`, no bloco 4 de `app/[lang]/escola/page.tsx` | mini-carteirinha, hoje no plano, continuar o curso, presença somada; ou o convite |
| Servidor | `lib/escola/matricula-servidor.ts` | cursos resumidos, título e minutos de cada aula, perguntas de nivelamento das trilhas dos cursos, textos |
| Textos | `i18n/escola/matricula/{pt,en,es,fr,ru,zh}.json` | todos os textos, nos 6 idiomas |
| Estilo | `styles/escola-matricula.css` | opções grandes, carteirinha (classes `.certificado-*` e as mesmas cores), impressão |
| Testes | `scripts/testar-escola-matricula.mjs` (`npm run testar:escola-matricula`) e `e2e/escola-matricula.spec.ts` | ver abaixo |

## Matrícula (D1-9)

1. **O que te traz aqui?** Os 6 objetivos de `lib/escola/estudante.ts`, com ícone e frase simples.
2. **Quanto tempo por semana você tem para estudar?** Os 4 tempos.
3. **Como é a sua internet?** O pacote acaba / tenho wi-fi em casa / estudo no computador ou no Núcleo.
4. **Quer descobrir por onde começar?** Só aparece quando há perguntas de nivelamento para as trilhas dos cursos (recurso `nivelamento` ligado). Usa o componente do site (`components/estudo/Nivelamento.tsx`) sem reescrever. As perguntas são só as das trilhas dos cursos que combinam com o objetivo, para o aparelho não baixar as 300 trilhas. As trilhas em que o nivelamento sugeriu por onde começar viram `matricula.nivelamento`.
5. **Cursos para começar** (`sugerirCursos`). Só aparece quando há cursos em `content/escola/cursos`.
6. **Apelido** (opcional, até 40 caracteres) e **Fazer minha matrícula**.

**Pular:** objetivo "outro", tempo "até 1 hora" (o plano nasce pequeno) e internet "wi-fi em casa" (não oferece o modo leve a quem não pediu). Os valores estão em `PADROES_AO_PULAR` e dá para mudar depois.

**Fazer minha matrícula:** `novaMatricula` e `gravarMatricula`; `inscrever` em cada curso marcado; `contarEscola('escola_matricula', curso, 'semestre')` por curso marcado. Sem curso marcado, o alvo é `escola`. Ao refazer, só conta curso novo, porque as marcas do aparelho seguram a repetição no semestre.

**Tela final:** "Matrícula feita neste aparelho. Seu número: LM-XXXX-XXXX", com o selo de privacidade "aparelho", os links Carteirinha e Plano da semana e o aviso "Trocou de celular? Faça a cópia de segurança em Meus dados". Para quem disse "o pacote acaba", a tela também mostra o convite da economia de dados (o modo leve que já existe). O botão abre o painel de acessibilidade pelo evento `lucia:abrir-acessibilidade`. O convite do modo pacote é do E4-17.

**Quem já tem matrícula** vê a matrícula, em vez das perguntas:
- editar as respostas: o número e a data ficam (`editarMatricula`);
- refazer as perguntas: o número fica, e os cursos que a pessoa já tinha continuam;
- trancar e voltar a cada curso;
- apagar, com confirmação. O apagar usa `apagarEscola()` e leva **tudo** o que a Escola guardou no aparelho. As aulas marcadas como feitas ficam.

Com `?curso=<slug>` (vindo do catálogo), esse curso vem primeiro na sugestão. Para quem já tem matrícula, aparece um quadro "Entrar neste curso". O parâmetro é lido no navegador, e a página continua estática.

**Rascunho:** as respostas em andamento ficam no `sessionStorage` da aba (`lucia:escola-matricula-rascunho`). Quem sai para ver um curso, ou cai num link do nivelamento, volta de onde estava. Ao fechar a aba, o rascunho some. Não é `localStorage`, por isso não entra na cópia de segurança.

### Regra da sugestão (`lib/escola/matricula.ts`, puro)

`sugerirCursos(matricula, cursos, nivelamento, pedido)` devolve `{ cursos: 1 a 3, antes }`:
- entram os cursos cujo `objetivos` tem o objetivo da pessoa;
- a ordem é esta: ciclo básico sem requisitos primeiro; depois o curso com aula de uma trilha que o nivelamento sugeriu; depois menos requisitos, o ciclo mais cedo e, por fim, o slug;
- se nenhum curso combina, entram os de começo livre (ciclo básico sem requisitos); se não há nenhum desses, entram os outros;
- `?curso=` vem primeiro, quando existe;
- curso de **mais de 80 h** para quem tem **até 1 h por semana** recebe "comece pelo módulo 1";
- `aprender-a-estudar`, se existir, sai da lista e aparece à parte como "antes de um curso longo, se quiser". A exceção é quando ele foi o pedido.

As horas são as estimadas por `horasDoCurso` (E4-01). São **estimativa**, não carga horária oficial.

## Carteirinha (D1-10)

Gerada no aparelho, sem servidor. Não chama `certificado_aluno_emitir`, que guarda nome no servidor.

- **Frente:** "Escola Lúcia Maria", o apelido (ou "Estudante"), o número, o curso atual (a inscrição em andamento mais recente), o semestre (`semestreDe`, pelo calendário proposto da Escola), "Desde AAAA" e a foto ou as iniciais. A foto só aparece se a conta tiver uma imagem guardada no aparelho em `KEYS.avatar` (`lucia:avatar`, só `data:image/…`). A pessoa pode desligar. O rosto é um círculo, não uma foto 3x4.
- **Verso, em destaque:** "Esta carteirinha não é documento oficial e não vale como carteira de estudante para meia-entrada. Foi feita neste aparelho; nada foi enviado." Logo abaixo: "A meia-entrada pede a Carteira de Identificação Estudantil (CIE), emitida pelas entidades estudantis indicadas na Lei nº 12.933/2013 (art. 1º, § 2º)." Também o QR e o endereço da entrada da Escola, uma página pública sem dado da pessoa.
- **Fonte da lei:** `leis-do-brasil/federal/leis-ordinarias/2013/lei-12933-2013-12-26.md`, texto compilado e vigente, baixado em 13/10/2026. O art. 1º, § 2º, diz que a CIE é emitida pela ANPG, pela UNE, pela Ubes, pelas entidades estaduais e municipais, pelos DCEs e pelos Centros e Diretórios Acadêmicos. A expressão "filiadas àquelas" foi declarada inconstitucional na ADI 5.108. Por isso a frase do site fala só em "entidades estudantis indicadas na lei", sem listar nenhuma.
- **Sem cara de documento:** não tem brasão, selo oficial, foto 3x4 obrigatória nem campo de documento. As classes e as cores são as do certificado (`.certificado`, `.certificado-folha`, `app/globals.css`), sem paleta nova.
- **Tamanho:** 85,6 x 54 mm. Na tela, a medida está em `cqw`.
- **Imprimir:** segue o padrão do `CertificadoDaTrilha`. A página põe `@page { size: 85.6mm 54mm; margin: 0 }` e chama `window.print()`. As duas faces ficam num bloco filho direto do `<body>` (`.carteirinha-impressao`). Na impressão, o resto do `<body>` some e saem duas páginas do tamanho do cartão.
- **Baixar imagem:** as duas faces são desenhadas num canvas, com o aviso. O PNG vai por `navigator.share({ files })` quando o aparelho deixa e, se não deixar, por download.
- **Sem matrícula:** convite para fazer.

## Plano da semana (R1-52)

Feito no aparelho por **regras simples, não por IA**, e a tela diz isso. O "agente do plano" do R1 virou esta regra local.

`lib/escola/plano.ts` (puro):
- `montarPlano({tempo, inscricoes, concluidas, cursos, minutosDaAula, hoje, dias, meta, calma})` monta o plano assim:
  - pega as próximas aulas pendentes dos cursos em andamento, na ordem de cada curso, alternando entre os cursos;
  - pula as trilhas dispensadas e as aulas que não existem (0 minuto);
  - distribui dentro do orçamento da semana: até 1 h = 60 min, 1 a 3 h = 150, 3 a 6 h = 270, mais de 6 h = 420;
  - usa os dias escolhidos (padrão: segunda, quarta e sexta). Cada dia recebe a sua parte do tempo;
  - uma aula maior que a parte do dia entra sozinha, se couber na semana;
  - quem monta no meio da semana não recebe aula nos dias que já passaram. Sem dia pela frente, monta a semana seguinte;
  - com **meta semanal** no Meu estudo (`lerMetas`), vale o número de aulas da meta.
- `reajustar(plano, concluidas, hoje, ultimaAtividade)`:
  - o que não foi feito num dia que passou vai para o próximo dia de estudo que ainda vem (o primeiro em que cabe). Sem dia pela frente, fica para a semana que vem. Nunca usa a palavra "atrasado";
  - com **14 dias sem aula feita**, oferece "Recomeçar com calma", com metade do tempo. A conta usa o último dia com aula feita, dentro ou fora do plano (`lucia:concluidas-em`), e, sem nenhum, o dia do primeiro plano.
- `planoDeHoje(guardado, entrada)`: o plano guardado, reajustado. Se é de outra semana, monta um novo com os mesmos dias e a mesma calma.
- Fica guardado em `lucia:escola:plano`: `{versao, semana 'AAAA-Www', dias:[{data, aulas, minutos}], feitoEm, diasDaSemana, minutosDaSemana, meta, calma, minutosDe, feitas, comecouEm, ultimoFeito, paraDepois, oferecerCalma}`. Entra na cópia de segurança pelo prefixo da Escola.
- A semana é a ISO 8601, que pode ser do ano anterior ou do seguinte na virada do ano. O teste confere.
- As datas são as do relógio do aparelho: a semana é de quem estuda, onde estiver.

`PlanoDaSemana.tsx`:
- hoje em destaque (`aria-current="date"`);
- aulas com link, e o "feito" lido de `lucia:concluidas`;
- frases de acolhimento ("Semana corrida? Tudo bem, a gente ajusta.");
- troca de dias;
- "Lembrete no calendário" (`icsSemanal` de `lib/agenda.ts`, um `.ics` baixado no aparelho).

## Quem volta

O bloco 4 da entrada da Escola.

Para quem tem matrícula:
- a mini-carteirinha, com apelido e número;
- "Hoje no seu plano" (só lê o plano, não grava);
- "Continuar o curso", com `proximaDoCurso` do curso atual; sem curso, a última aula aberta (`useLastLesson`).

Sem matrícula, o convite.

A presença somada (E4-02) aparece nos dois casos. A especificação a punha só para quem tem matrícula, mas são somas anônimas. Assim, o `e2e/escola-presenca.spec.ts` do E4-02 também confere a entrada de quem chega pela primeira vez.

Todo o conteúdo é de cliente. O servidor manda um espaço neutro ("abrindo…"), igual na hidratação, como em `components/estudo/guardado.ts`.

## Privacidade

- Não pede nome completo, CPF, e-mail, telefone nem endereço. O apelido é opcional, fica só no aparelho e a dica pede para não usar o nome completo.
- A matrícula, as respostas, o apelido, os cursos, o plano e a carteirinha não saem do aparelho.
- Sai só o `contar_escola('escola_matricula', <curso ou 'escola'>)`. É anônimo: a chave do freio no banco não leva o alvo (docs/escola/banco.md), e sai uma vez por semestre e aparelho. A tela final diz que esse +1 saiu.
- O QR leva só para a página pública da Escola.

## Testes

- `npm run testar:escola-matricula` (Node, sem rede). Confere:
  - `sugerirCursos`: cada objetivo, `?curso=`, tempo curto, sem cursos e `aprender-a-estudar`;
  - `trilhasDoNivelamento`, `editarMatricula` e os dados da carteirinha;
  - `montarPlano`: orçamento, dias, montado no meio da semana e no sábado, dispensas, aula e curso que não existem, curso trancado, aula grande, meta e calma;
  - `reajustar`: o que não foi feito anda, duas vezes dá o mesmo, sem dia pela frente, duas semanas paradas;
  - a semana ISO na virada do ano;
  - os textos nos 6 idiomas (aviso da meia-entrada, "sem IA", sem "atrasado").

  Os cursos de teste ficam no próprio script, não em `content/`.
- `e2e/escola-matricula.spec.ts` (computador e celular, com `NEXT_PUBLIC_RECURSOS=todos,escola`). Confere:
  - a matrícula completa em /pt, sem campo de dado pessoal e sem o número ou o apelido nos pedidos de rede;
  - "Voltar" e "Pular";
  - a carteirinha com o número e o aviso de meia-entrada;
  - a impressão (emulação de mídia de impressão: duas faces de 85,6 mm);
  - o plano com 3 dias (pulado sem cursos do E4-07);
  - o apagar com confirmação;
  - /en traduzido;
  - sem rolagem lateral em 360 px;
  - o leitor de tinta;
  - o "quem volta".

## Pendências

- **Reconferir depois que o E4-07 estiver no master.** Com os cursos de verdade, é preciso conferir a sugestão, as horas, o "comece pelo módulo 1", o `aprender-a-estudar` e o plano com aulas. Também vale rodar o e2e do plano, que hoje é pulado sem cursos.
- **Coordenação:** confirmar a frase do verso da carteirinha e a citação da lei. A redação segue o desenho, e a lei foi lida no texto compilado. Confirmar também os valores de "Pular" (`PADROES_AO_PULAR`). [A REVISAR PELA COORDENAÇÃO]
- O semestre da carteirinha segue o calendário **proposto** (`content/escola/ano-letivo.json`, `"confirmado": false`).
