# Etapa 3 · Lacunas pedagógicas (R3)

Quatro lacunas, fechadas reaproveitando o que já existia. Teste: `npm run testar:lacunas-3` (201 conferências, só leitura
de arquivos). Nada daqui lê o disco no layout raiz nem em componente global; nada rastreia.

## O que já existia (e não foi refeito)

| Já existia | Onde |
| --- | --- |
| "Ouvir" em cada parágrafo e ícone de traço nos botões de navegação das trilhas de alfabetização (R1-87, E4-04) | `components/aula/OuvirParagrafo.tsx`, `docs/escola/aula.md` |
| Leitor com a voz do aparelho (ou natural, no aparelho) | `lib/vozes/leitor.ts`, `lib/speech.ts` |
| "Não entendi" e o modo de assistente `outro-jeito` (reescreve o trecho com o trabalho da pessoa, só quando ela pede) | `components/escola/acompanhante/`, `docs/escola/acompanhante.md` |
| "Explique com suas palavras": texto ou gravação de até 2 minutos no fim da aula, só no aparelho | `components/aula/ExpliqueComSuasPalavras.tsx` |
| Áudio local no IndexedDB `lucia-explicacoes` (apagado pelo "apagar meus dados") | `components/escola/vida/audio-local.ts` |
| Reforço, assistente na página de reforço, comunidade, aulas ao vivo, estudo em grupo, sala livre | páginas em `app/[lang]/` |

## 1. Plantão de dúvidas: `/plantao`

Página servidora, sem fs e sem estado. Só reúne os canais que existem; o que cada um é vem dos textos das próprias páginas
(`t.tutoring`, `t.community`, `t.live`, `t.studyGroup`, `t.salaLivre`), para não haver duas versões. O texto novo (título,
"Antes de perguntar", "Como funciona" de cada canal) está em `i18n/plantao/` nos 6 idiomas.

- **Sem horário inventado.** Não há fonte de horário de plantão no repositório. A página diz isso ("não existe um horário
  fixo") e aponta a única agenda marcada, a das aulas ao vivo (`/ao-vivo`), publicada pelos educadores. O teste falha se o
  texto em português afirmar hora do dia.
- Canais: reforço com voluntários (resposta por e-mail, conforme `t.tutoring.how`), assistente (na página de reforço; o
  aviso de que erra e de que a dúvida vai a um serviço de IA fora do Brasil vem de `t.tutoring.assistant`), comunidade,
  aulas ao vivo, estudo em grupo. Em "Para quem ensina": sala livre (que é ferramenta de professor, não canal de aluno).
- O link do acompanhante da Escola (`/escola/acompanhante`) só aparece com o recurso `escola` ligado.
- Registrada em `app/sitemap.ts`, no menu "Mais" (`lib/secoes-do-site.ts`), numa área de interdição (`estudo`, em
  `lib/interdicao.ts`), no campus da Escola (`lib/escola/campus.ts`) e na busca viva (intenção `tirar-duvida`, com título
  da página em `i18n/escola/busca/*.json`).

## 2. Alfabetização com áudio e ícone primeiro

A E4-04 deu "Ouvir" ao parágrafo. Faltava o áudio das **instruções**, que ficam em botões e blocos:

- `Quiz` e `InlineCheck` (pergunta rápida) ganham a prop `audio`, ligada em `app/[lang]/trilhas/[track]/[lesson]/page.tsx`
  pela mesma regra do `data-letra-grande` (área `alfabetizacao`, etapa diferente de `superior`). Com ela: botão **Ouvir a
  pergunta e as respostas** (`components/aula/OuvirTexto.tsx`, lê com o leitor do site; o texto vai a um elemento escondido
  só enquanto dura a leitura, porque o leitor pula botões), e ícone antes do texto em "Próxima", "Tentar de novo", "Certo" e
  "Ainda não" (`components/aula/IconesDeTraco.tsx`; os ícones são `aria-hidden`, o nome fica no texto).
- `OuvirParagrafo` passa a pôr um "Ouvir" antes de cada bloco da aula (`aside.bloco`: Na sua realidade, Agir, O outro lado,
  Realidade...), que é onde ficam as tarefas. Esta parte continua atrás do recurso `escola`, como a E4-04; o áudio do Quiz e
  da pergunta rápida não depende dele.
- Sem voz no aparelho, os botões nem aparecem. Nada sai do aparelho.
- Não feito: áudio dos enunciados dos exercícios com explicação (`ExerciciosComExplicacao`) e da prática de idioma; ícone nos
  botões das ferramentas de alfabetização.

## 3. Segunda explicação: bloco `outrojeito`

Não existia como bloco (existia só o modo `outro-jeito` do assistente). Agora, em qualquer aula:

````markdown
```outrojeito
# Pensando de outro jeito
O mesmo caminho por outro lado: outro exemplo, outra imagem ou o passo a passo mais devagar.
```
````

Fechado até a pessoa abrir ("Não ficou claro? Veja de outro jeito"). Opcional: **não** entra em `lib/modelo-de-aula.ts` nem
no `npm run pendencias`. Quem escreve não muda fato, número nem fonte. Registrado em `components/aula/Blocos.tsx`,
`components/Markdown.tsx`, no menu "Bloco da aula" do editor, no espelho de texto simples e em `docs/MODELO-DE-AULA.md`. Nenhuma
aula existente foi alterada (aulas novas ficam "em revisão", como as outras).

## 4. Resposta aberta ou em áudio, com retorno

`components/aula/RespostaAberta.tsx`, logo abaixo do campo de texto dos blocos Na sua realidade, O outro lado (treino) e
Realidade (a resposta escrita já ficava só no aparelho, em `lucia:bloco:`):

- **Responder falando** (recurso `meu-estudo`): grava até 2 minutos com `MediaRecorder`, **sem reconhecimento de fala** (que
  mandaria o áudio a um servidor) e sem rede. O áudio vai para a mesma base `lucia-explicacoes` do "Explique com suas
  palavras" (chave `voz:resp-<número>`), logo o "apagar meus dados" já o apaga. Fora da cópia de segurança, pelo tamanho.
- **Retorno do áudio**: é da própria pessoa. Ela ouve de volta e confere três perguntas (disse a ideia principal? deu um
  exemplo da vida? falou com calma?). Sem nota.
- **Retorno do assistente** (recurso `escola`, texto com pelo menos 10 caracteres): só depois do botão "Pedir um retorno ao
  assistente". Reaproveita a `Conversa` do acompanhante (aviso do que vai antes do botão, limite do dia, histórico só no
  aparelho) com o modo `socratico` que a função já tem. Vai só o texto escrito; o áudio nunca sai do aparelho. A Edge Function
  `assistente` não mudou.
- Limite assumido: o assistente não ouve áudio. Um modo `retorno` próprio exigiria publicar de novo a função; fica como
  pendência.

## Dados guardados (para a página /privacidade)

Nada novo no `localStorage`. Novo: gravações das respostas, no IndexedDB `lucia-explicacoes` (chave `voz:resp-...`), só no
aparelho, apagadas por "Apagar o áudio" no bloco e pelo "apagar meus dados". O que a pessoa escreve para o assistente só sai
quando ela aperta o botão, e a tela diz antes o que vai.
