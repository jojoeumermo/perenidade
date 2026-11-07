# Vale o Escrito: o robô de coleta

O robô (`scripts/vale-o-escrito/coletar.mjs`, Node puro, sem dependências) lê as fontes abertas, filtra, **baixa a matéria**
e põe na **fila da curadoria** um **rascunho completo** da entrada, no formato `Entrada` de `lib/vale-o-escrito/tipos.ts`.
Ele não publica nada. A aprovação continua humana: a curadoria confere a fonte, a situação jurídica e as pessoas, e só
publica com **fonte oficial e situação jurídica preenchidas** (decisão da coordenação).

## O que ele faz, em ordem

1. Lê `content/vale-o-escrito/fontes.json` (48 fontes do catálogo; campo `acesso`: `aberto`, `cadastro-gratuito`,
   `sem-acesso` ou `so-link`; campo `leitor`: `rss`, `querido-diario` ou `null`). Hoje lê RSS/Atom (também RSS 1.0/RDF,
   o formato dos portais gov.br) e a API aberta do Querido Diário (sem cadastro). Desde 07/11/2026 também lê o RSS de
   notícias do **IBAMA** (fonte oficial: `gov.br/ibama/pt-br/assuntos/noticias/RSS`) e o da **Human Rights Watch** em
   português (`hrw.org/pt/rss/news`), os dois conferidos com curl. As demais ficam como link para a curadoria até alguém
   escrever o adaptador.
2. Filtra pelas palavras (`temas`) dos 6 dossiês de `content/vale-o-escrito/dossies.json` (sem acento, início de palavra).
3. Tira repetidos por link (sem `utm_*`, sem `#`, sem barra final) e o que é mais velho que a janela (`--dias`, padrão 7).
   Texto que fala de criança ou adolescente é descartado.
4. **Baixa a matéria** (só HTML, até 2 MB, 20 s) e tira dela só o texto: título, `og:description`,
   `article:published_time` (ou o JSON-LD `NewsArticle`), `og:site_name` e os parágrafos de `<article>` (sem menu, rodapé,
   "assine a newsletter"). A página nunca é guardada.
5. **Não é caso?** Se o título, a descrição e o começo da matéria não têm nenhuma palavra de crime, denúncia, investigação
   ou violação (inquérito, operação, denúncia, multa, despejo, grilagem, trabalho escravo, desvio, improbidade...), a
   matéria é marcada `naoECaso` e **não vira sugestão**. Com IA, ela também pode marcar `naoECaso: true`.
6. **Estrutura o rascunho.** Com chave de IA gratuita (rodízio abaixo), a IA devolve JSON a partir do texto da matéria e o
   robô **confere tudo**; sem chave (ou sem cota, ou depois do orçamento de tempo), a extração é por **heurística**.
7. **Arquiva no Internet Archive** (Save Page Now) e põe o link em `fontes[0].arquivoUrl`; se falhar, `arquivoFalhou: true`
   (a curadoria tenta de novo na aprovação). Até `--max-arquivo` cópias por rodada (padrão 40).
8. Grava com `public.vale_robo_sugerir` (chave de serviço). Link repetido o banco ignora. O rascunho vai na coluna
   `vale_fila.rascunho` (JSON livre), que a tela da curadoria já abre preenchida (`rascunhoDoItem`).

## O rascunho que chega à fila

| Campo | Com IA | Sem IA (heurística) |
|---|---|---|
| `titulo` | título claro e neutro da IA (sem nome inventado) | título da matéria, sem o " \| Veículo" do fim |
| `resumo` | 2 a 4 frases, com "segundo <veículo>" (conferido) | "Segundo <veículo>, " + até 3 frases do começo da matéria |
| `dataDoFato` | a da IA, se não for depois da publicação | primeira data por extenso do começo da matéria; senão o mês da publicação (AAAA-MM) |
| `lugar` | UF e município da IA, conferidos na lista do IBGE | primeiro município citado (preferindo o do estado citado); senão a UF |
| `organizacoes` / `organizacoesPublicas` | as da IA (nome tem de estar no texto) + órgãos conhecidos | lista de órgãos conhecidos (PF, MPF, MPT, Ibama, Funai, TCU, STF...) e empresas (Ltda., S.A., "empresa X") |
| `pessoas` / `pessoasPublicas` | só com nome no texto, papel da lista e **situação jurídica dita no texto** | **nenhuma** (a heurística não tira nome de ninguém) |
| `situacao` (do caso) | só se a IA a leu no texto | **em branco**; a leitura da heurística vai em `situacaoSugerida` e na nota |
| `fontes[0]` | veículo, tipo (`dado_oficial` para fonte oficial, `reportagem`, `relatorio_organizacao`, `checagem`), título, link, **trecho literal** (20 a 400), data, `acessadoEm`, `arquivoUrl` ou `arquivoFalhou` | igual; o trecho é a primeira frase longa da matéria |
| `confianca` | `primaria` só para fonte oficial; senão `reportado` | igual |
| `etiquetas` | da IA + temas do dossiê | temas do dossiê |
| `revisao`, `notaDaCuradoria` | `pendente-curadoria` e uma nota dizendo o que conferir | igual |

Campos de apoio (`fonteNome`, `extracao`, `situacaoSugerida`, `dataPublicacaoDaMateria`) ficam no rascunho para a tela;
`limparDoc` os tira antes de gravar a entrada aprovada.

## O que a conferência da resposta da IA derruba

- Resumo com mais de 4 frases ou mais de 1.000 caracteres, sem "segundo <veículo>", ou com nome próprio que não está no
  texto da fonte: cai, e entra o resumo da heurística.
- Título com nome inventado: cai, e entra o título da matéria.
- Trecho que não é **literal** (paráfrase): cai, e entra o trecho da heurística.
- Pessoa cujo nome não está no texto, com papel fora da lista, sem situação jurídica válida, ou que menciona vítima,
  criança, adolescente ou testemunha em qualquer campo: sai. CPF nunca.
- Organização cujo nome não está no texto: sai. UF fora da lista: sai. Data fora do formato: sai.
- O texto da fonte vai entre marcas e o prompt manda tratá-lo como dado, nunca como ordem.

## IAs gratuitas que o robô usa (rodízio)

O robô começa cada pedido pelo provedor seguinte; quem responde 429, 402, 401 ou 403 sai do rodízio até o fim da rodada;
sem nenhum, a heurística assume. Basta **uma** chave para funcionar; com várias, a cota soma. Os limites abaixo são os do
plano gratuito como estavam publicados em novembro de 2026 e **mudam sem aviso**: confira na página de cada um.

| Provedor | Segredo | Modelo padrão (troque com a variável) | Limite gratuito (aprox.) | Como criar a chave |
|---|---|---|---|---|
| Google AI Studio (Gemini) | `GEMINI_API_KEY` | `gemini-2.5-flash` (`GEMINI_MODEL`) | por projeto, varia por modelo; veja aistudio.google.com/rate-limit (zera à meia-noite do Pacífico) | aistudio.google.com → entrar com conta Google → "Get API key" → "Create API key" |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` (`GROQ_MODEL`) | cerca de 30 pedidos/min, 1.000 pedidos/dia e 100 mil tokens/dia nesse modelo (por organização) | console.groq.com → entrar → "API Keys" → "Create API Key" |
| Cerebras | `CEREBRAS_API_KEY` | `gpt-oss-120b` (`CEREBRAS_MODEL`) | teste gratuito: 5 pedidos/min, 1 milhão de tokens/dia | cloud.cerebras.ai → entrar → "API Keys" → gerar |
| OpenRouter (só modelos `:free`) | `OPENROUTER_API_KEY` | `meta-llama/llama-3.3-70b-instruct:free` (`OPENROUTER_MODEL`) | 20 pedidos/min; 50 por dia (1.000 por dia com US$ 10 de crédito comprado); saldo negativo bloqueia até os gratuitos | openrouter.ai → entrar → "Keys" → "Create Key" (não precisa de cartão para os `:free`) |

Cada rodada faz no máximo `--max-ia` pedidos (padrão 50), uma rodada a cada 2 horas: até 600 por dia. A conta, com os
limites da tabela: Groq aceita até 1.000 pedidos/dia, mas os 100 mil tokens/dia dão só umas 30 matérias; a Cerebras, com
1 milhão de tokens/dia, umas 300; o OpenRouter, 50; o Gemini, o que o painel da conta mostrar. Com as quatro chaves, os
600 cabem na cota gratuita somada; com menos chaves, quem esgota responde 429, sai do rodízio e o resto da rodada sai pela
heurística (nada quebra, nada é cobrado: nenhum dos quatro cobra sem cartão cadastrado). Privacidade: só vai para a IA o texto público da matéria; nenhum dado de quem usa o site. Os
planos gratuitos podem usar o que recebem para melhorar os modelos (veja os termos de cada um): por isso nada interno
(nota, contato, envio do público) é mandado.

Fontes dos limites (consultadas em 05/11/2026): documentação de limites do Google AI Studio, da Cerebras
(inference-docs.cerebras.ai/support/rate-limits) e guias públicos que citam a documentação do Groq e do OpenRouter (as
páginas oficiais dos dois não responderam do ambiente de desenvolvimento). Na dúvida, vale o painel da sua conta.

## Internet Archive (Save Page Now)

- Sem chave: pedido anônimo `GET https://web.archive.org/save/<link>`; o link da cópia vem no cabeçalho
  `Content-Location`. É mais lento e tem limite menor por IP.
- Com chave (recomendado): crie a conta em archive.org e pegue as chaves em **archive.org/account/s3.php** ("S3-like API
  keys"); guarde como segredos `ARCHIVE_ACCESS_KEY` e `ARCHIVE_SECRET_KEY`. O robô usa a API (SPN2: pede e acompanha o
  job até a cópia sair). A chave vai em cabeçalho, nunca na URL.
- Só links públicos http(s): endereço local, de rede interna ou do próprio Internet Archive é recusado (a mesma regra de
  `enderecoParaArquivar`, em `lib/vale-o-escrito/curadoria.ts`).

## Regras que o código cumpre

- Só trecho (até 400 caracteres), link, data e a cópia no Internet Archive; nunca a página inteira.
- Fonte `agregado: true` (vítimas, estatística) **não gera sugestão por item**: só números.
- Texto que fala de criança ou adolescente é **descartado** (ECA, Lei 8.069/1990, arts. 17, 143 e 247; LGPD, Lei
  13.709/2018, art. 14). A curadoria pode lançar à mão, se for de interesse público e sem identificar a criança.
- Nunca vítima, criança, adolescente ou testemunha como pessoa (mesma lista de `PAPEIS_PROIBIDOS` de `regras.ts`; o teste
  confere que as listas são iguais).
- A situação jurídica do caso só entra quando a fonte a diz (presunção de inocência: Constituição, art. 5º, LVII); o resto
  é sugestão para a curadoria.
- Sem rastreio: o robô só lê páginas públicas, com um agente que se identifica, e grava no nosso banco. Nenhuma chave é
  impressa nem vai em URL.

## Segredos e variáveis que o Jonathan precisa criar

No GitHub: Settings → Secrets and variables → Actions.

| Tipo | Nome | Para quê | Obrigatório |
|---|---|---|---|
| Variável | `VALE_O_ESCRITO` = `sim` | liga o robô (sem ela o workflow não roda) | sim |
| Segredo | `SUPABASE_URL` | endereço do projeto (já existe para outros workflows) | sim, para gravar |
| Segredo | `SUPABASE_SERVICE_ROLE_KEY` | chave de serviço (a mesma da publicação) | sim, para gravar |
| Segredo | `GEMINI_API_KEY` | Google AI Studio, plano gratuito | não (recomendado) |
| Segredo | `GROQ_API_KEY` | console.groq.com, plano gratuito | não (recomendado) |
| Segredo | `CEREBRAS_API_KEY` | cloud.cerebras.ai, plano gratuito | não |
| Segredo | `OPENROUTER_API_KEY` | openrouter.ai, só modelos `:free` | não |
| Segredo | `ARCHIVE_ACCESS_KEY` / `ARCHIVE_SECRET_KEY` | Save Page Now com conta (archive.org/account/s3.php) | não (sem elas, anônimo) |

Antes de ligar: a migração `supabase/migracoes/2026-11-vale-o-escrito.sql` precisa estar aplicada (cria
`vale_robo_sugerir`, liberada só para `service_role`). **Nenhum SQL novo** neste pacote: o rascunho completo cabe na
coluna `vale_fila.rascunho` (jsonb) que já existe.

## Rodar à mão

```
node scripts/vale-o-escrito/coletar.mjs --seco                                  # rede real, imprime, não grava
node scripts/vale-o-escrito/coletar.mjs --seco --sem-ia --sem-arquivo --fonte cimi  # uma fonte, só heurística
node scripts/vale-o-escrito/coletar.mjs --seco --sem-materia                    # só o que o feed traz (rápido)
node scripts/vale-o-escrito/coletar.mjs                                          # grava (exige SUPABASE_*)
npm run testar:vale-o-escrito-robo                                               # sem rede: scripts/testes/vale-o-escrito/
```

Opções: `--fonte <id>`, `--dias <n>` (7), `--max <n>` (120 sugestões), `--max-ia <n>` (50), `--max-arquivo <n>` (40),
`--minutos <n>` (25: passado o orçamento, a parte cara para e o resto sai só com o que o feed trouxe), `--sem-ia`,
`--sem-materia`, `--sem-arquivo`, `--hoje AAAA-MM-DD`, `--fixtures <pasta>` (feeds em `<pasta>/<id>.xml|json` e matérias em
`<pasta>/materias/<fim-do-link>.html`).

O workflow tem o botão "Run workflow" com a opção de rodada seca.

## Agendamento

`.github/workflows/vale-o-escrito.yml`: de 2 em 2 horas (`17 */2 * * *`), só com `VALE_O_ESCRITO == 'sim'`, 30 minutos de
limite (o robô para a parte cara aos 25), actions fixadas por SHA. Custo: 12 rodadas por dia.

### Serviço acelerado (07/11/2026)

Pedido da coordenação: "faz o robô acelerar o serviço". O que mudou, tudo dentro das cotas gratuitas acima:

| O quê | Antes | Agora | Por quê cabe |
|---|---|---|---|
| Intervalo das rodadas | 3 h (8 por dia) | **2 h (12 por dia)** | GitHub Actions: repositório público não paga minuto; em privado, 12 × 30 min no pior caso = 360 min/dia, acima dos 2.000 min/mês do plano gratuito, então **se o repositório for privado** volte para `*/3` ou baixe `--minutos` |
| `--dias` (janela) | 3 | **7** | só lê feed; link repetido o banco ignora |
| `--max` (sugestões por rodada) | 60 | **120** | gravação no Supabase gratuito: linhas pequenas (trecho de até 400 caracteres) |
| `--max-ia` | 40 | **50** | 12 × 50 = 600 pedidos/dia (conta acima) |
| `--max-arquivo` | 20 | **40** | 12 × 40 = 480 cópias/dia no Save Page Now; com conta (chaves S3) o limite diário do Internet Archive é bem maior; anônimo, o que falhar vira `arquivoFalhou` e a curadoria refaz |
| `--minutos` (orçamento) | 20 | **25** | timeout do workflow subiu para 30 |
| Fontes lidas | 17 feeds + Querido Diário | **+ IBAMA (oficial) e HRW** | RSS conferido com curl em 07/11/2026 |

Os padrões ficam em `PADROES_DA_RODADA` (`coletar.mjs`); o teste `npm run testar:vale-o-escrito-robo` confere os números.
Fontes testadas e **sem** RSS em 07/11/2026 (ficam como link): PF, Funai, ICMBio, PRF e MTE no gov.br (404), MPF (o site
novo não tem `/RSS`); STF (`noticias.stf.jus.br/feed`), ISA, Alma Preta, Global Witness e TCU não responderam daqui.

## Pendências e limites conhecidos

- Os endereços de feed em `fontes.json` têm `feedConfirmado: false`. Na primeira vez, rode `--seco` e veja no relatório
  quais fontes falharam (`falhou: HTTP 404`); corrija o `feed` ou troque `acesso` para `so-link`. (Em 05/11/2026 a
  Repórter Brasil respondeu e a matéria foi extraída.)
- O formato da API do Querido Diário foi escrito da documentação pública; conferir na primeira rodada seca. O diário
  oficial não é baixado inteiro: vale o trecho que a API devolve.
- Nomes de modelos gratuitos mudam: se um provedor responder 404/400, o robô o ignora e cai para o próximo; ajuste o
  `*_MODEL`.
- Heurísticas: a lista de órgãos é fixa (edite `ORGAOS_CONHECIDOS`); o município prefere o do estado citado e ignora,
  sozinhos, nomes que são palavra comum ("Vitória", "Palmas", "União"); mesmo assim a curadoria confere.
- Texto de menor é descartado por palavra-chave (pode perder casos legítimos de trabalho infantil, por exemplo).
- O robô não lê `robots.txt`: só abre o link que o próprio veículo publica no feed, uma vez por matéria.
