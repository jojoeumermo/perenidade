# Departamentos fundidos e termos com texto guardado (etapa 8, B10 e B15)

SQL: `supabase/migracoes/2026-11-departamentos-termos.sql` (idempotente; vai no fim do `install.sql` na integração).
Teste: `npm run testar:departamentos-termos` (PGlite, como os `testar-banco*`).

## B10. UI/UX e Desenvolvimento, e a arte na Comunicação

| Antes | Depois |
| --- | --- |
| função `design` | vira `marketing` (Comunicação: marketing, divulgação, arte e design gráfico), com a mesma data de entrada |
| função `desenvolvimento` | mesmo id, agora chamada "UI/UX e Desenvolvimento" (cuida das telas e do código) |
| representante do departamento `design` | representante da Comunicação (`jornalismo`) |
| página do departamento Design (quadro, pedidos, bastões) | tudo vai para a página da Comunicação; a página Design some da lista |
| candidatura, inscrição, convite, aviso e pedido de ajuda endereçados a `design` | mapeados para `marketing` |

Por que ninguém perde acesso: `interno.tem('design')` já valia para quem tem `marketing` (materiais, imagens, Estúdio de design,
pedidos de arte do podcast). O Estúdio de design continua aberto a marketing, jornalismo e coordenação (`interno.desenha()`).
Quem fazia arte também não ganha acesso ao código: o diagnóstico técnico segue só da coordenação e do desenvolvimento.
Cada pessoa convertida recebe um único aviso explicando a mudança (e que o UI/UX está no outro departamento: a coordenação dá a função).

Escolhas que merecem olho da coordenação:
- O canal e o grupo de conversa `design` **não foram fundidos**: o texto já cifrado só abre com a chave do grupo. Ficam como
  "Arte e design (Comunicação)", e quem é da Comunicação (marketing) segue dentro. Dá para arquivar depois.
- O banco ainda aceita `design` como apelido (gatilho `lucia_unificar_design`), para navegador ou versão antiga do site não quebrar.
  A tela não oferece mais `design` (função `papelAposentado` em `components/painel/comum.tsx`).
- O histórico de cargos registra as trocas como feitas pelo sistema.

### Para a integração (install.sql)
Ao juntar o `install.sql`, pôr esta migração depois do bloco de `departamentos_info` e do `public.termo_meu`/`termo_voluntario_aceitar`
originais, e (opcional) tirar o `design` das listas de papéis. Não precisa: a migração em ordem final dá o mesmo resultado, e o teste
prova que instalar de novo e reaplicar não muda nada. A lista de funções públicas conferida perto do fim do `install.sql` não muda.

## B15. Termos: ninguém fica sem texto

- Termo de voluntário: o painel só abre com o aceite da versão vigente **e** o texto guardado (`interno.termos_aceites`).
- Quem aceitou "sem o texto" (só a data no perfil, com ou sem versão) ganha a versão `anterior` e volta a ver o termo ao abrir o painel.
  Antes, quem tinha a versão em branco nem via o termo. O aceite antigo continua listado para a coordenação como "antigo" até a pessoa aceitar.
- `termo_voluntario_aceitar()` agora recusa (`falta_termo`) quando não há texto guardado da versão vigente: o fluxo é sempre
  `termo_registrar` (guarda o texto, o SHA-256 e a data) e depois `termo_voluntario_aceitar`. Os testes de ponta a ponta usam `aceitarTermo` em `e2e/ajuda.ts`.
- Termo de adesão das Horas: `termo_meu()` devolve `sem_texto`; a aba Horas pede para ler e aceitar de novo (sem perder horas).
- Nada de dado novo de pessoa; a maioridade e o responsável (menor de 18) seguem como já eram, dentro do texto guardado.

## Fora do escopo
- i18n em en, es, fr, ru e zh: só o pt foi atualizado (rótulos de função da candidatura). Os demais ficam como rascunho.

## Novembro, 6: pessoas no painel (T28, T29, T30)

SQL: `supabase/migracoes/20261106-pessoas-painel.sql` (acrescentável e idempotente; já está no fim do `install.sql`). NÃO foi aplicado no banco de produção.
Teste: `npm run testar:pessoas-painel` (PGlite, 80 conferências).

### T28. Várias funções, várias disciplinas e vários departamentos de uma vez
- As funções já moravam numa tabela de ligação (`interno.papeis`: uma linha por pessoa, função e disciplina). Nada migrou; quem tinha várias funções continua com todas.
- `public.papeis_conceder_varios(p_usuario, p_itens, p_departamentos)`: tudo numa ação só, com as mesmas regras de nível de `papel_conceder` (cada item passa por `interno.papel_conceder_um`). Tudo ou nada: se um item for recusado, nenhum entra. A pessoa recebe um recado só.
- Tela: Voluntários e convites › Confiar função. Escolhe-se a função, marcam-se uma ou mais disciplinas (ou departamentos, no representante), "Acrescentar à lista" e repete; depois "Confiar". Também em lote (várias pessoas marcadas na lista). Componente: `components/painel/EscolhaDeFuncoes.tsx`.
- Convite pessoal também leva várias funções (`convites.extras`) e departamentos (`convites.departamentos`); entram quando a conta nasce (gatilho `lucia_convite_extras`). O e-mail do convite cita as funções, nunca os departamentos.
- `papel_conceder` (uma função) continua igual para quem já o chama.

### T29. Convites organizados e troca de e-mail
- `convites_listar` agora diz a `situacao` (valendo, usado, vencido, cancelado), as funções extras, os departamentos e quem usou (nome visto). A tela separa em abas (Esperando, Usados, Vencidos e cancelados, Todos), com busca; os que esperam vêm na ordem de vencimento e os que vencem em até 2 dias ganham o selo "vence logo".
- `public.usuario_email_trocar(p_usuario, p_email, p_motivo)`: só a coordenação comunitária (`interno.lider`), com o segundo fator quando exigido, nunca a própria conta nem a de outra coordenação; motivo obrigatório; e-mail novo não pode ser de outra conta; até 10 trocas por dia.
  - Registro (`email_trocado`) guarda o e-mail **mascarado** (`j***@gmail.com`) e o motivo.
  - Aviso por e-mail ao endereço antigo e ao novo (fila `interno.emails`, a mesma do resto do site) e recado no painel para a pessoa. A senha e as sessões não mudam.
  - Feita dentro do banco, como `usuario_senha_redefinir`: a chave de serviço (service_role) não fica no servidor do site (veja `.env.example`), então a API administrativa do serviço de contas não é chamada pelo site. Nenhuma chave nova foi criada.
  - LGPD, art. 6º, III e VII: o e-mail aparece só na ficha, para quem já o via na lista da equipe.
- Tela: ficha da pessoa › Conta › Trocar o e-mail (`components/painel/TrocarEmail.tsx`), com confirmação.

### T30. Os departamentos de hoje (os grupos da equipe)
| Grupo da equipe | id interno (não muda) | Como se entra |
|---|---|---|
| Coordenação | coordenacao | função |
| Parcerias (coletivos parceiros) | parcerias | participação (novo) |
| Comunicação | jornalismo (+ marketing) | função |
| Influenciadores | influenciadores | participação (novo) |
| Representantes | representantes | quem é representante entra sozinho; também participação (novo) |
| RH · Recursos Humanos | rh | participação (novo) |
| Revisão | revisao | função |
| UI/UX e Devs | desenvolvimento | função |
| Tradução | traducao | função |
| Reforço | mentoria | função |
| Saúde | saude | função |
| Mediação | mediacao | função |
| Acervo e curadoria | curadoria | função |
| Educadores | educacao | função |
| Revolucionários (Frente Revolucionária Lúcia) | revolucionarios | participação (novo, reservado) |

- Nenhum departamento foi apagado nem teve o id trocado: só o nome que aparece mudou (`components/painel/departamentos-do-instituto.ts`). "Geral" continua como grupo de conversa de todos, não como departamento.
- A participação fica em `interno.departamento_membros` (tabela de ligação, RLS ligada e sem regra: só as funções do banco leem e escrevem). Entrar ou sair põe ou tira a pessoa do grupo de conversa do departamento.
- Quem só participa (sem função) abre a página dos próprios departamentos (`departamentos_resumo`, `departamento_ver`).
- **Revolucionários é dado sensível** (opinião e filiação política, LGPD art. 5º, II, e art. 11): só a coordenação põe ou tira alguém, nomeia representante e vê quem participa na lista da equipe; na página do departamento, a lista só aparece para a coordenação e para quem é do próprio departamento; a supervisão não entra no grupo de conversa dele; o registro de atividades grava "reservado" no lugar do nome do departamento; o e-mail de convite não cita departamentos.
- A aba Departamentos (Voluntários e convites) foi reorganizada: "Como funciona" (função, departamento, representante), os departamentos na ordem dos grupos, com como se entra, representantes e quem é, e a educação por área.
