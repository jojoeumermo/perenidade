# Vale o Escrito: o robô de coleta

O robô (`scripts/vale-o-escrito/coletar.mjs`, Node puro, sem dependências) lê as fontes abertas, filtra, pede um resumo
neutro à IA gratuita e põe cada achado na **fila da curadoria**. Ele não publica nada. Quem publica é a curadoria, depois
de conferir a fonte e arquivá-la no Internet Archive (Save Page Now, no pacote da curadoria).

## O que ele faz, em ordem

1. Lê `content/vale-o-escrito/fontes.json` (48 fontes do catálogo; campo `acesso`: `aberto`, `cadastro-gratuito`,
   `sem-acesso` ou `so-link`; campo `leitor`: `rss`, `querido-diario` ou `null`). Hoje lê RSS/Atom e a API aberta do
   Querido Diário (sem cadastro). As demais ficam como link para a curadoria até alguém escrever o adaptador.
2. Filtra pelas palavras (`temas`) dos 6 dossiês de `content/vale-o-escrito/dossies.json` (sem acento, início de palavra).
3. Marca o município do IBGE quando o texto cita um (`scripts/vale-o-escrito/municipios.json`, se existir, no formato
   `[{"ibge":"1501402","nome":"Belém","uf":"PA"}]`; senão, as 27 capitais embutidas) e a UF quando só o estado aparece.
4. Tira repetidos por link (sem `utm_*`, sem `#`, sem barra final) e o que é mais velho que a janela (`--dias`, padrão 3).
5. Pede à IA, em rodízio (Gemini, Groq, Cerebras, OpenRouter grátis), resumo de até 3 frases, etiquetas e situação
   jurídica SUGERIDA. Sem chave ou sem cota, a sugestão segue sem resumo.
6. Grava com `public.vale_robo_sugerir` (chave de serviço). Link repetido o banco ignora.

## Regras que o código cumpre

- Só trecho (até 400 caracteres), link e data; nunca a página inteira.
- Fonte `agregado: true` (vítimas, estatística) **não gera sugestão por item**: só números.
- Texto que fala de criança ou adolescente é **descartado** (ECA, arts. 17, 143 e 247; LGPD, art. 14). A curadoria pode
  lançar à mão, se for de interesse público e sem identificar a criança.
- Prompt da IA: não inventar; "segundo [fonte]" ou "supostamente" em toda afirmação; proibido nome de vítima, criança,
  adolescente ou testemunha; o texto da fonte é dado, não ordem. A resposta é conferida: sem "segundo", mais de 3 frases,
  mais de 600 caracteres ou nome próprio que não está no texto da fonte, o resumo é jogado fora.
- A situação jurídica é só sugestão (vai em `rascunho.situacaoSugerida`); a curadoria confere. Presunção de inocência:
  Constituição, art. 5º, LVII.
- Sem rastreio: o robô só lê páginas públicas e grava no nosso banco. Nenhuma chave é impressa nem vai em URL.

## Segredos e variáveis que o Jonathan precisa criar

No GitHub: Settings → Secrets and variables → Actions.

| Tipo | Nome | Para quê | Obrigatório |
|---|---|---|---|
| Variável | `VALE_O_ESCRITO` = `sim` | liga o robô (sem ela o workflow não roda) | sim |
| Segredo | `SUPABASE_URL` | endereço do projeto (já existe para outros workflows) | sim, para gravar |
| Segredo | `SUPABASE_SERVICE_ROLE_KEY` | chave de serviço (a mesma da publicação) | sim, para gravar |
| Segredo | `GEMINI_API_KEY` | Google AI Studio, plano gratuito | não |
| Segredo | `GROQ_API_KEY` | console.groq.com, plano gratuito | não |
| Segredo | `CEREBRAS_API_KEY` | cloud.cerebras.ai, plano gratuito | não |
| Segredo | `OPENROUTER_API_KEY` | openrouter.ai, só modelos `:free` | não |

Sem nenhuma chave de IA, o robô funciona e as sugestões chegam sem resumo. Opcionais para trocar modelo (variáveis de
ambiente do passo, se um modelo gratuito mudar de nome): `GEMINI_MODEL`, `GROQ_MODEL`, `CEREBRAS_MODEL`,
`OPENROUTER_MODEL`. Antes de ligar: a migração `supabase/migracoes/2026-11-vale-o-escrito.sql` precisa estar aplicada
(cria `vale_robo_sugerir`, liberada só para `service_role`).

## Rodar à mão

```
node scripts/vale-o-escrito/coletar.mjs --seco                       # rede real, imprime, não grava
node scripts/vale-o-escrito/coletar.mjs --seco --sem-ia --fonte cimi  # uma fonte, sem IA
node scripts/vale-o-escrito/coletar.mjs                               # grava (exige SUPABASE_*)
npm run testar:vale-o-escrito-robo                                    # sem rede: feeds de scripts/testes/vale-o-escrito/
```

O workflow tem o botão "Run workflow" com a opção de rodada seca.

## Agendamento

`.github/workflows/vale-o-escrito.yml`: a cada 3 horas (`17 */3 * * *`), só com `VALE_O_ESCRITO == 'sim'`, 15 minutos de
limite, actions fixadas por SHA (as mesmas de `funcoes.yml` e `emails.yml`). Custo: ~8 rodadas por dia de poucos minutos.

## Pendências e limites conhecidos

- Os endereços de feed em `fontes.json` têm `feedConfirmado: false`: **não foram testados com a rede** (o ambiente de
  desenvolvimento não tinha acesso). Na primeira vez, rode `--seco` e veja no relatório quais fontes falharam
  (`falhou: HTTP 404`); corrija o `feed` ou troque `acesso` para `so-link`. Fonte que falha não derruba a rodada.
- O formato da API do Querido Diário (`/gazettes`, parâmetros `querystring`, `published_since`, `excerpt_size`) foi
  escrito de memória da documentação pública; conferir na primeira rodada seca.
- Nomes de modelos gratuitos mudam: se um provedor responder 404/400, o robô só o ignora (cai para o próximo); ajuste o
  `*_MODEL`.
- Heurísticas: o nome de município só é marcado com inicial maiúscula (evita "natal"), mas "Vitória" ou "Palmas" ainda
  podem aparecer como palavra comum: a curadoria corrige na revisão. A lista completa de 5.570 municípios entra com
  `scripts/vale-o-escrito/municipios.json` (gerar a partir da API de localidades do IBGE).
- Texto de menor é descartado por palavra-chave (pode perder casos legítimos de trabalho infantil, por exemplo).
- Não há Save Page Now aqui (é na aprovação) nem exportação para `content/` (pedido já registrado na ESPEC).
