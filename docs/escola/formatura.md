# Do projeto final à formatura: caderneta, projeto, registro, Mural e memória (E4-14)

Pacote da onda 4 da Etapa 4. Sem servidor novo e tudo no aparelho. O único envio é a contagem anônima `escola_formatura`
(`contarEscola`, do E4-02), feita quando a pessoa confirma a formatura. Nada de pessoa, dado ou nota sai do aparelho.
Tudo atrás de `ligado("escola")`; o recurso `escola` continua fora dos padrões de `lib/recursos.ts`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `lib/escola/caderneta.ts` | Puro (roda no Node): `removerRegistro`, `editarRegistro`, `ordenarCaderneta`, `textoDaCaderneta`, `resumoDaCaderneta` e os ajudantes de leitura e escrita das chaves da Escola. |
| `lib/escola/formatura.ts` | Puro: projeto em 6 etapas, `bancaDoCurso`, `apresentacaoFeita`, `criterioDeFormatura`, `formar`, `registroDaFormatura`, `anuncioDoMural`, `validarMemoria`, `memoriaDeFormatura`, `textoDoPedidoDeMemoria`, `textoDaGaveta`. |
| `lib/escola/formatura-servidor.ts` | `cursosParaFormatura()`: os cursos no formato das props (usa `carregarCursos`; sem `fs` novo). |
| `lib/turma.ts` | Só ganhou `registroDoComprovante` e `resumoDoComprovante` (nada que existia mudou). |
| `content/escola/formatura.json` | Regras propostas: `confirmado: false`, etapas obrigatórias, mapa do Mural por curso. |
| `content/escola/memoria-de-formatura.json` | Lista curada pela coordenação. Começa vazia. |
| `components/escola/caderneta/*` | `CadernetaDoTrabalhador`, `ImportarComprovante`, `ExportarCaderneta`. |
| `components/escola/formatura/*` | `ProjetoFinal`, `PainelDeFormatura`, `Cerimonia`, `RegistroDeFormatura`, `PublicarNaGaveta`, `AnuncioDoMural`, `MemoriaDeFormatura`, mais `PaginaDaFormatura`, `ConviteDeMatricula` e `usar-formatura.ts`. |
| `app/[lang]/escola/caderneta/page.tsx` | Substitui a provisória. |
| `app/[lang]/escola/formatura/{page,projeto,mural,memoria,registro}/page.tsx` | O hub e as quatro subpáginas, todas estáticas (6 idiomas, nenhuma por curso). |
| `i18n/escola/formatura/*.json` | Textos nos 6 idiomas. |
| `styles/escola-formatura.css` | Visual (Caderno do Povo), 360 px de entrada, folha de impressão. |
| `scripts/testar-escola-formatura.mjs` | `npm run testar:escola-formatura`. |
| `e2e/escola-formatura.spec.ts` | Roda à parte (não está no CI). |

## Chaves no aparelho

- `lucia:escola:caderneta` (já reservada): registros. Entra na cópia de segurança e sai no "apagar meus dados".
- `lucia:escola:projeto` (já reservada): `{versao: 1, cursos: {[slug]: {tema?, etapas, notas?, gaveta?}}}`. Entra na cópia e sai no "apagar".
- `lucia:escola-privado:mural-rascunho` (nova): `{curso, oficio, descricao}`. Fora da cópia; sai no "apagar". **Nunca** guarda contato, cidade nem telefone.

Nenhuma chave fora dos dois prefixos. `scripts/testar-estudo.mjs` confere a cópia e o apagar das três.

## Caderneta (`/escola/caderneta`)

- Registros agrupados por tipo na ordem fixa: Formaturas, Saberes reconhecidos, Projetos em banca, Turmas, Tarefas e casos, Outros.
  O registro de formatura é o de id `formatura-<curso>`.
- "Registrar algo" cria registros de tipo outro, tarefa ou caso. Só esses (e não os de formatura) se editam; saberes, banca, turma e
  formatura só se removem, com confirmação. No mesmo dia, o registro que entrou por último vem primeiro.
- Horas por curso: estimativa de `horasFeitas` e `horasDoCurso` (cursos.ts) com o selo "estimativa".
- **Importar comprovante** (modo turma): `lerComprovantes` + `resumoDoComprovante` ("Você concluiu 2 de 3 aulas desta turma") e, ao
  confirmar, `registroDoComprovante`. O id é `turma-<código>-<dia>`: importar de novo substitui, não duplica. **O nome que a pessoa
  escreveu no comprovante nunca é copiado** (o teste confere). Sem valor de documento.
- **Exportar**: escolher os registros; Imprimir/Salvar em PDF pela impressão do navegador (o mesmo padrão
  `body:has(> .caderneta-impressao)` da carteirinha) e `.txt`. Nomes de quem avaliou e número de matrícula saem **desligados**;
  ligar nomes de terceiros avisa "só inclua se a pessoa ainda concorda". O "Nome na folha" fica só em memória.
- A folha e o `.txt` terminam com o aviso fixo (`comum.naoEhDocumento`, nos 6 idiomas): não é certificado, não é documento oficial,
  não vale como comprovação de escolaridade; o caminho oficial é o ENCCEJA.

## Projeto final (`/escola/formatura/projeto`)

Seis etapas fixas, cada uma com a data em que a pessoa a marcou: tema, plano, rascunho, revisão, apresentação e entrega. Obrigatórias
para formar: plano, rascunho e apresentação (`content/escola/formatura.json`). Tema (até 120) e notas (até 2000) ficam só no aparelho;
a tela avisa para não pôr nome de outras pessoas.

**Banca popular.** O registro `banca` que o E4-15 grava (`BancaPopular`) com o mesmo `curso` conta como apresentação feita, com a data
do registro e a nota "pela banca popular" (o `turma.md` deixou esta leitura para o E4-14). A pessoa também pode marcar à mão (seminário
da turma). Links para orientação, banca e seminário em `/escola/turmas/...`.

## Formatura (`/escola/formatura`)

`criterioDeFormatura` é só "feito / falta", sem nota nem ranking: todas as aulas (trilha dispensada conta como feita, igual a
`horasFeitas`) mais as etapas obrigatórias do projeto, curso não trancado e ainda não formado. Os motivos são códigos
(`faltam3aulas`, `faltaPlano`, `faltaApresentacao`, `trancada`...) que a tela traduz. Não existe "dispensar o projeto".

Enquanto `confirmado` for `false` em `formatura.json`, a tela mostra "Critério proposto, a confirmar pela coordenação
[A REVISAR PELA COORDENAÇÃO]".

**Minha formatura.** `Cerimonia` pede confirmação ("Confirmo: terminei este curso"), porque `estudante.ts` não tem "desfazer".
Depois `formar` chama `marcarFormatura`, grava o registro `formatura-<curso>` (id estável, não duplica) e chama a contagem anônima
uma vez por semestre. A tela de parabéns não tem som nem confete e respeita `prefers-reduced-motion`.

**Registro de formatura** (`/escola/formatura/registro`): folha A4 com apelido, curso, datas, horas estimadas, patrono **proposto** (só
do Memorial, via `patronoDo`) e o aviso fixo. Sem brasão, sem assinatura, sem selo de autenticidade, sem QR, sem campo de documento: é um
comprovante de estudo feito pela própria pessoa.

**Gaveta Aberta.** `textoDaGaveta` monta o bloco para copiar (tipo "Projeto", título "Projeto final: <curso>", licença sugerida
CC BY-SA 4.0 e o lembrete "sem rosto, sem nome completo e sem documento de ninguém"). O formulário da Gaveta não é preenchido sozinho
(`components/Gaveta.tsx` é compartilhado). "Já enviei" guarda o dia em `lucia:escola:projeto`.

## Mural dos Trabalhadores (`/escola/formatura/mural`)

`anuncioDoMural` monta o título e a descrição que a pessoa copia para o formulário do Mural, que tem moderação. Traz o ofício, o que a
pessoa disse saber fazer (até 600) e a frase fixa "Estudei <curso> na Escola Lúcia Maria, escola popular do Instituto Lúcia. É um
registro de estudo, não uma certificação oficial." Limites do Mural: título de 4 a 160, descrição de 20 a 1200. Texto com telefone,
e-mail ou link é recusado: contato e cidade a pessoa digita só no formulário do Mural.

Só entram cursos de `muralPorCurso`: costura, trancas, barbearia (serviço) e croche-para-vender (produto), todos do ciclo
profissional. **Eletricista fica de fora**: o curso só ensina observar, medir sem energia e anotar, então não pode virar anúncio de
serviço elétrico. A tela diz "Este curso não prepara para oferecer o serviço. Procure um profissional habilitado."
[A REVISAR PELA COORDENAÇÃO]. Cursos de saúde também ficam fora. A tela avisa que anúncio de serviço é para quem tem 18 anos ou mais
([A REVISAR PELA COORDENAÇÃO] se a regra de idade do Mural já existe em outro lugar).

## Memória de formatura (`/escola/formatura/memoria`) — processo da coordenação

1. A pessoa se forma (no aparelho dela), abre a página, escreve o apelido, marca "Tenho 18 anos ou mais e autorizo o uso do apelido" e
   copia o pedido. Ela o envia por `/contribuir`, em "Uma ideia". Nada é enviado sozinho; o formulário não mudou.
2. A coordenação confere o pedido e acrescenta em `content/escola/memoria-de-formatura.json`:
   `{"curso": "slug", "semestre": "AAAA.S", "apelido": "...", "frase": "(opcional, até 140)", "autorizacao": true, "maiorDeIdade": true}`.
3. `npm run testar:escola-formatura` confere a lista. Item sem `autorizacao` ou `maiorDeIdade`, com curso inexistente, curso sensível,
   apelido com cara de nome completo (3 ou mais palavras com inicial maiúscula), e-mail, telefone ou `@`, frase com URL ou e-mail,
   apelido repetido no mesmo curso e semestre, ou mais de 300 itens faz o teste falhar e a página **não mostra a lista** (ela só vale
   inteira, como a monitoria do E4-15).

**Retirar um nome:** apagar o item e publicar. Vale na hora, sem justificativa.

### Por que só maiores de 18 anos
O ECA (Lei 8.069/1990) protege a imagem e a identidade de crianças e adolescentes e o site não pergunta a idade. Por isso a memória só
publica quem declarou ser maior de idade, e a tela explica isso. A memória guarda só apelido e frase curta: sem foto, sem voz, sem nome
completo. [A REVISAR PELA COORDENAÇÃO] a redação do termo e o processo de conferir o pedido.

### Por que cursos de opinião política ficam de fora
"Ano de formação política" e "História do Brasil e das lutas do povo" são cursos sensíveis (`sensivel: true`; LGPD, Lei 13.709/2018,
art. 5º, II e art. 11): listar quem se formou neles revelaria opinião política. A memória não os lista (nem a página nem o texto do
pedido); o teste falha se um item tiver curso sensível. O registro na caderneta da própria pessoa continua normal, pois é só dela, e a
contagem anônima `escola_formatura` fica como o E4-02 definiu.

## Privacidade e LGPD

- Caderneta, projeto, notas e rascunho do Mural ficam só no aparelho: o Instituto não trata esses dados. A única saída é a contagem
  anônima, sem identificador. Cada tela diz "só neste aparelho".
- Nomes de terceiros (quem avaliou, banca) só saem na exportação com a caixa marcada, e a caixa começa desmarcada.
- O comprovante pode ter nome completo; a caderneta nunca o copia.

## Deploy

Nenhum `fs` novo. Os dados curados entram por `import` de JSON e os cursos vêm de `carregarCursos()`, que saberes e matrícula já usam.
Todas as páginas são estáticas e únicas por idioma (6 × 6 = 36 páginas), nenhuma por curso e sem `generateStaticParams`. Nada novo no
layout raiz, na página da aula nem em componente global; o CSS é um só e carrega só nas páginas do pacote.

## Ajustes em relação ao desenho

- `formar` recebe a contagem (`contar`) como parâmetro: `lib/escola/formatura.ts` não importa `banco.ts`; quem a passa é
  `Cerimonia.tsx`, o único arquivo que importa `contarEscola`. Assim a lógica roda no Node sem backend.
- `gravarGaveta` é uma função própria (o campo `gaveta` do projeto), em vez de uma etapa de `gravarEtapa`.
- `anuncioDoMural` recebe também `tituloDoCurso` (a frase de registro de estudo usa o título do curso).
- `apresentacaoFeita` devolve `{feita, dia, pelaBanca}`.

## Fora do pacote

Formatura presencial e encontro anual; lista pública de formados no banco; certificado, diploma, assinatura ou QR; a chave
`lucia:escola:tarefas`; edição de `Mural.tsx`, `Gaveta.tsx`, `lib/gaveta.ts`, `lib/estudo.ts`, `estudante.ts` ou `install.sql`;
"desfazer formatura" (precisa de função nova em `estudante.ts`); entradas na busca e no mapa do campus (de E4-05 e E4-09: acrescentar
caderneta e formatura); PDF com biblioteca própria.
