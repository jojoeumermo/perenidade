# Núcleos e organização estudantil: assembleia, Roda do semestre, ouvidoria e educador do mês (E4-12)

Pacote da onda 4 da Etapa 4. **Sem back-end novo**: usa `assembleia_voto`, `escola_contagens`, `contar_escola`,
`ouvidoria_enviar` e `ouvidoria_publicas` do E4-02 (docs/escola/banco.md), por `lib/escola/banco.ts`. Só entram a
contagem anônima (voto da assembleia) e o que a pessoa manda de propósito (ouvidoria).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `lib/escola/organizacao.ts` | Puro (roda no Node, sem `@/`): constantes, `validarPauta`, `assembleiaAberta`, `votar`, `resultadoDaPauta`, a Roda, os protocolos, `validarMensagem`, `mensagemDeRecusa`, `validarEducadores` e `educadorDoMes`. |
| `content/escola/assembleia.json` | A pauta do semestre, curada pela coordenação. Nasce `confirmado:false` e com `candidatas` vazia. |
| `content/escola/educador-do-mes.json` | `{ "_sobre": …, "educadores": [] }`. Lista curada pela coordenação, começa vazia. |
| `components/escola/organizacao/guardado-organizacao.ts` | Ganchos `useVotos`, `useProtocolos`, `useRodas` (mesmo padrão de `components/escola/guardado-escola.ts`) e a memória das respostas públicas. |
| `components/escola/organizacao/AssembleiaVotacao.tsx` | A votação (cliente). |
| `components/escola/organizacao/ResultadoDaAssembleia.tsx` | O resultado somado, na ordem da pauta (cliente). |
| `components/escola/organizacao/RodaDoSemestre.tsx` | A Roda do semestre (cliente). |
| `components/escola/organizacao/RoteiroDoNucleo.tsx` | Os 6 passos e os Territórios de cada trilha (servidor). |
| `components/escola/organizacao/FormularioDaOuvidoria.tsx` | O formulário da ouvidoria (cliente). |
| `components/escola/organizacao/MeusProtocolos.tsx` e `RespostasPublicas.tsx` | Protocolos do aparelho e respostas públicas (cliente). |
| `i18n/escola/organizacao/*.json` e `index.ts` | Textos nos 6 idiomas; `textosDaOrganizacao(lang)`. |
| `app/[lang]/escola/{assembleia,ouvidoria,educador-do-mes}/page.tsx` | As três páginas (substituem as provisórias). |
| `styles/escola-organizacao.css` | Visual (Caderno do Povo), 360 px de entrada, barras com número escrito, foco visível. |
| `scripts/testar-escola-organizacao.mjs` | `npm run testar:escola-organizacao`. |
| `e2e/escola-organizacao.spec.ts` | Com as funções do banco simuladas. |

As rotas ficam abaixo de `/escola`, que já está em `lib/interdicao.ts` (área "estudo"). Em `lib/escola/rotas.ts` só saiu
`provisoria: true` das três linhas. As páginas não têm `generateStaticParams`, não leem disco (`fs`) e importam os dados
por JSON estático (a assembleia usa `getTracks` só para o título das trilhas da pauta).

## Assembleia estudantil (`/escola/assembleia`)

### Processo da coordenação

1. A coordenação escolhe até 12 trilhas **que existem** em `content/trilhas` e as põe em `candidatas` (o nome da pasta).
2. Confirma o `semestre` (`AAAA.S`), decide se há janela (`abreEm`, `fechaEm`, `AAAA-MM-DD`, dentro do semestre) e troca
   `confirmado` para `true`. Enquanto for `false`, a página diz "Pauta proposta, a confirmar pela coordenação".
3. **Para os votos contarem**, rodar `node scripts/alvos-de-contagem.mjs` na publicação seguinte (já documentado em
   banco.md): ele manda `AAAA.S/trilha` ao banco. Sem isso o banco ignora o alvo (comportamento correto).
4. `npm run testar:escola-organizacao` confere o arquivo: formato, datas, trilhas que existem e a ligação com o script.

Pauta inválida vale como "sem pauta": a página nunca quebra. Situações (`assembleiaAberta`): `aberta`, `fechada`,
`sem-pauta`, `outro-semestre`. Sem janela, a votação vale o semestre inteiro.

### O voto

- Até **3 trilhas por pessoa e semestre** (`VOTOS_POR_PESSOA`). `votar()` recusa a 4ª, trilha fora da pauta e semestre
  diferente do da pauta; grava a marca local ANTES e só então chama `contarEscola('assembleia_voto', 'AAAA.S/trilha',
  'semestre')`, que ainda segura a repetição por aparelho e semestre (e o limite de 5 por minuto por tipo).
- No aparelho: `lucia:escola:assembleia` = `{versao:1, semestre, trilhas:[]}` (entra na cópia de segurança, sai no
  "apagar meus dados"). Troca de semestre: a lista velha é ignorada.
- No servidor: só a soma anônima por dia e alvo. A chave do freio não leva o alvo (banco.md), então nem a origem de rede
  liga uma pessoa a um voto.
- **O voto não pode ser desfeito**: o banco só soma e não sabe quem votou. A tela avisa antes e só libera os botões com a
  caixa "Entendi". Não existe função de desfazer, e o teste confere que ela não foi criada.
- Sem serviço (`hasBackend` falso) os botões ficam desativados e a tela diz que a votação está fora do ar.

### O resultado

`resultadoDaPauta` devolve uma linha por candidata **na ordem da pauta** (nunca por total, em linha com o banco), com total
e percentual do maior valor para a barra (a barra sempre vem com o número escrito). Alvo que não está na pauta é ignorado.
Com a soma de votos **abaixo de 10** a tela não mostra números ("poucos votos ainda"). Texto fixo: "É uma contagem de
aparelhos, não uma eleição… A coordenação lê o resultado e decide." Sem serviço, "resultado indisponível", sem erro no
console.

### Roda do semestre

Cinco perguntas (funcionou, travou, mudaria, levar à coordenação, levar ao núcleo), até 600 caracteres por resposta, sem
nome de ninguém (aviso quando uma resposta parece ter nome completo, pela função de `lib/escola/turma-do-curso.ts`).
Copiar, imprimir (a folha usa a regra de impressão do CSS; os controles têm `no-print`), apagar e **Levar à ouvidoria**,
que só abre `/escola/ouvidoria?sobre=escola`: a ouvidoria lê a Roda do aparelho, e nenhum texto vai no endereço. Guarda até
4 rodas (uma por semestre) em `lucia:escola:roda-do-semestre`. A chave reservada `avaliacoes` é do E4-13 e não é usada.

### Roteiro do núcleo

Seis passos (combinar horário, ler a pauta, conversar 15 minutos, marcar na ficha, votar cada um no seu aparelho, combinar o
que levar), com links para `/nucleos` e `/territorios` e, para cada trilha da pauta, os Territórios que a citam em
`trilhas` (dado que já existe). Não pede nem guarda nome de núcleo, cidade ou lista de participantes. Texto em revisão.

## Ouvidoria (`/escola/ouvidoria`)

- O formulário chama `ouvidoriaEnviar` (E4-02), sem conta. Campos: assunto (aula, curso, educador, escola, outro), página
  (opcional; `?caminho=` só entra se casar com o formato do banco), texto (10 a 3000), contato (opcional, até 200) e o
  campo-isca `site` (vazio, fora da tela, `tabindex=-1`, `aria-hidden`). `?sobre=` só preenche o assunto.
- `validarMensagem` espelha as regras do banco para avisar antes; **o banco continua sendo quem decide**.
- `mensagemDeRecusa(codigo, recusas)` cobre os códigos do banco.md: `entre_primeiro`, `conta_suspensa`, `invalido:sobre`,
  `invalido:caminho`, `invalido:texto`, `invalido:contato`, `area_interditada`, `envios_pausados`, `acesso_bloqueado`,
  `muitos_pedidos`. Código desconhecido (inclusive `sem_servico` e `sem_conexao`) cai em "tente de novo mais tarde".
  Recusa ou serviço fora do ar **nunca apaga** o que a pessoa escreveu.
- Sucesso: mostra o protocolo grande ("Anote: ABCD1234"), diz o que foi guardado e o que NÃO foi (endereço de rede) e guarda
  o protocolo no aparelho.
- Avisos acima do campo: sem CPF, documento, endereço, telefone nem nome de criança; menor de 18 pode escrever, mas sem
  dados seus. Assunto "educador": "conte o que aconteceu, sem xingar; só a mediação lê".
- **Meus protocolos** (`lucia:escola:ouvidoria-protocolos`, até 50, 8 caracteres hexadecimais): cruza com
  `ouvidoriaPublicas()`; se aparece, mostra resumo e resposta; senão "Recebida. Se a mediação publicar uma resposta, ela
  aparece aqui", sem prometer prazo. "Esquecer" só apaga do aparelho e a tela avisa que a mensagem continua no servidor.
- **Respostas públicas**: até 200, que já vêm sem texto, contato ou caminho de quem escreveu.

### Processo da mediação (fora do escopo deste pacote)

`ouvidoria_fila` e `ouvidoria_responder` já existem no banco; a tela da equipe fica para outro pacote. Hoje a mediação usa
as funções direto: lê a fila, responde e, se decidir publicar, escreve `resumo_publico` e `resposta_publica` sem nomes.
Prazo de resposta e política de resposta: **[A REVISAR PELA COORDENAÇÃO]**.

### Eliminação antes dos 365 dias

O texto e o contato são apagados em 365 dias pela rotina `lucia-ouvidoria-faxina`. Não existe função para a pessoa pedir o
apagamento antes: o protocolo tem 8 caracteres hexadecimais (32 bits) e **não prova autoria**, então apagar por ele deixaria
qualquer pessoa apagar mensagens alheias. Por isso a página diz, em texto **[A REVISAR PELA COORDENAÇÃO]**, que o pedido de
eliminação (LGPD, art. 18, VI) vai pelo contato da página de privacidade, citando o protocolo. Back-end para isso fica para
outra etapa.

## Educador ou educadora do mês (`/escola/educador-do-mes`)

Reconhecimento mensal, só de nomes de `content/escola/educador-do-mes.json` (mesmo processo da monitoria do E4-15):

1. As indicações chegam pela ouvidoria (assunto "educador"), em privado. Crítica a educador nomeado fica só na fila da
   mediação e nunca vira texto público.
2. A coordenação conversa com a pessoa e pede autorização para o apelido aparecer.
3. Acrescenta em `educadores` um item por mês:
   `{"mes":"AAAA-MM","apelido":"Como quer ser chamada","curso":"slug (opcional)","motivo":"até 280 caracteres","autorizacao":true}`.
   O `motivo` é escrito pela coordenação a partir das indicações e a página o marca como "em revisão" até a aprovação.
4. `npm run testar:escola-organizacao` confere a lista, **incluindo se o curso existe**.

Regras (`validarEducadores`): item sem `autorizacao:true`, mês repetido ou mal formado, apelido de 3 palavras ou mais, com
número ou e-mail, motivo acima de 280, curso que não existe ou **qualquer campo fora dos cinco** (foto, imagem, votos,
ranking) invalida a lista **inteira**, e a página não mostra ninguém. A página mostra o mês corrente e os 11 anteriores.
Sem foto, sem ranking, sem número de indicações por pessoa e sem votação por pessoa. **Retirar um nome**: apagar o item e
publicar; vale na hora, sem justificativa. A página diz que não é prêmio, cargo nem nota. Critério de escolha:
**[A REVISAR PELA COORDENAÇÃO]**. A monitoria de quem se formou é do E4-15; aqui só há o link para `/escola/turmas`.

## Base legal e privacidade

- **Assembleia**: sem identificador nenhum, logo sem dado pessoal; vale a minimização (LGPD, art. 6º, III). Nada é perguntado
  sobre idade, então não há tratamento de dado de criança. Trilhas de formação política na pauta não ligam ninguém a elas
  (voto anônimo, sem alvo na chave do freio); quem entra numa turma de curso sensível continua com o consentimento
  destacado do E4-15.
- **Ouvidoria**: o texto livre pode trazer dado pessoal da própria pessoa ou de terceiros, inclusive crianças. Mitigações:
  aviso acima do campo, nenhum campo de idade ou nome, endereço de rede não gravado, texto e contato apagados em 365 dias,
  leitura só pela mediação e coordenação, resposta pública sem o texto original.
- **Educador do mês**: nome de pessoa viva é dado pessoal. Só com `autorizacao:true` (LGPD, art. 7º, I), só apelido, sem
  foto, sem voz, sem ranking, retirada a qualquer momento.
- Sem rastreio, sem cookie, sem pixel. O teste confere que nenhum arquivo novo usa `fetch`, `sendBeacon` ou cookie.
- Artigos de lei só como citação (art. 6º, III; art. 7º, I; art. 18, VI), sem copiar trecho. **A cópia local `leis-do-brasil`
  não foi encontrada neste computador**, então as três citações não foram conferidas no texto: conferir antes de ligar a Escola.
- `content/paginas/privacidade.md` (do E4-02) já descreve "Voto na assembleia estudantil" e a Ouvidoria. Este pacote **não**
  o edita; o teste confere que as duas frases continuam lá.

## Textos

`i18n/escola/organizacao/{pt,en,es,fr,ru,zh}.json`, completos nos 6 idiomas, com os mesmos marcadores (`{n}`, `{semestre}`,
`{protocolo}`, `{data}`, `{min}`, `{max}`). Nada diz universidade nem diploma. Roteiro, Roda, motivo do educador e a moldura
levam "em revisão"; prazo, eliminação e critério levam `[A REVISAR PELA COORDENAÇÃO]`.

## Teste

`npm run testar:escola-organizacao` confere: o módulo sem `@/` e com `localStorage` e `JSON.parse` protegidos; a pauta
(formato, bordas da janela, trilhas que existem, ligação com `scripts/alvos-de-contagem.mjs`); o voto (3 por semestre,
ordem marca-local-depois-contagem, falhas de armazenamento); o resultado (ordem da pauta, soma menor que 10); a Roda (4
rodas, corte em 600); a ouvidoria (limites 9/10, 3000/3001, 200/201, caminho, todos os códigos do banco.md, protocolos); o
educador do mês; as páginas (sem `EmConstrucao`, `generateStaticParams`, `fs`); os 6 idiomas; a privacidade; e que
`lib/recursos.ts` não mudou. `e2e/escola-organizacao.spec.ts` roda com a Escola ligada e o banco simulado; os testes de
voto são pulados enquanto a pauta tiver menos de 4 candidatas.

## Fora do escopo (para depois)

Painel da mediação para a ouvidoria; botão "Fale com a ouvidoria" dentro da aula, da faixa do curso e do "Isso ajudou?"
(a página já aceita `?sobre=` e `?caminho=` para esses links existirem); inscrição e mapa novo de núcleos; entrada na barra
da Escola e no campus (**hoje nenhuma página aponta para as três rotas**, que não estão na faixa: sugerir o link ao E4-09);
eleição, voto por pessoa ou por conta e qualquer nota para educador. O recurso `escola` continua desligado em produção.
