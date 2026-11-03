# Vida real e vozes (E4-11): formato dos arquivos

Tudo aqui é conteúdo curado pela coordenação. Nada vai para servidor: as páginas importam estes JSON de forma estática. `npm run testar:escola-vida` confere cada arquivo.

## vozes.json (vozes publicadas)

Começa vazio. Cada voz: `id`, `apelido` (até 40), `oficio` (até 60), `arquivo` (`/arquivos/vozes/<nome>.webm|m4a|mp3|ogg`, que precisa existir em `public/`), `segundos` (até 120), `transcricao` (obrigatória, sem telefone, e-mail, CPF nem endereço de internet), `autorizacao: true`, `data` (AAAA-MM-DD) e `revisao`.

**Antes de publicar:** consentimento livre, informado e específico de quem falou, por escrito (LGPD, art. 7, I, e art. 8); revisão da transcrição; sem nome de terceiro; **nunca voz de menor de 18 anos** (ECA e LGPD, art. 14). **Retirar uma voz:** apagar o item e o arquivo e publicar na hora, sem pedir justificativa (art. 8, § 5). Se o risco legal parecer grande, a coordenação pode manter a lista vazia: o resto do pacote funciona do mesmo jeito.

## trabalhadores-que-ensinam.json

Pares Memorial + aula. `memorial` é o slug de `content/memorial/<slug>.md` e `nome` é o nome como está lá; `aula` (`trilha/aula`) precisa existir em `content/trilhas`; `fonte` é `/memorial/<slug>` ou `/trilhas/<trilha>/<aula>`; `texto` é curto e leva `revisao: true`. Pessoa só do Memorial.

## missoes.json

`id`, `curso` (opcional, slug de `content/escola/cursos`), `lab` (pasta em `app/[lang]/laboratorios`), `perfil` e `exercicio` (só com `lab: "ide"`, e o exercício precisa existir em `content/laboratorios/<perfil>.json`), `titulo`, `situacao`, `tarefa`, `cuidado` e `revisao: true`.

## documentos.json

Lista as aulas que têm o bloco `documento`: `{ "aula": "trilha/aula", "titulo": "..." }`. Começa vazio. Para pôr um documento numa aula, escreva o bloco:

```documento
imagem: /imagens/documentos/modelo.webp | Descrição da imagem para quem não enxerga
fonte: https://endereco-oficial-do-documento
licenca: Modelo oficial em branco, sem direitos reservados
sem-dados-pessoais: sim
Nome do campo | 10 12 40 8 | O que o campo significa. | O que conferir nele.
```

As quatro medidas são em % da imagem (esquerda, topo, largura, altura), de 0 a 100, até 24 áreas. Sem `fonte` (https) ou sem `licenca`, o bloco não aparece. **Só documento sem dado pessoal**: modelo oficial em branco, ato oficial, domínio público ou documento da própria equipe. Nunca holerite, conta ou documento de pessoa real. [A REVISAR PELA COORDENAÇÃO]: escolher os primeiros documentos e conferir os direitos de imagem.