# Guia de manutenção do Instituto Lúcia

Este é o documento de referência do projeto: como ele é organizado, como se escreve conteúdo, como ligar as contas de voluntários e o que fazer quando algo dá errado.

## 1. A ideia em três frases

1. **O site publicado é feito só de arquivos.** Tudo o que o visitante lê vem da pasta `content/`. Cada mudança fica no histórico de versões e pode ser desfeita.
2. **O banco de dados é um apoio, não o acervo.** Ele guarda contas, a fila de contribuições, as conversas da comunidade e a programação da rádio. Se ele cair ou for invadido, as aulas continuam no ar.
3. **Nada entra sem aprovação.** Contribuições ficam na fila do painel; depois de aprovadas, uma rotina automática as transforma em arquivos de `content/`.

## 2. Regras da casa

- **Design:** não se mexe em fontes, cores nem no texto central da página inicial. Novas páginas reaproveitam as peças que já existem.
- **Simplicidade:** o foco é o ensino. Fórum, jornal e rádio são complementos e ficam fora do caminho de quem só quer estudar.
- **Palavras:** no site se fala em *coordenação, curadoria, educador, revisor, tradutor, jornalista, voluntário*. Não se usam "administrador" nem "moderador".
- **Fontes:** toda aula, matéria, checagem, verbete e homenagem cita pelo menos uma fonte. Nada inventado.
- **Pessoas e organizações:** ao falar de pessoas vivas, partidos ou empresas, só fatos documentados e linguagem sóbria. O objetivo é educar.
- **Direitos autorais:** nenhum arquivo de terceiros é hospedado. O acervo guarda a ficha e o link para a fonte legítima; nunca um link direto para PDF. Letras de música e livros protegidos não são reproduzidos.
- **Privacidade:** nada de rastreadores, anúncios ou scripts de terceiros. Estudar não exige conta.
- **Idiomas:** o site abre sempre em português. Os outros idiomas são inglês, espanhol, chinês e russo.

## 3. Organização das pastas

| Pasta | O que tem |
| --- | --- |
| `content/trilhas/<trilha>/` | `_trilha.md` (título, disciplina, etapa), `plano.json` (roteiro) e uma aula por arquivo |
| `content/acervo/` | fichas de obras escolhidas pela curadoria |
| `content/catalogo/<disciplina>.json` | catálogo ampliado, importado de catálogos abertos |
| `content/autores/`, `memorial/`, `glossario/`, `jornal/`, `checagens/`, `debates/`, `videos/` | uma ficha por arquivo |
| `content/paginas/` | páginas de texto corrido (sobre, voluntariado, linha do tempo, guia de fontes) |
| `content/frases.json`, `content/perguntas.json` | frase do dia e perguntas de partida |
| `i18n/` | textos da interface (`pt.json` é a referência) |
| `lib/areas.ts` | lista de disciplinas, grupos, etapas, licenças e ferramentas |
| `lib/tipos.json` | tipos de contribuição aceitos pelo painel |
| `supabase/install.sql` | banco de apoio, em um arquivo só |
| `scripts/` | roteiros de apoio (ver seção 9) |

Rotas ficam em `app/[lang]/`. Os nomes das rotas são em português (`/trilhas`, `/acervo`, `/ferramentas`…).

## 4. Como escrever conteúdo

Todo arquivo de conteúdo é Markdown com um cabeçalho. O build confere cada campo: arquivo errado quebra o build de propósito, para nunca publicar algo incompleto. HTML dentro do texto não é aceito, e imagens também não.

### Trilha (`content/trilhas/<trilha>/_trilha.md`)

```yaml
---
titulo: "Teoria musical do zero"
area: musica            # uma das disciplinas de lib/areas.ts
etapa: fundamental      # fundamental | medio | superior
ordem: 1                # posição dentro da etapa
resumo: "Uma linha que apresenta a trilha."
---
Parágrafo de apresentação.
```

### Roteiro (`content/trilhas/<trilha>/plano.json`)

Lista ordenada das aulas previstas. Aula que ainda não tem arquivo aparece no site como "em preparação".

```json
[
  { "slug": "o-que-e-som", "titulo": "O que é som" },
  { "slug": "a-pauta", "titulo": "A pauta e as claves" }
]
```

### Aula (`content/trilhas/<trilha>/<slug>.md`)

```yaml
---
titulo: "A pauta e as claves"
resumo: "Onde as notas moram."
autores: ["Nome de quem escreveu"]
revisada: true          # opcional; sem isso aparece o aviso "aguarda revisão"
fontes:
  - titulo: "Nome da obra ou da página"
    autor: "Autor ou instituição"
    ano: "2020"
    url: "https://…"    # opcional
quiz:
  - pergunta: "…"
    opcoes: ["a", "b", "c"]
    resposta: 1         # posição da opção certa, começando em 0
    explicacao: "…"
---
Texto da aula.
```

O nome do arquivo pode ter um número na frente (`03-fracoes.md`); o endereço da aula usa só o slug. A ordem das aulas é a do `plano.json`.

Blocos especiais dentro do texto de uma aula:

````markdown
```pauta
clave: sol
compasso: 4/4
notas: C4/4 D4/4 E4/4 F4/4 | G4/2 G4/2
nomes: sim
```

```teclado
C4 E4 G4
```

```verificar
Quanto vale o 7 em 3,75?
- sete unidades
+ sete décimos
- sete centésimos
> Releia o trecho sobre as casas depois da vírgula.
```
````

Na pauta, cada nota é `LetraOitava/Duração` (C4 é o dó central; `#` e `b` depois da letra; durações 1, 2, 4, 8; `r/4` é pausa; `|` é barra de compasso). No bloco `verificar`, `+` marca a resposta certa e `>` é a dica. Blocos de código `python` e `php` ganham o link "Testar este código".

### Demais fichas

| Coleção | Campos do cabeçalho |
| --- | --- |
| `acervo` | `titulo, autor, area, licenca, fonte, url, idioma`, opcionais `ano`, `autores: [slug]`; o texto é a sinopse |
| `autores` | `nome, anos, origem`, opcionais `arquivo` (https), `arquivo_fonte`; o texto é a biografia |
| `memorial` | `nome, nascimento, morte, local`; o texto é a homenagem |
| `glossario` | `termo, resumo`; texto opcional |
| `jornal` | `titulo, autor, data (AAAA-MM-DD), fontes`, opcionais `subtitulo`, `editoria` |
| `checagens` | `alegacao, veredito (Falso, Enganoso, Falta contexto ou Verdadeiro), data, fontes` |
| `debates` | `afirmacao, resposta, fontes`; texto opcional |
| `videos` | `titulo, canal, url, area, idioma`; o texto diz por que vale assistir |

`ativo: false` no cabeçalho tira qualquer item do ar sem apagá-lo (é a "quarentena" das denúncias).

### Traduções

A tradução de `arquivo.md` é `arquivo.en.md` (ou `.es`, `.zh`, `.ru`), na mesma pasta, repetindo só os campos de texto. Sem tradução, o conteúdo aparece em português com um aviso. Em chinês, deixe a pontuação fora do negrito (`**termo**：`), senão o destaque não aparece.

## 5. Continuar de onde parou

```bash
npm run proximo              # resumo por disciplina
npm run proximo -- musica    # as próximas aulas de uma disciplina
```

O roteiro (`plano.json`) é a memória do que falta. Uma aula conta como pronta quando existe um arquivo com aquele slug, tenha sido escrita pela equipe ou enviada por um voluntário pelo painel; por isso nada é duplicado. Aula enviada sobre um tema fora do roteiro entra no fim da trilha.

Para ampliar uma disciplina: acrescente itens ao `plano.json` ou crie uma nova trilha com `_trilha.md` e `plano.json`.

## 6. Ligar as contas (Supabase)

Sem esta etapa o site funciona, só não aparecem o painel, a comunidade e a rádio.

1. Crie um projeto em supabase.com (o plano gratuito basta). Região: São Paulo.
2. Abra **SQL Editor**, cole o conteúdo inteiro de `supabase/install.sql` e clique em **Run**. Pode rodar de novo quando o arquivo mudar: ele não apaga nada.
3. Em **Project Settings → API**, confira que em *Exposed schemas* **não** aparece `interno` (o padrão já é só `public`).
4. Ainda em **API**, copie a *Project URL* e a chave *anon public*. No serviço de hospedagem do site, crie as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com esses valores e publique o site de novo.
5. Em **Authentication → URL Configuration**, ponha o endereço do site em *Site URL* e acrescente `https://SEU-DOMINIO/**` em *Redirect URLs*.
6. Em **Authentication → Providers → Email**, deixe o e-mail ligado (entrada por link, sem senha). O envio de e-mails embutido é limitado a poucas mensagens por hora: para uso real, configure um SMTP próprio em **Authentication → SMTP Settings**.
7. Entre no site uma vez com o seu e-mail. Depois, no **SQL Editor**, rode:

   ```sql
   select public.promover_coordenacao('seu-email@exemplo.com');
   ```

   A partir daí o painel mostra as abas da coordenação.
8. Para a publicação automática (seção 7), cadastre nos segredos do repositório `SUPABASE_URL` (a mesma *Project URL*) e `SUPABASE_SERVICE_ROLE_KEY` (a chave *service_role*). **Essa chave nunca vai para o site nem para o `.env` de ninguém.**
9. Opcional — entrada com o Google: ligue o provedor em **Authentication → Providers → Google** e crie a variável `NEXT_PUBLIC_AUTH_GOOGLE=1`.

### Papéis

| Papel | O que pode |
| --- | --- |
| coordenação | tudo: aprova voluntários, distribui papéis e disciplinas, decide publicações, cuida do mural e da rádio |
| curadoria | lê a fila inteira, edita e decide |
| educação (por disciplina) | escreve aulas da sua disciplina e vê a fila dela |
| revisão | lê a fila e dá parecer |
| tradução | envia traduções |
| jornalismo | escreve matérias para o jornal |

Quem contribui sem conta, pela página Contribuir, entra na mesma fila.

## 7. Como uma contribuição vira página

1. Alguém envia (pela página Contribuir ou pelo painel). O banco confere tamanho, campos, fonte obrigatória e limite de envios.
2. A coordenação ou a curadoria aprova no painel. Nada muda no site ainda.
3. De hora em hora, a rotina **Publicar contribuições aprovadas** roda `scripts/sincronizar.mjs`: busca os itens aprovados, confere tudo de novo, grava os arquivos em `content/`, monta o site para validar e registra a mudança no histórico.
4. Só então o painel marca o item como publicado.

Para publicar na hora, rode a rotina manualmente. Para pausar as publicações, desative a rotina.

## 8. Segurança: o que protege o quê

- **Tabelas fechadas.** Ficam no esquema `interno`, sem nenhuma permissão direta. A única entrada são as funções do esquema `public`, e cada uma confere quem está chamando.
- **Chaves.** A chave *anon* é pública por natureza e não abre nada sozinha. A *service_role* existe só nos segredos da publicação automática.
- **Texto, não código.** O conteúdo é Markdown sem HTML e sem imagens; links só http(s). Os cabeçalhos de segurança (`next.config.ts`) impedem scripts de fora.
- **Limites.** Envios anônimos têm limite por origem, campo-isca contra robôs e tamanho máximo.
- **Interpretadores isolados.** Python e PHP rodam no navegador de quem usa, dentro de um Worker sem acesso à página.

### Se algo der errado

| Situação | O que fazer |
| --- | --- |
| Foi publicado algo indevido | Reverta o registro de publicação no histórico. O site volta ao estado anterior. |
| Conta de voluntário comprometida | No painel, aba Voluntários: suspenda a conta e retire os papéis. |
| Suspeita de invasão do banco | Desative a rotina de publicação. No Supabase, gere chaves novas (**API → Roll keys**), atualize as variáveis e os segredos. O acervo não é afetado. |
| Banco perdido | Crie outro projeto e rode `supabase/install.sql`. Perdem-se contas, fila e conversas; o conteúdo publicado continua intacto. |
| Enxurrada de contribuições falsas | Recuse em lote no painel; a rotina publica no máximo 25 itens por rodada, e só os aprovados. |

## 9. Roteiros de apoio

| Roteiro | Para que serve |
| --- | --- |
| `preparar.mjs` | copia os interpretadores de Python e PHP para `public/` (roda sozinho após `npm install`) |
| `banco-local.mjs`, `backend-local.mjs`, `dev-local.mjs` | banco de teste em memória para desenvolver o painel |
| `testar-banco.mjs` | instala o banco do zero e testa cada permissão |
| `sincronizar.mjs` | leva as contribuições aprovadas para `content/` |
| `proximo.mjs` | mostra o que falta escrever |
| `conferir-i18n.mjs` | compara os cinco dicionários |
| `conferir-links.mjs` | testa os endereços citados no conteúdo |

## 10. Antes de publicar uma mudança

```bash
npm run lint
npm run typecheck
npm run conferir:i18n
npm run testar:banco
npm run build
```

Mudou a interface? Rode `npm run dev:local` e confira no navegador, inclusive no tamanho de celular e nos cinco idiomas.

## 11. Rádio

A rádio fica "Em breve" para o público até a coordenação clicar em **Pôr no ar** na aba Rádio do painel. Os áudios são enviados pelo próprio painel ou indicados por endereço. Só publique gravações próprias, em domínio público ou com licença que permita a transmissão: música comercial exige licenciamento.

## 12. Apoio financeiro

O endereço da campanha fica em `lib/site.ts`. O mural de apoiadores é preenchido pela coordenação na aba Apoiadores do painel; só entra o nome de quem autorizou.
