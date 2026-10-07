# Como contribuir

Obrigado por ajudar a construir a biblioteca. Toda contribuição passa por revisão pública antes de entrar.

## Regras do acervo

1. **Só texto.** Aulas são escritas em Markdown. Não aceitamos PDFs, imagens ou outros arquivos.
2. **Só conteúdo livre.** O texto precisa ser seu, estar em domínio público ou ter licença aberta. Não copie trechos de livros, sites ou cursos protegidos.
3. **Suas aulas ficam sob CC BY-SA 4.0.** Ao enviar, você concorda em publicar o texto sob essa licença.
4. **O acervo só indexa.** A ficha de uma obra tem título, autor, sinopse escrita por você e o link para a **página da obra na fonte legítima** (Project Gutenberg, OpenStax, Domínio Público etc.). Nunca um link direto para um PDF, e nunca um site de pirataria.
5. **Escreva para quem está começando.** Frases curtas, exemplos concretos, um assunto por aula.

## O jeito fácil: pelo site

Abra a página **Contribuir**, preencha o formulário e clique em "Enviar pelo GitHub". O arquivo já sai no formato certo. No GitHub, confirme com "Commit changes" e depois "Create pull request".

Para corrigir algo que já existe, use o link "Sugerir correção" no fim de cada aula ou ficha.

## O jeito manual: editando os arquivos

### Uma aula

Crie `content/trilhas/<trilha>/NN-titulo-da-aula.md`. O número `NN` define a posição da aula na trilha.

```markdown
---
titulo: "Título da aula"
resumo: "Uma linha dizendo o que a pessoa vai aprender."
autores: ["Seu nome ou apelido"]
quiz:
  - pergunta: "Uma pergunta sobre a aula?"
    opcoes: ["Primeira opção", "Segunda opção", "Terceira opção"]
    resposta: 1
    explicacao: "Por que a segunda opção é a certa."
---

## Um subtítulo

O texto da aula.
```

- `autores` e `quiz` são opcionais.
- `resposta` é a posição da opção correta, **começando do zero** (0 é a primeira).
- Aulas novas aparecem com o aviso "aguarda revisão da comunidade". Um moderador acrescenta `revisada: true` depois de conferir.

### Uma trilha nova

Crie a pasta `content/trilhas/<nome-da-trilha>/` com um arquivo `_trilha.md`:

```markdown
---
titulo: "Nome da trilha"
area: historia
nivel: "Iniciante"
resumo: "Uma linha sobre a trilha."
---

Um ou dois parágrafos de apresentação.
```

- `area`: `ingles`, `historia`, `informatica`, `programacao`, `matematica` ou `literatura`.
- `nivel`: `Iniciante`, `Intermediário` ou `Avançado`.

### Uma obra para o acervo

Crie `content/acervo/<nome-da-obra>.md`:

```markdown
---
titulo: "Título da obra"
autor: "Nome do autor"
area: literatura
licenca: "Domínio público"
fonte: "Project Gutenberg"
url: "https://www.gutenberg.org/ebooks/55752"
idioma: "Português"
ano: "1899"
---

Sinopse escrita com as suas palavras.
```

- `licenca`: `Domínio público`, `CC BY`, `CC BY-SA`, `CC BY-NC`, `CC BY-NC-SA`, `CC BY-NC-ND` ou `Conforme a fonte` (para acervos em que a licença muda de texto para texto). **Confira a licença na página da fonte** antes de enviar.
- `ano` é opcional.

### Uma tradução

A tradução de qualquer arquivo de conteúdo fica **ao lado do original**, com o código do idioma antes de `.md`:

```
content/trilhas/matematica-fundamental/01-fracoes.md       original (português)
content/trilhas/matematica-fundamental/01-fracoes.en.md    tradução para o inglês
```

Os códigos são `en`, `es`, `zh` e `ru`. No cabeçalho da tradução, repita só os campos de texto (`titulo`, `resumo`, `quiz`). O resto vem do original. Enquanto não houver tradução, o site mostra o texto em português com um aviso.

Traduções feitas só por máquina não são aceitas: o texto precisa ser revisado por quem domina o idioma.

Os textos da interface (menus, botões) ficam em `i18n/`, um arquivo por idioma. O arquivo `pt.ts` é a origem; os outros precisam ter as mesmas chaves.

### Um nome para o Memorial

Crie `content/memorial/<nome>.md`:

```markdown
---
nome: "Nome completo"
nascimento: "1979"
morte: "2018"
local: "Cidade, País"
---

Um parágrafo curto e factual: quem foi, pelo que lutou, como e quando morreu.
```

Use só fatos bem documentados e cite a fonte no Pull Request.

### Um autor

Crie `content/autores/<autor>.md` com `nome`, `anos`, `origem` e, se houver, `arquivo` (link para um acervo livre das obras) e `arquivo_fonte` (nome desse acervo). Para ligar uma obra do acervo ao autor, acrescente `autores: ["<autor>"]` à ficha da obra.

## Antes de enviar

```bash
npm install
npm run build
```

O build valida todo o conteúdo e avisa qual arquivo tem problema.

## Contribuindo com código

Issues e Pull Requests são bem-vindos. Rode `npm run lint` e `npm run typecheck` antes de enviar. O projeto usa Next.js (App Router), TypeScript e Tailwind CSS, com Server Components por padrão.
