# Mural de Saúde: adequação às normas de publicidade da psicologia (2026-10-25)

Não é parecer jurídico. Base conferida nas fontes: Código de Ética Profissional do Psicólogo (Res. CFP 10/2005, art. 20, texto oficial do CFP), cartilha "Orientações sobre publicidade profissional" do CRP-MG (2ª edição, abril de 2026), que cita a Res. CFP 03/2007 (arts. 53 a 58), a Nota Técnica CFP 1/2022 (redes sociais), a Nota Técnica CFP 1/2023 (constelações familiares) e a Res. CFP 07/2023 (laicidade).

Decisões marcadas com **[conservador]** escolheram o lado mais restritivo.

## 1. Plano

### O que não muda
- As 7 condições de `interno.saude_apto` (cargo, termo vigente, assinatura gov.br conferida, registro conferido há menos de 180 dias, texto aprovado pelo profissional, publicação, não suspenso) ficam exatamente como estão.
- A chave geral (`saude_chave`), a autenticação, a RLS e os dados existentes (nada é apagado).
- A rota `/saude` continua a mesma: não há redirecionamento a fazer.

### O que entra
1. **Arquivo único de regras e textos:** `content/saude/regras.json` (nome do mural, versão do termo, categorias ligadas, lista de bloqueio com motivo e sugestão, textos das telas). `npm run mural:sincronizar` leva a lista, as categorias e a versão do termo para o banco; `npm run testar:mural` confere que os dois lados estão iguais.
2. **Só psicologia ligada:** flag por categoria; as demais ficam desligadas. Perfil de categoria desligada continua guardado, sai do ar e o profissional é avisado no painel.
3. **Filtro no servidor:** o banco confere todo texto livre (nome, abordagem, áreas, cidade, "Sobre meu trabalho") antes de gravar, também na edição da coordenação. Normaliza acentos, caixa, espaços, letras soltas ("g r á t i s") e números no lugar de letras ("gr4tis"). Bloqueio registra a tentativa no registro do perfil (só o grupo da regra e o campo, sem o texto).
4. **Camada de exibição por cima das 7 condições** (`interno.saude_visivel`): além de `saude_apto`, exige categoria ligada, declarações novas da versão vigente e texto limpo pelo filtro. **[conservador]** Um perfil antigo com termo proibido sai do ar mesmo já aprovado.
5. **Termo novo (2026-10-25):** cláusulas de independência política e de responsabilidade pela publicidade; duas declarações obrigatórias registradas com data e versão. Todos os perfis existentes ficam aguardando novo aceite, nova assinatura gov.br e nova aprovação do texto, e recebem aviso no painel.
6. **Tela de aviso antes do cadastro,** com o aceite registrado.
7. **Cartão com campos fixos:** "Psicóloga", "Psicólogo" ou "Psicóloga(o)" (escolhido numa lista, não digitado), registro no formato `CRP 05/12345`, link para conferir no conselho; opcionais estruturados (abordagem, áreas, público, modalidade, cidade e estado, idiomas); "Sobre meu trabalho" com até 500 caracteres. Saem o campo de valor, a etiqueta do mural no cartão e a estrela. **[conservador]** "Dr./Dra." fica bloqueado para todos, porque o mural ainda não confere título de doutorado.
8. **Visual neutro** em toda a vitrine (fundo #F4EBDB, texto #221C17): sai o lema, a estrela, o cartaz preto e vermelho e o vermelho dos botões; a faixa de emergência fica em tinta escura. Rodapé com link para a nova página "Neutralidade do mural" (`/saude/neutralidade`).
9. **Página inicial:** cartão neutro, sem nenhum nome.
10. **Ordem alfabética, sem destaque:** sem nota, sem "novo", sem "mais procurado". O filtro por área continua, porque só restringe a lista e não ordena nem destaca.
11. **Testes:** `scripts/testar-mural-saude.mjs` (filtro, variações, sincronia com o banco, varredura dos 6 idiomas, metadados, e-mails e página inicial) e casos novos em `scripts/testar-banco.mjs` (perfil com texto proibido não publica, termo antigo fica oculto, categoria desligada nunca aparece, as 7 condições continuam exigidas).

### Arquivos
- Novos: `content/saude/regras.json`, `lib/mural-saude.ts`, `app/[lang]/saude/neutralidade/page.tsx`, `scripts/mural-saude-sincronizar.mjs`, `scripts/testar-mural-saude.mjs`, `supabase/verificar-mural-de-saude.sql`, este relatório.
- Alterados: `supabase/install.sql` (bloco da vitrine), `lib/saude.ts`, `lib/termos.ts`, `components/saude/Vitrine.tsx`, `components/saude/FaixaDaSaude.tsx`, `components/saude/cartao.ts`, `app/[lang]/saude/page.tsx`, `app/[lang]/saude/termo/page.tsx`, `app/[lang]/page.tsx`, `components/painel/Saude.tsx` e os textos do painel que citavam o nome antigo, `lib/interdicao.ts`, `lib/seo.ts`, `app/sitemap.ts`, `i18n/{pt,en,es,fr,ru,zh}.json`, `i18n/painel/{en,es,fr,ru,zh}.json`, `scripts/testar-banco.mjs`, `package.json`.

## 2. Textos novos das telas (português)

**Nome:** Mural de Saúde (constante `nome` em `content/saude/regras.json`).

**Descrição (página, metadados, compartilhamento):** "Mural de contatos de profissionais de saúde com registro ativo. O Instituto Lúcia apenas divulga contatos e não presta nem organiza atendimentos. As condições do atendimento são tratadas diretamente com o profissional."

**Leia antes de entrar em contato:**
- O Instituto Lúcia não presta, organiza, agenda, acompanha nem garante atendimentos, e não participa de nenhuma conversa entre você e o profissional.
- As condições do atendimento são tratadas diretamente com o profissional.
- Os textos de cada perfil são de autoria e responsabilidade do profissional. O conteúdo desta seção tem caráter informativo e não substitui consulta.
- O Instituto não indica, não avalia e não classifica profissionais: os perfis aparecem em ordem alfabética.
- Isto não é serviço de emergência. Em urgência, ligue 192 (SAMU) ou 193 (Bombeiros). Em crise emocional, ligue 188 (CVV, 24 horas).
- Não envie dados de saúde, exames ou documentos por este site. Os links de contato levam a ferramentas de terceiros.
- Antes de iniciar o atendimento, confira o registro do profissional no site do conselho.

**Como funciona:** 1. Escolha: "Os perfis aparecem em ordem alfabética: não há ranking, destaque nem indicação." 2. Baixe o cartão. 3. Fale direto: "Mande o cartão ao profissional pelo contato que ele autorizou. As condições do atendimento são tratadas diretamente com o profissional."

**É profissional de saúde?** "Profissionais com registro ativo no conselho da sua categoria podem pedir para aparecer no mural. Por enquanto, o mural está aberto só para a psicologia: as outras categorias entram depois que as normas de publicidade de cada conselho forem revisadas. Escreva para (e-mail): a coordenação cria o seu acesso ao painel, onde você preenche o perfil, aceita o termo e aprova o texto antes de ir ao ar." + "Ler o termo do mural".

**Aviso antes do cadastro:** "O Instituto Lúcia tem posicionamento político declarado (Ler o posicionamento do Instituto). O mural de saúde é independente dessas posições. Participar não significa apoiá-las." Botão: "Entendi, quero continuar".

**Declarações no aceite do termo:**
- "Declaro que o conteúdo do meu perfil respeita o Código de Ética Profissional e as normas de publicidade do meu conselho, e que sou responsável por ele."
- "Li o aviso sobre o posicionamento do Instituto e entendo que participar do mural não significa apoiar posições políticas do Instituto, nem o contrário."

**Orientação da foto:** "Use uma foto profissional e adequada ao exercício da profissão. Recomenda-se separar perfil pessoal e profissional. Nunca use foto de paciente, de teste psicológico ou de caso atendido."

**Página inicial:** rótulo "Mural de Saúde", título "Mural de profissionais de saúde", texto curto do aviso, botão "Ver o mural". Sem nomes.

**Neutralidade do mural:** está em `textos.neutralidade` de `content/saude/regras.json`.

## 3. O que foi feito (resultado)

- Implementado conforme o plano acima. Testes: `npm run testar:mural` (394 conferências, 0 com problema), `npm run testar:banco` (1.702 conferências, 0 com problema, incluindo os casos novos do mural e a conferência de cada termo da lista no servidor), `npm run typecheck` e lint sem erros.
- Também ficou de fora do mural: o aviso político de abertura do site e a faixa do alto (que dizia "100% gratuito"), trocada por uma faixa neutra só nas páginas do mural.
- **[conservador]** O modelo de post "Saúde Solidária (cartão de profissional)" do estúdio de artes foi retirado: dizia "Atende de graça", trazia o lema político e punha nome e foto de profissional em rede do Instituto, o que o termo novo proíbe.
- **[conservador]** O perfil publicado pelo arquivo do site (content/saude/profissionais.json) saiu do ar: ele só volta com "termo_versao" igual à versão vigente, depois que a pessoa aceitar o termo novo.
- O cartão de encaminhamento é desenhado no aparelho de quem procura e não tem página própria: não há o que marcar com noindex. A página do mural já estava fora dos buscadores e do mapa do site.

## 4. Pendências manuais

1. Rodar o arquivo de instalação do banco de novo (ele é idempotente; a migração dos perfis roda uma vez só) e depois `supabase/verificar-mural-de-saude.sql` para conferir.
2. Pedir aos profissionais já cadastrados que entrem no painel: ler o aviso, aceitar o termo novo, assinar no gov.br e aprovar o texto. Eles recebem o aviso no painel automaticamente.
3. Para o perfil que estava no arquivo do site: obter o novo aceite e acrescentar `"termo_versao": "2026-10-25"` na entrada (ou migrar a pessoa para o painel).
4. Revisão jurídica do termo e da lista de bloqueio (o texto continua marcado como rascunho).
5. Antes de abrir outra categoria, revisar as normas de publicidade do conselho dela e mudar `"ligada"` em content/saude/regras.json (e rodar `npm run mural:sincronizar`).
6. Se trocar o nome do mural, mudar `"nome"` em content/saude/regras.json e os títulos de `saude.title` nos 6 arquivos de idioma.
