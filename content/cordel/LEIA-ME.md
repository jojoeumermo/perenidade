# Cordel da aula: como escrever e como revisar

O cordel da aula é a aula contada em versos de cordel, para ler em voz alta, ouvir pela voz do aparelho e imprimir em
folheto A5. Ele aparece em `/pt/trilhas/<trilha>/<aula>/cordel` e a própria aula ganha o link "Ouvir em cordel" quando o
arquivo existe (com o recurso `escola` ligado). Fica só em português: nos outros idiomas o endereço leva ao folheto em
português.

## Onde fica

Um arquivo por aula: `content/cordel/<trilha>/<aula>.md`, com o mesmo slug do endereço da aula (o que aparece em
`/trilhas/<trilha>/<aula>`).

## O cabeçalho

```yaml
---
aula: "<trilha>/<aula>"                      # igual ao caminho do arquivo
titulo: "O capitalismo em cordel"
autoria: "rascunho, em revisão"              # enquanto ninguém revisar, é exatamente isto
revisado: false
revisadoPor: ""                              # vazio enquanto não revisado
baseado_em: "content/trilhas/<trilha>/<arquivo-da-aula>.md"
xilogravura: "fabrica/sol/chao"              # motivo/céu/chão, de lib/xilogravuras.ts
---
```

- **autoria:** um folheto que ninguém revisou **não é atribuído a ninguém**, nem à "Equipe do Instituto". Fica
  `"rascunho, em revisão"`, e a página mostra a faixa "Rascunho em revisão: confira na aula", com o link da aula.
- **baseado_em:** o arquivo da aula, na pasta `content/trilhas/` da mesma trilha. O teste confere que ele existe.
- **xilogravura:** a vinheta do folheto, montada com as peças que já existem em `lib/xilogravuras.ts`
  (`MOTIVOS`, `CEUS` e `CHAOS`). Sem o campo, entra `livro/sol/chao`.

## O corpo

- **Estrofes em sextilha:** seis versos por estrofe, uma linha por verso, uma linha em branco entre as estrofes.
- **Métrica:** sete sílabas poéticas (redondilha maior), contadas até a última sílaba tônica, com as junções de vogal
  da fala ("que a aula" conta como "quea-au-la").
- **Rima ABCBDB:** o 2º, o 4º e o 6º verso rimam entre si; o 1º, o 3º e o 5º ficam livres.
- **Só o que a aula diz.** O cordel resume a aula: nenhum fato, número, data, nome ou citação que não esteja no texto
  dela. Se a rima pedir uma ideia nova, troque a rima, não a aula. Exemplo inventado da aula continua dito como inventado.

## Como revisar

1. Abra a aula (`baseado_em`) e o folheto lado a lado.
2. Confira estrofe por estrofe: cada afirmação está na aula? Algum número ou data mudou? Alguma ideia ficou mais forte
   ou mais fraca do que no texto?
3. Leia em voz alta, contando as sílabas, e confira as rimas do 2º, 4º e 6º verso.
4. Corrija o que precisar. Se mudar muito, pode reescrever: o folheto é seu a partir da revisão.
5. Ao aprovar, troque o cabeçalho:

   ```yaml
   autoria: "<o nome de quem escreveu ou revisou, como deve aparecer>"
   revisado: true
   revisadoPor: "<seu nome>"
   ```

   É como autorizar uma aula: quem põe o nome responde pelo texto. A faixa de rascunho some, e a página passa a mostrar
   "Revisado por <nome>".

6. Rode `npm run testar:som`: ele confere a forma do arquivo (6 versos por estrofe, nenhuma estrofe vazia,
   `baseado_em` existente, a autoria de rascunho enquanto `revisado: false`) e avisa, sem falhar, quando o 2º, o 4º e o
   6º verso não parecem rimar.

## Escrever um folheto novo

Copie um dos folhetos existentes, troque o cabeçalho e escreva as estrofes a partir da aula, com `revisado: false`.
Folheto novo nasce sempre como rascunho: outra pessoa revisa antes de tirar a faixa.
