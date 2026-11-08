# Vida real e vozes (E4-11)

Pacote da onda 4 da Etapa 4. Liga a Escola à vida de quem estuda, em 7 peças, **todas no aparelho, sem rastreio e sem back-end novo** (nenhum tipo novo em `TIPOS_DA_ESCOLA`, nenhuma função de banco). Tudo fica atrás de `ligado("escola")` pelo layout de `/escola`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `lib/escola/vida.ts` | Puro (roda no Node, sem `@/` nem fs): tarefa no mundo, missões, vozes locais, validação das vozes publicadas e dos trabalhadores que ensinam, estudo de caso e seus registros na caderneta. |
| `lib/escola/lutas.ts` | Puro: `lutasDoAno`, `proximaLuta`, `agrupadasPorMes`, `icsDaLuta`. Separado de `vida.ts` para a página do curso não carregar o calendário só por causa da tarefa. |
| `lib/interativos-mais.ts` | Acrescenta `lerDocumento` (leitura do bloco `documento`). `lib/interativos.ts`: `documento` em `INTERATIVOS` e em `MODELOS_INTERATIVOS`. |
| `components/blocos/DocumentoReal.tsx` | O bloco `documento` (carregado com `next/dynamic`, `ssr: false`; textos dos 6 idiomas importados no próprio pedaço). Despacho em `Interativo.tsx`; entrada na vitrine do editor (`Formularios.tsx`). |
| `components/escola/vida/audio-local.ts` | IndexedDB `lucia-explicacoes` (versão 1), loja `audios`, chave `voz:<id>`. |
| `components/escola/vida/guardado-vida.ts` | `useTarefas`, `useMissoes`, `useVozesLocais` (mesmo HTML na hidratação, escutam `lucia:estudo`). |
| `components/escola/vida/TarefaNoMundo.tsx` | Cartão da tarefa (marcar, nota, registrar na caderneta) e `ContadorDeTarefas`. |
| `components/escola/vida/GravadorDeVoz.tsx` | Aviso, roteiro de 6 perguntas, gravar até 120 s, ouvir, baixar, apagar e o link de envio. |
| `components/escola/vida/ListaDeVozes.tsx`, `TrabalhadoresQueEnsinam.tsx` | Vozes publicadas (com transcrição ao lado) e cartões do Memorial. Servidor. |
| `components/escola/vida/MissaoDoLab.tsx` | Missões por curso, "Cumpri a missão". |
| `components/escola/vida/CasoDoBairro.tsx` | Os 5 passos, rascunho privado, registro na caderneta com aviso. |
| `components/escola/vida/LutasDoAno.tsx`, `HojeNaLuta.tsx` | Mapa das lutas (servidor) e o pedaço de cliente (hoje, próxima data, `.ics`). |
| `components/escola/vida/HubDaVida.tsx`, `ResumoDaVida.tsx` | O hub e o contador "N de M". |
| `app/[lang]/vida/{,tarefas,missoes,caso-do-bairro,documentos}/page.tsx` | Hub e as quatro páginas de baixo. |
| `app/[lang]/escola/{vozes,lutas}/page.tsx` | Substituem as provisórias (`lib/escola/rotas.ts` perdeu o `provisoria` das duas). |
| `app/[lang]/cursos/[curso]/page.tsx` | Só acréscimo: `TarefaNoMundo` embaixo do texto da tarefa e o link do caso nos cursos que o marcam. |
| `content/escola/vida/*.json`, `LEIA-ME.md` | `vozes` (começa vazio), `trabalhadores-que-ensinam`, `missoes`, `documentos` (começa vazio). |
| `i18n/escola/vida/*.json` | Textos nos 6 idiomas. |
| `styles/escola-vida.css` | Visual, só com tokens que já existem; 360 px de entrada. |
| `scripts/testar-escola-vida.mjs`, `e2e/escola-vida.spec.ts` | `npm run testar:escola-vida` e o Playwright. |

Nenhuma rota nova em `lib/escola/rotas.ts` (para não exigir texto novo em `i18n/escola/base`): `/vida/*` fica sob `/escola`, que já está em `lib/interdicao.ts` (área "estudo").

## Chaves no aparelho

| Chave | Cópia de segurança | Formato |
|---|---|---|
| `lucia:escola:tarefas` | entra | `{versao:1, itens:{[curso]:{feita:true, em, nota?}}}` |
| `lucia:escola:missoes` | entra | `{versao:1, itens:{[idMissao]:{feita:true, em, nota?}}}` |
| `lucia:escola-privado:vozes` | **não** | `{versao:1, itens:[{id, criadaEm, segundos, titulo, pergunta}]}` |
| `lucia:escola-privado:caso-do-bairro` | **não** | `{versao:1, itens:{[curso\|"livre"]:{passos:[5 textos], atualizadoEm}}}` |
| IndexedDB `lucia-explicacoes`, loja `audios`, chave `voz:<id>` | não | o áudio (Blob) |

Todas com `try/catch` e evento `lucia:estudo` a cada escrita. O "apagar meus dados" já apaga os dois prefixos e a base `lucia-explicacoes`, então nada precisou ser registrado em `lib/estudo.ts`. Limites: nota até 500 caracteres; tarefa até 40 cursos; até 10 gravações de 120 s; cada passo do caso até 600 caracteres.

### Leitores estáveis (para o E4-14)

```ts
import { tarefasFeitas, missoesFeitas } from "@/lib/escola/vida";
tarefasFeitas(); // [{ curso, em }]   (nunca a nota)
missoesFeitas(); // [{ missao, em }]
```

Quem leu o formato não precisa de arquivo deste pacote em tempo de edição: o desenho de `lucia:escola:tarefas` e `:missoes` está fixo acima.

## As 7 peças

1. **Vozes do trabalho** (`/escola/vozes`): ouvir as vozes publicadas com autorização e transcrição ao lado; os "trabalhadores que ensinam" (pares Memorial + aula); e o gravador. O gravador mostra o aviso antes (só a sua voz, sem nomes, sem criança, sem dado de terceiros, fica só no aparelho, apagar sempre visível), grava até 120 s com contagem regressiva e parada automática, deixa ouvir, baixar (arquivo local) e apagar. **"Enviar para o Instituto" é só um link** para `/voluntarie-se` com o texto pronto para copiar: nada vai sozinho e o código não tem `fetch`. Sem `MediaRecorder` ou microfone, aparece "Seu aparelho não grava áudio" e o roteiro escrito continua servindo.
2. **Mapa das lutas** (`/escola/lutas`): as 8 datas de `content/escola/feriados.json` (E4-09) cruzadas com os fatos de `content/neste-dia.json` pelo dia `MM-DD`, por mês, com fonte, aula do tema e "Pôr na agenda" (`.ics` de evento único, sem recorrência, feito no aparelho). É um **mapa no tempo**: não há coordenada com fonte. Só o feriado é "feriado do campus"; a data que só tem fato é "data de memória". O filtro é por links (`#so-feriados` e `#todas`, CSS `:target` + `:has`), sem JavaScript.
3. **Tarefa no mundo** (em todo curso e em `/vida/tarefas`): "Marcar como feita" (a fazer, feita em data, desfazer), nota curta com o aviso "sem nomes de outras pessoas" e "Registrar na caderneta" (tipo `tarefa`, com id `tarefa-<curso>`: registrar de novo troca o registro em vez de duplicar).
4. **Laboratório como missão** (`/vida/missoes`): missões curadas que apontam para laboratórios e exercícios que existem, com situação, tarefa e cuidado. A pessoa marca "Cumpri a missão"; o laboratório não manda resultado. Contador "N de M" só para quem estuda, sem ranking. O link da IDE segue `/laboratorios/ide?p=<perfil>&ex=<id>` (o que `IDEPagina` lê).
5. **Estudo de caso do bairro** (`/vida/caso-do-bairro`): 5 passos (o que vi; quem ouvi, sem nome; o que a aula diz; o que o caso mostra; o que se pode propor). Rascunho privado por curso (ou "livre"). Registrar na caderneta (tipo `caso`, sem `pessoas`) pede antes uma confirmação com o aviso de que a caderneta pode ser exportada e vista por outras pessoas. Os 3 cursos com `casoDoBairro` ganham o link na página do curso.
6. **Documentos reais nas aulas**: bloco ```` ```documento ````, só quando a aula o usa:

   ```documento
   imagem: /imagens/documentos/modelo.webp | Descrição para quem não enxerga
   fonte: https://endereco-oficial
   licenca: Modelo oficial em branco, sem direitos reservados
   sem-dados-pessoais: sim
   Nome do campo | 10 12 40 8 | O que significa. | O que conferir nele.
   ```

   Recusa (o bloco vira texto) imagem de fora do site, `fonte` sem https, bloco sem `fonte` ou sem `licenca`, área fora de 0 a 100 e mais de 24 áreas. Sempre mostra o selo "Explicação em revisão" e o link "Ver o original". Toque, Tab e Enter abrem a explicação; o leitor de tela lê o nome e o significado de cada área. Sem JavaScript aparece o texto do bloco.
7. **Hub** (`/vida`): reúne as peças abertas (tarefas, missões, caso do bairro, documentos). Desde a F7 não aponta para dentro
   da Escola: vozes e lutas foram para a Biblioteca e o círculo de cultura digital para o Núcleo, os dois fechados.

## Pontos legais e de cuidado

- **Voz é dado pessoal** (LGPD, Lei 13.709/2018). Gravar e guardar só no aparelho não envia nada ao Instituto. **Publicar** a voz de alguém exige consentimento livre, informado e específico (art. 7, I, e art. 8), revogável a qualquer momento (art. 8, § 5): `content/escola/vida/vozes.json` começa **vazio** e só aceita item com `autorizacao: true`; retirar é apagar o item e o arquivo e publicar na hora, sem justificativa.
- **Dado sensível** (opinião política, filiação sindical, saúde: art. 5, II, e art. 11): o roteiro pede para não falar de terceiros nem de patrão ou cliente pelo nome; a coordenação revisa a transcrição antes de publicar; o roteiro não pede dado de saúde. A validação recusa telefone, e-mail, CPF e endereço de internet na transcrição. **[A REVISAR PELA COORDENAÇÃO]:** decidir se aceita relatos de risco no trabalho.
- **Crianças e adolescentes** (ECA, Lei 8.069/1990; LGPD, art. 14): o pacote **não publica voz nem imagem de menor de 18 anos**. Gravar para si é livre; o aviso diz que a publicação só é possível com responsável e que a coordenação não publica áudio de criança nem de adolescente. Se o risco legal parecer grande, a coordenação pode manter a lista pública vazia: o resto funciona igual.
- **Documentos reais:** só sem dado pessoal e com fonte e licença (modelo oficial em branco, ato oficial, domínio público ou documento da própria equipe). Nenhum holerite ou conta de pessoa real. A leitura de documento pessoal por foto é do E4-10 e do E4-16. **[A REVISAR PELA COORDENAÇÃO]:** escolher os primeiros documentos e conferir os direitos de imagem; sem isso o hub mostra o estado vazio que ensina como fazer.
- **Tarefa e caso do bairro:** o texto pede "sem nomes" e "sem endereço"; o rascunho do caso é privado (fora da cópia) e só o resumo vai à caderneta. Nada é contado no servidor.
- **Datas de luta:** só as 8 de `feriados.json` e os fatos de `neste-dia.json` (cada um com link). Data nova só com fonte já no repositório e decisão da coordenação. A divergência do Eldorado do Carajás (19 × 21) continua pendente do E4-09 e **não é citada**.
- **Texto escrito pelo pacote** (roteiro da voz, missões, texto de cada "trabalhador que ensina", explicações dos documentos, passos do caso) leva a marca "em revisão" e não é atribuído a ninguém. Nenhum texto diz universidade ou diploma, nos 6 idiomas.

## Deploy

Nada de `fs` em módulo importado pelo layout raiz, pela página da aula ou por componente global: `lib/escola/vida.ts` e `lutas.ts` não leem disco; o conteúdo entra por import estático de JSON só nas páginas do pacote (as páginas dos cursos já usam `fs`, como antes). Não há `generateStaticParams` por item: são 7 páginas fixas. O bloco `documento` é `dynamic` (`ssr: false`) e só baixa quando a aula o usa. O teste (que usa `fs`) roda só no CI, nunca no build.

## Fora do escopo

Círculo de cultura digital (E4-15, só ganha link); caderneta, formatura e Mural dos Trabalhadores (E4-14, que lê `tarefasFeitas()` e `missoesFeitas()`); assembleia, ouvidoria e núcleos (E4-12); agentes de trabalho e leitor de documento por foto (E4-10 e E4-16); página da aula (E4-17); qualquer back-end novo; envio automático de áudio, transcrição por IA e voz de menor; mapa geográfico das lutas; ligar `escola` em produção.

## Testes

`npm run testar:escola-vida` (145 conferências: tarefas, missões, vozes locais e publicadas, trabalhadores que ensinam, lutas, caso, bloco documento, 6 idiomas e estrutura), `npm run testar:blocos` (acrescenta os casos do bloco `documento`), `npm run testar:textos-escola` (cobre a pasta nova) e o Playwright `e2e/escola-vida.spec.ts` (com a Escola ligada só no teste). Depois do build, `npm run orcamento:peso` confere que a aula não ganhou peso (o bloco é lazy).