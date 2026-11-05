# Página Jogos (`/[lang]/jogos`) — Etapa 5

Teste: `npm run testar:jogos-pagina` (lógica com o glossário de verdade, textos nos 6 idiomas, redirecionamento, menu, privacidade).

## O que mudou

- **Nova página `/jogos`** no menu principal (depois de Comunidade), no rodapé, no "Mais"/`/explorar`, no mapa do site e na área "Ferramentas" da interdição.
- **Saiu de `/laboratorios/jogos` tudo que é jogo**: Rumos, Greve!, Linha do tempo e Quem disse? agora moram na seção "Jogos de formação" de `/jogos` (mesmo componente `components/labs/JogosDeFormacao.tsx`, mesmos baralhos, mesma conferência de baralhos no build).
- **Redirecionamento 308** (`permanent: true` em `next.config.ts`): `/:lang/laboratorios/jogos` vai a `/:lang/jogos` e `/laboratorios/jogos` vai a `/pt/jogos`. O cartão "Jogos de formação" saiu da página de Laboratórios. Links internos atualizados (`content/paginas/privacidade.md`, `lib/laboratorios.ts`, `e2e/s24.spec.ts`, `e2e/fumaca.spec.ts`, `scripts/testar-jogos.mjs`). O teste confere que nenhum link interno cita o endereço antigo.

## Jogos de treino (seção "Treino de palavras")

Gerados no navegador, depois do clique, com os verbetes do glossário (`getGlossaryIndex("pt")`, o mesmo índice da página `/glossario`: `content/glossario/*.md` mais os termos que as aulas definem). O servidor manda no máximo 260 verbetes (`lib/jogos/verbetes.ts`), primeiro os de uma palavra só. Cada partida usa uma semente nova (`criarSorteio`); com semente fixa o teste repete o mesmo jogo.

| Jogo | Como é gerado |
| --- | --- |
| Palavras cruzadas | Termos de 4 a 9 letras; dicas são as definições com o termo escondido (`mascarar`). Cada palavra cruza outra e nenhuma fica colada em paralelo (o teste varre a grade). |
| Caça-palavras | 9x9 fácil (só direita e baixo) ou 12x12 normal (8 direções). |
| Sudoku | 4x4 (crianças), 6x6 e 9x9, fácil e médio; solução única conferida a cada casa retirada. |
| Forca da flor | Flor de 6 pétalas que caem (sem desenho violento); dica é a definição. |
| Memória | 4, 6 ou 8 pares termo e definição curta; sem tempo nem contagem de tentativas. |
| Quebra-cabeça de palavras | Modo letras (reordenar o termo) e modo frase (reordenar a definição). |
| Jogo da velha com perguntas | Para marcar a casa, acertar que termo a definição descreve (3 opções). Contra o computador ou com outra pessoa. |
| Ditado | `speechSynthesis` do navegador (pt-BR, normal e devagar), palavra ou frase. Sem voz no aparelho, mostra o texto. |

"Gerados a partir do glossário e das aulas": o glossário define o conteúdo; cada acerto e o fim do jogo oferecem o link da aula onde o termo aparece (`lessons[0]` do índice).

## Música e sons para crianças

**Decisão: sons próprios, sintetizados com WebAudio, sem arquivo nem código de terceiros.** Não foi adotado projeto aberto de jogo infantil: os candidatos conhecidos são engines/jogos completos (pesados para celular de entrada, com ativos de licenças variadas) e a exigência do plano é "leves"; para escala, batida e memória de sons, 150 linhas de WebAudio bastam e não há nada a creditar ou conferir. Por isso nenhuma entrada foi acrescentada em `docs/NOTICE.md` (não há código de terceiros). Se um dia entrar projeto externo, deve vir com licença conferida e crédito.

- `components/jogos/audio.ts`: notas (seno mais um harmônico triângulo, envelope curto, volume baixo) e batidas (bumbo por varredura de seno, caixa, chimbal e palma por ruído filtrado). O `AudioContext` só nasce no primeiro toque.
- `lib/jogos/sons.ts`: frequência por MIDI (`440·2^((n−69)/12)`, o teste confere lá = 440 Hz e dó central = 261,63 Hz); escala pentatônica de dó maior (qualquer ordem soa bem, não há nota errada); batida pronta de 8 passos.
- Brincadeiras: Piano dos bichos, Repita a melodia (4 rodadas de 2 a 5 notas, e termina; errou, ouvimos de novo), Bateria de panelas (com batida pronta), Qual som é igual? (pares) e Agudo ou grave? (6 rodadas). Toda nota acende a tecla (o som nunca é a única pista).
- Respeita o botão "Som desligado" da área infantil (`useMudo`, preferência só neste navegador). Também está em `/criancas/sons` (atividade nova do Cantinho da Lua).

## Princípios cumpridos

- **Nunca viciantes:** sem pontos, placar, sequência de dias nem recompensa; todo jogo tem fim ou é de brincar livre.
- **Acessibilidade:** tudo por teclado (setas na grade, Tab, Enter; atalhos de teclas nos instrumentos), rótulos em cada casa e carta, avisos em `role="status"`, foco devolvido ao título ao trocar de jogo, trechos em português marcados com `lang="pt-BR"`.
- **Celular de entrada:** cada jogo é um `dynamic import` carregado só quando escolhido (`ssr: false`); o WebAudio só carrega ao abrir a seção das crianças; grades com rolagem lateral e casas de 2,25 rem.
- **Privacidade:** nenhum arquivo dos jogos usa rede, cookie, `localStorage` ou iframe (o teste confere); nada é guardado, a não ser o "som desligado" que já existia na área infantil.
- **Leitura de disco:** só em `lib/jogos/verbetes.ts` (via `getGlossaryIndex`, a mesma da página do glossário) e em `app/[lang]/jogos/page.tsx` (`path.join(process.cwd(), "content", "trilhas")`, como a página antiga). Nada no layout raiz.

## Leis conferidas (planalto.gov.br)

- **LGPD, Lei 13.709/2018, art. 14**: o tratamento de dados de crianças deve atender ao melhor interesse delas (caput); o § 4º proíbe condicionar a participação em jogos a mais dados do que o estritamente necessário. Os jogos infantis não coletam dado nenhum, não têm conta nem identificador; não há problema a anotar. O "som desligado" é preferência do aparelho, sem dado pessoal.
- Sem imagem de pessoa, sem opinião política coletada e sem texto de terceiros: os verbetes são do glossário do próprio instituto.

## Textos

`i18n/jogos/{pt,en,es,fr,ru,zh}.json` (+ `index.ts`; nome do menu em `lib/jogos/menu.ts`). **Só o português é texto final; en, es, fr, ru e zh são rascunho** aguardando revisão. Os termos e definições dos jogos são do glossário, que está em português: fora do português a página mostra o aviso padrão de "não traduzido" e uma nota própria. O teste exige as mesmas chaves e os mesmos `{campos}` nos seis idiomas.

## Pendências e observações

- Revisão humana das traduções (en, es, fr, ru, zh).
- Os 8 novos baralhos do Rumos e os "jogos próprios" listados no plano (Linha de montagem, Quem é o dono? etc.) não fazem parte deste pacote; outro pacote já acrescenta um baralho em `app/[lang]/jogos/page.tsx`.
- Sudoku só com números; variante com símbolos fica como ideia.
- Teste em navegador real (toque, leitor de tela, vozes) não foi feito neste pacote: a lógica está coberta por `testar:jogos-pagina`; a parte visual precisa de uma passada manual.
