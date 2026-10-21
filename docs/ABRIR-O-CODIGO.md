# Abrir o código: o que já está pronto e o que falta decidir

Conferido em 20/10/2026. O repositório é **privado** hoje. Nada foi publicado nem reescrito: este documento lista o que foi
preparado e o que depende de decisão da coordenação antes de tornar o repositório público.

## Já pronto

- Licença do código: GNU AGPL 3.0 ou posterior (`LICENSE`). Licença do conteúdo: CC BY-SA 4.0 (`LICENSE-CONTEUDO.md`).
- `CONTRIBUTING.md` (como contribuir, regras de privacidade, licenças, acessibilidade e os testes do CI), `CODE_OF_CONDUCT.md`
  e `SECURITY.md` (como relatar falha sem issue pública), sem nome de pessoa, com o e-mail do instituto.
- Créditos e licenças de terceiros: página `/creditos` e `docs/NOTICE.md`.
- Varredura de segredos (padrões de chave do Supabase, OpenAI, AWS e chave privada): **nenhum segredo encontrado** nos arquivos
  versionados. Só existe `.env.example`, sem valores reais.
- O banco local de testes (`npm run testar:banco`) e o modo `npm run dev:local` deixam qualquer pessoa rodar tudo sem acesso
  à produção.

## Decisões que ficam com a coordenação

### 1. Nome pessoal no código

O nome do responsável aparece:

- no cabeçalho de **503 arquivos** (linha "Instituto Lúcia — © <nome>. Licença: AGPL-3.0-or-later");
- em `LICENSE` ("Copyright (C) 2026 <nome>") e no `README.md`;
- em `scripts/testar-banco.mjs`, como nome de uma conta de teste.

Os arquivos novos desta rodada já usam só "Instituto Lúcia". Opções:

- **Manter**: o nome registra a autoria do código (é o titular dos direitos, já que o instituto não tem CNPJ).
- **Trocar por "Instituto Lúcia e colaboradores"**: some o nome, mas, sem pessoa jurídica, a titularidade fica menos clara.
  Pergunte a um advogado antes; a troca é um comando só (substituir a linha do cabeçalho), e a licença não muda.

### 2. E-mail pessoal no histórico do Git

408 registros do histórico têm como autor um e-mail pessoal. Se o repositório for aberto como está, esse e-mail fica público.
Opções (nenhuma foi executada):

- **Publicar a partir de um repositório novo, sem histórico** (recomendado): copiar o estado atual para um repositório limpo,
  com um primeiro registro assinado pelo instituto. O histórico antigo fica no repositório privado.
- Reescrever o histórico (`git filter-repo` com mailmap): muda todos os registros, quebra os clones das outras sessões e os
  links de commits antigos. Só se houver motivo forte.
- Daqui para a frente, em qualquer caso: configurar o Git com o endereço "noreply" do GitHub
  (`git config user.email <id>+<usuario>@users.noreply.github.com`).

### 3. Dados de produção no código

Não há dados de pessoas no repositório. O conteúdo publicado (aulas, acervo) traz o nome público escolhido por quem escreveu,
como já aparece no site.

### 4. Bibliotecas copyleft

O código do site é AGPL, compatível com as bibliotecas GPL usadas (o Blockbench do Estúdio é GPL-3.0 e roda em origem
separada, sem modificação). Não há biblioteca de licença proprietária nem incompatível. Antes de abrir, rode
`npx license-checker --production --summary` e confira se surgiu alguma nova.

## Checklist antes de tornar público

1. Decidir os itens 1 e 2 acima.
2. Conferir de novo os segredos (`git grep` dos padrões de chave) e que `.env*` reais não estão versionados.
3. Rodar o CI inteiro.
4. Proteger a branch principal (revisão obrigatória) e ligar a verificação de segredos do GitHub.
5. Criar as etiquetas de issue **voluntariado** e **bom para começar**.
