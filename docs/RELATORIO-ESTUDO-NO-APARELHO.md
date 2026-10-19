# Estudo no aparelho: relatório das seis fases

Ramo `estudo-no-aparelho` (criado do `master` em `fb90a5c` e atualizado com ele até o fim). **Nada foi juntado ao master, nada foi publicado e nenhuma variável de produção foi tocada.** Cada recurso entra **desligado**: sem a variável `NEXT_PUBLIC_RECURSOS`, o site se comporta como antes, com as quatro exceções listadas em "Mudanças que valem mesmo desligado".

Como ligar e testar cada recurso: `docs/RECURSOS.md`.

## Commits

| Commit | O quê |
| --- | --- |
| `e84bb77` | Flags (`lib/recursos.ts`) e dicionário próprio dos textos novos (`i18n/estudo/`) |
| `c257aad` | Meus dados: copiar, restaurar e apagar levam também o estudo guardado |
| `0989ae6` | Fase 1: Meu estudo, exercícios com explicação, revisão dos erros |
| `05259e1` | Fase 2: modelo de aula, etiqueta de revisão, checklist, créditos |
| `3a07120` | Fase 3: modo turma, professores, mapa BNCC/Enem |
| `3056725` | Fase 4: nivelamento e meta semanal |
| `451e292` | Fase 5: acessibilidade, VLibras, aula mais leve |
| `378075b` | Fase 6: guia de contribuição, "Isso ajudou?" |
| `262c732` | Peso: com tudo desligado, nada novo vai no JavaScript das páginas |
| `3ac27b7` | Kindle: links com cara de botão legíveis no modo de leitor digital |

Cada um pode ser revertido sozinho (`git revert <commit>`), na ordem inversa quando um depende do anterior.

## Fase 1: progresso local e exercícios com explicação

**Recursos:** `meu-estudo`, `exercicios`.

- **Meu estudo** (`/meu-estudo`): aulas concluídas, testes de fim de aula (com acertos), exercícios, o que revisar (exercícios do dia, caderno de erros, cartões, aulas com teste abaixo de 60%), progresso por disciplina e acertos por tema. Tudo montado no aparelho, com o que já existia (`lucia:concluidas`, caderno de erros, cartões) e as chaves novas.
- **Cópia e apagar:** reaproveita a cópia de segurança que o Caderno já tinha (mesmo formato; o progresso antigo é lido como está, sem conversão, então nada se perde). As chaves novas entram nela e, na restauração, se juntam item por item (vence o mais recente). "Apagar o meu estudo" com confirmação.
- **Exercícios** (`content/exercicios/<trilha>/<aula>.yml`, formato em `docs/EXERCICIOS.md`): enunciado; alternativas ou resposta com número; explicação do porquê; para cada alternativa errada, o engano e como corrigir; dificuldade 1 a 3; tema; status de revisão. **Todos em revisão**, com a etiqueta visível. Piloto: **30 questões originais de Matemática fundamental** em seis aulas (quatro operações, frações, decimais, porcentagem, razão e proporção, regra de três). `npm run testar:exercicios` refaz cada conta e confere que nenhuma alternativa errada tem o valor da certa.
- **Praticar** (`/meu-estudo/praticar`): à vontade (por trilha, tema e dificuldade, do mais fácil ao mais difícil) ou "revisar meus erros" com repetição espaçada simples (errou, volta amanhã; acertando, 1, 3, 7, 14 dias). Só a primeira resposta conta para a revisão.
- **Retorno:** na hora, sem nota ("Quase. Vamos ver onde escorregou:"), com "tentar de novo" e "ver a resolução". Resposta numérica aceita `3/4`, `0,75`, `1.080`, `R$ 12,50`; o que não é número não conta como erro.

## Fase 2: modelo de aula e etiquetas de revisão

**Recurso:** `revisoes`.

- **Modelo único** (`docs/MODELO-DE-AULA.md`): objetivo, explicação, exemplo resolvido, exercício, resumo, fontes. **Validador** em `lib/modelo-de-aula.ts`; `npm run pendencias` mostra o que falta, aula por aula (e `--estrito` para exigir numa trilha). É guia, não trava: hoje nenhuma das 637 aulas segue o modelo inteiro (faltam sobretudo "objetivo" e "resumo"), e todas continuam publicadas. Não mexi no texto de nenhuma aula.
- **Etiqueta** em cada aula: "Em revisão" até alguém acrescentar ao cabeçalho a linha `revisoes` (função, data; nome e nota opcionais); depois "Revisada por [função] em [data]", com o histórico. As aulas aprovadas pelo painel (`revisada: true`) aparecem como "Aprovada pela equipe". Nada recebe "revisada" sozinho.
- **Créditos:** no rodapé da aula, ao lado de "Por [autores]", entra "Revisão: [quem]".
- **Checklist** para quem revisa: `docs/CHECKLIST-DE-REVISAO.md`. **Painel de pendências** só em desenvolvimento: `/revisao-pendente` (no site publicado a página não existe).

## Fase 3: modo turma e mapa BNCC/Enem

**Recursos:** `turma`, `professores`, `mapa-curricular`.

- **Modo turma** (`/turma`): o professor escolhe as aulas na ordem, dá nome e recado e gera o link (com QR Code). A sequência vai depois do `#`, parte do endereço que o navegador nunca manda ao servidor. O aluno segue com o progresso do próprio aparelho e, se quiser, gera um comprovante (`LUCIA-…`) para entregar. O professor cola os comprovantes na mesma página, vê quem concluiu o quê e baixa uma planilha. O comprovante confere erro de cópia, e a página avisa que ele não é prova contra fraude.
- **Para professores** (`/professores`): guia de uso em sala (privacidade dos alunos, turma, comprovantes, projetar, imprimir, sem internet, Kindle) e três planos de aula originais: "Frações na feira", "Porcentagem no orçamento da família", "Proporção e regra de três no trabalho".
- **Mapa** (`content/curriculo/matematica-fundamental.yml`): as 14 aulas da piloto ligadas a habilidades da BNCC e da matriz de Matemática do Enem. **Todas as ligações estão "a confirmar"**: não consegui ler o documento oficial do MEC nesta máquina (o PDF tem a fonte codificada), então não marquei nada como conferido. O validador aceita só a forma dos códigos oficiais e confere que a habilidade do Enem pertence à competência. Aparece no fim da aula (recolhido, "para quem ensina"), nos planos e em `/professores/mapa`.

## Fase 4: nivelamento e metas gentis

**Recursos:** `nivelamento`, `metas`. Só o que faltava: a prova da trilha e o plano de estudos por trilha (com `.ics`) já existiam e continuam iguais.

- **Nivelamento** (`/nivelamento`): uma pergunta por aula (as marcadas com `nivelamento: true`; na piloto, seis), sem mostrar certo ou errado durante o teste, com "Não sei", sem nota, ranking nem rótulo. No fim, só uma sugestão de por onde começar. Pode ser pulado; fica no aparelho.
- **Meta da semana** (em Meu estudo): opcional, recomeça toda segunda, sem sequência de dias, sem pontos, sem cobrança. Lembrete semanal por arquivo de agenda (`.ics`, com aviso), que funciona com o site fechado. **Não fiz aviso do navegador**: sem um servidor guardando o aparelho, ele só apareceria com o site aberto; a página explica isso.

## Fase 5: acessibilidade, Libras e páginas leves

**Recursos:** `vlibras`, `pratica-sem-placar`.

- **Auditoria AA** (`docs/ACESSIBILIDADE-E-PESO.md`): tabela de contraste dos dois temas e varredura das páginas. Corrigido: nas peças novas, o dourado sobre o fundo dos cartões (4,13:1 no tema claro); no teste de fim de aula, o ✓/✗ só visual (agora o leitor de tela ouve "Correto."/"Ainda não.", frases já traduzidas nos seis idiomas). Registrado como recomendação (mexe em cor ou estrutura do site): o mesmo dourado nas peças antigas, o h2 do índice da trilha antes do h1 da aula, as contas que rolam para o lado no Kindle.
- **VLibras:** botão no painel de acessibilidade, com aviso claro de serviço externo do governo. Nada é baixado antes do clique (nem o código do botão, com o recurso desligado). Aponta para a versão fixa (7.12.2) do repositório oficial no jsDelivr, para onde `vlibras.gov.br/app` redireciona. A política de segurança libera, **só com o recurso ligado**, esse caminho e `*.vlibras.gov.br`, sem WebAssembly na página (o avatar roda num quadro à parte). Achado: o tradutor tenta mandar métricas para o PostHog; a política bloqueia, e ele segue funcionando. Sem a flag, a política sai **idêntica** à de antes (conferido por comparação em todas as combinações). Texto para a página de privacidade: `docs/privacidade-vlibras.md`.
- **Peso:** a prática das aulas de idioma (voz e reconhecimento de fala) ia no JavaScript de todas as aulas; agora só baixa nas que a usam. Números de antes e depois em `docs/ACESSIBILIDADE-E-PESO.md`. As fontes (385 KB pré-carregados, dos quais ~273 KB inúteis numa página em português) ficaram como recomendação: mexer nelas esbarra numa regra do Next e na regra da casa.
- **`pratica-sem-placar`:** esconde os pontos e a sequência de dias da prática de idiomas, que já existia e contraria o princípio de não gamificar.

## Fase 6: voluntários e medição

**Recursos:** `guia-contribuir`, `ajudou`.

- **Guia de contribuição** (`/contribuir/guia`, com link na página Contribuir): cinco formas de ajudar (revisar, ensinar, traduzir, escrever, programar), apontando para o que já existe (Contribuir, Voluntariado, candidatura), o passo a passo, e o modelo de aula e o checklist lidos dos próprios documentos (nunca duas versões).
- **"Isso ajudou?"** no fim da aula: resposta só no aparelho, na cópia e no apagar. Nada contado, nada enviado.
- **Medição:** três opções com prós, contras e privacidade em `docs/MEDIR-SE-AS-AULAS-FUNCIONAM.md`. **Nenhuma implementada; espera a sua decisão.**

## Mudanças que valem mesmo desligado

1. **Meus dados** (`c257aad`): "Apagar", a limpeza automática e a cópia agora levam também o estudo guardado (caderno de erros, cartões, caderno, prática, estante, laboratórios), como a página de privacidade já prometia. A restauração deixou de falhar com valores que não são JSON (o tema) e não leva mais a marca do aparelho. As chaves das conversas cifradas do painel não são tocadas.
2. **Teste de fim de aula:** o texto para leitor de tela no ✓/✗ (invisível na tela).
3. **Prática de idiomas** carregada sob demanda (invisível na tela).
4. **Kindle e parentes:** os links com fundo escuro (como "Começar pela primeira aula" de cada trilha) ficavam preto no preto no modo de leitor; agora têm fundo branco com borda. Só nesse modo.
5. **CI:** três passos novos (`testar:exercicios`, `testar:meu-estudo`, `pendencias`).

Também existem, mas respondem "não encontrado" sem as flags: as páginas novas e `/<idioma>/aulas.json`.

## Antes e depois

| Conferência | Linha de base (`fb90a5c`) | Agora |
| --- | --- | --- |
| `npm run lint` | falhava (556 erros nos interpretadores gerados; na CI, falta de memória) | 0 erros, 6 avisos (todos em arquivos antigos); o master corrigiu os ignorados no meio do caminho |
| `typecheck`, `conferir:i18n` | passavam | passam |
| `testar:interdicao` | falhava (`/estudo-em-grupo`) | passa (o master corrigiu; as rotas novas entraram na área "estudo") |
| 15 suítes antigas (banco: 1.396) | passavam | passam, iguais |
| Suítes novas | não existiam | `testar:exercicios` 116, `testar:meu-estudo` 63, `pendencias` sem erro |
| `npm run build`, recursos desligados | 19.948 páginas | passa: 20.002 páginas (as 54 a mais são as 9 rotas novas × 6 idiomas, que respondem "não encontrado") |
| `npm run build`, todos os recursos ligados | — | passa: 20.020 páginas (mais os 3 planos de aula × 6 idiomas) |
| JavaScript inicial da aula "Frações" | 717 KB (220 KB gzip) | 685 KB (211 KB gzip) |

Nos dois builds aparece, sem derrubar nada, o aviso "Failed to update prerender cache … fetch-cache": é o Windows travando um arquivo de cache durante a gravação, não o código.

Com o build de produção servido e tudo desligado, conferi: as 11 rotas novas respondem 404; a aula mostra o aviso "aguarda revisão" de sempre e nenhuma peça nova; a política de segurança não tem VLibras nem WebAssembly; a página Mais e a página Contribuir não ganham links novos.

## Visualização nos aparelhos

Conferido no navegador embutido, com o build de produção, em computador (1440 px), notebook (1366 px), celular (375 px), modo leitor de tinta eletrônica (600 × 800, como o Kindle) e modo aplicativo, nos temas claro e escuro: nenhuma rolagem para o lado no conteúdo das páginas existentes (início, disciplinas, aula, acervo, ferramentas, mural, termos, caderno, Mais) e das novas, com tudo desligado e com tudo ligado. Dois achados antigos: no Kindle, os links com fundo escuro ficavam ilegíveis (corrigido); e, para quem está logado, a saudação do cabeçalho passa 8 px da tela num celular de 375 px no navegador (registrado em `docs/ACESSIBILIDADE-E-PESO.md`). O Kindle e o aplicativo foram simulados ligando os mesmos atributos que o site liga sozinho nesses aparelhos (`data-leitor`, `data-eink`, `data-app`): **não houve teste num Kindle nem num celular de verdade**.

## O que depende de você

1. **Ligar os recursos**, quando quiser, na Vercel (`NEXT_PUBLIC_RECURSOS`), começando, se fizer sentido, por `meu-estudo,exercicios,revisoes`. Antes, uma prévia: o ramo ainda não foi enviado ao GitHub (enviar cria uma prévia na Vercel).
2. **Revisão humana:** os 30 exercícios estão "em revisão"; as ligações BNCC/Enem estão "a confirmar".
3. **Medição:** escolher entre as opções de `docs/MEDIR-SE-AS-AULAS-FUNCIONAM.md`.
4. **VLibras:** conferir o avatar num aparelho de verdade e pôr o texto de `docs/privacidade-vlibras.md` na página de privacidade no dia de ligar.
5. **Recomendações de identidade visual:** o dourado das peças antigas, as fontes pré-carregadas, a ordem dos títulos e as contas no Kindle.
6. **Traduções** dos textos novos (`i18n/estudo/pt.json`) para os outros cinco idiomas; até lá, aparecem em português com o aviso.
7. **Juntar ao master:** não fiz, como pedido.
8. **Sugestão:** a rotina de publicação (`scripts/sincronizar.mjs`) poderia gravar a linha `revisoes` (função e data de quem aprovou) quando uma aula é aprovada pelo painel. Não mexi, por ser a rotina que publica.
