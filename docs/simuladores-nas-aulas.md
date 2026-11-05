# Simuladores dentro das aulas (Etapa 5, B17)

Um bloco de aula novo, `simulador`, que embute o simulador certo na própria aula, sem sair do site. Fica fechado até a pessoa clicar em **Abrir o simulador**; só então o código dele é baixado (`next/dynamic`). A aula que não tem o bloco não carrega nada a mais, e a que tem carrega só uma casca pequena.

## Como escrever

Um bloco de código com o nome `simulador`; a primeira linha diz qual. Uma segunda linha `# Título` é opcional.

````markdown
```simulador
circuito
# Quando o disjuntor desarma
tensao 127
disjuntor 10
modo paralelo
```

```simulador
execucao-python
# Veja a função entrar e sair da pilha
def dobro(n):
    return n * 2

a = dobro(4)
print(a)
```
````

| Tipo | O que embute | Opções |
| --- | --- | --- |
| `circuito` | Circuito simples novo: fonte, três aparelhos, lei de Ohm (V = R × I), série e paralelo, disjuntor e curto-circuito | `tensao` (V), `disjuntor` (A), `modo serie` ou `modo paralelo` |
| `lampadas` | O laboratório de lâmpadas de `/laboratorios/eletrica` (componente `Circuitos`, reaproveitado) | nenhuma |
| `instalacao` | O treino de fiação do mesmo laboratório (componente `Instalacao`, reaproveitado) | nenhuma |
| `execucao-python`, `execucao-js` | Visualizador de execução passo a passo | o programa vai depois da primeira linha (e do título); apelidos `python`, `js`, `javascript` |

Bloco mal escrito não derruba a aula: aparece um aviso curto no lugar.

## Visualizador de execução

`lib/execucao-passo-a-passo.ts` é um interpretador pequeno, escrito para o site. **Não usa `eval`, `Function`, Worker nem rede**: o código de quem estuda é lido como dado e nunca executado pelo navegador, nada é enviado para fora, e funciona sem internet depois de carregado. Cada passo guarda a linha, as variáveis, a pilha de chamadas e a saída.

Entende: números, textos, verdadeiro/falso, nulo, listas; as quatro contas, `%`, `**` e `//` (Python); comparações e lógica; atribuição (`+=`, `i++`, `lista[i] = x`); `if/elif/else`, `while`, `for` (range e lista em Python; `for` clássico e `for...of` em JS), `break`, `continue`; funções com `return` e recursão; `print`, `console.log`, `len`, `str`, `int`, `float`, `abs`, `min`, `max`, `sum`, `range`, `Math.*`, `append`, `push`.

Não entende (e avisa a linha e o motivo): classes, importações, f-strings e template strings, funções anônimas, `try/except`, objetos e dicionários, `input`. Limites: 2000 letras de código, 300 passos (laço sem fim vira aviso), 40 chamadas empilhadas (recursão sem fim vira `RecursionError`). Simplificações: variável dentro de função é local e o resto é global; blocos não criam escopo.

## Circuito simples

`resolverCircuito` (em `lib/simuladores-aula.ts`) aplica a lei de Ohm: em série as resistências se somam e a corrente é a mesma; em paralelo cada aparelho recebe a tensão inteira e as correntes se somam; o disjuntor desarma quando a corrente total passa do valor dele. É um **modelo didático**, dito na tela: o disjuntor real (termomagnético) aguenta uma pequena sobrecarga por algum tempo e o magnético age na hora em correntes bem maiores. O fio de ligação no curto-circuito vale 0,05 Ω (valor didático, não medido). Valores de disjuntor oferecidos: 6, 10, 16, 20, 25, 32 e 40 A.

## Onde entrou (10 aulas)

- Eletricista: `eletricidade-basica-e-seguranca/a-lei-de-ohm-no-dia-a-dia` (circuito), `.../corrente-tensao-e-resistencia` (lâmpadas), `instalacoes-eletricas-residenciais/o-quadro-de-distribuicao-disjuntores-e-dr` (circuito com disjuntor de 10 A), `.../dimensionar-um-circuito` (circuito), `.../interruptor-simples-paralelo-e-intermediario` (instalação).
- Programação: `logica-de-programacao/02-variaveis-e-tipos`, `04-lacos-de-repeticao`, `05-funcoes`, `python-do-zero/lacos-em-python-while-e-for`, `python-do-zero/funcoes-em-python` (execução em Python).

O bloco foi só acrescentado nos `.md`; nenhum texto existente mudou.

## Arquivos

- `components/aula/SimuladorDaAula.tsx`: a casca (clique para abrir, `dynamic import`, fallback se quebrar).
- `components/aula/simuladores/CircuitoSimples.tsx` e `VisualizadorDeExecucao.tsx`: os dois simuladores novos.
- `lib/simuladores-aula.ts` (leitura do bloco e conta do circuito) e `lib/execucao-passo-a-passo.ts` (interpretador), sem importar nada, para rodar no Node.
- `components/Markdown.tsx`: uma linha liga o idioma `simulador`. `scripts/gerar-espelho.mjs`: no espelho de leitura (sem JavaScript) o bloco vira uma nota.
- `scripts/testar-simuladores-aulas.mjs`: `npm run testar:simuladores-aulas`.

## Peso e rastreio

Nada de leitura de disco, nada de módulo novo no layout raiz: a casca só importa React e `lib/simuladores-aula.ts` (pequeno, sem `fs`); os simuladores e o interpretador entram em chunks separados por `dynamic import`. O rastreio de arquivos das funções do servidor não muda (`npm run conferir:rastreio` é conferido depois do build).

## Acessibilidade, idioma e privacidade

Tudo por teclado (botões, sliders e caixas nativos), resultados em região `role="status"` / `aria-live`, linha atual marcada com `aria-current`, SVG com `aria-label` que resume o estado. O texto dos simuladores está em português e o bloco é marcado `lang="pt-BR"`, como os laboratórios de `/laboratorios`; **en/es/fr/ru/zh ficam em rascunho** (rótulos ainda em português nessas línguas). Sem rastreamento, sem script ou iframe de terceiros, sem cookies; nada é guardado nem enviado.

## Pendências

- Traduzir os rótulos dos simuladores para en/es/fr/ru/zh.
- Esqueleto do bloco no menu **Bloco da aula** do editor (precisa de rótulo nos 6 idiomas em `components/rotulosDoEditor.ts`).
