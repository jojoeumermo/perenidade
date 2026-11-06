# Escola Revolucionária Lúcia Maria e Frente Revolucionária Lúcia (T15)

Pedido do Jonathan (docs/NOVAS-TAREFAS.md, T15, novembro de 2026): a Escola passa a ser lugar de formação militante
total, e o Instituto Lúcia passa a ser **também** um movimento político, a Frente Revolucionária Lúcia. Nada do que a
Escola tinha saiu: tudo foi reorganizado em volta do cartaz e do chamado.

## O que mudou no site

| Onde | O quê |
| --- | --- |
| `/[lang]/escola` (entrada) | O alto virou um **cartaz** (`components/escola/frente/CartazDaFrente.tsx`): faixa preta com "Frente Revolucionária Lúcia" (lugar de destaque), o nome "Escola Revolucionária Lúcia Maria" em letra de cartaz, o lema "Instruí-vos, agitai-vos, organizai-vos" (bio do Instagram), a linha da Escola e o bloco amarelo **"Estamos chamando voluntários militantes"**, com "Quero militar" e "Ler o manifesto". Depois, tudo o que já existia, na mesma ordem: o que é, Quem foi Lúcia Maria, por onde começar, como funciona, o mapa (com o grupo novo "Frente Revolucionária Lúcia" no topo) e a abertura. |
| Porta da Escola (quem não tem conta) | O mesmo cartaz com o chamado, antes do "Como entrar". |
| `/[lang]/escola/militantes` | **Novo, público.** O chamado: por que militar, como funciona, frentes de trabalho, o cuidado com os dados e o formulário de inscrição militante. |
| `/[lang]/escola/manifesto` | **Novo, público.** O manifesto, com o selo "Versão inicial, em discussão" (texto em `content/escola/manifesto.md`). |
| Faixa da Escola | "Militância" e "Manifesto" logo depois de "Quem foi Lúcia Maria". |
| `/[lang]/escola/quem-foi-lucia-maria` | O texto saiu do marcador: `content/escola/quem-foi-lucia-maria.md`, escrito só com o que as fontes dizem (`FONTES-LUCIA-MARIA.md`). |
| Painel interno, Pessoas, "Candidaturas" | As inscrições militantes chegam na **mesma lista** do voluntariado, com a marca "Militante" e a data do consentimento. Aceitar e recusar funcionam igual. |
| Textos | `i18n/escola/frente/{pt,en,es,fr,ru,zh}.json` (novo pacote) e as chaves novas em `i18n/escola/base`. A linha da entrada não usa mais "universidade" nem "diploma" (regra do projeto). |

As páginas públicas estão em `PUBLICAS_DA_ESCOLA` (`lib/escola/rotas.ts`); a porta deixa passar só elas.

## Design e peso

`styles/escola-frente.css`: linguagem de cartaz de luta (vermelho, preto, amarelo do ipê, sombra dura, estrela),
feita **só com CSS** e um SVG de estrela escrito à mão. Nenhuma biblioteca, imagem ou fonte nova. As cores do
cartaz são fixas (iguais no tema claro e no escuro), com contraste AA conferido: creme sobre vermelho 7:1, preto sobre
amarelo 10:1. Botões com 44 px de toque, foco visível, e a estrela só gira para quem não pediu menos movimento.

## Inscrição militante: banco, LGPD e ECA

Migração: `supabase/migracoes/20261106-t15-frente-militantes.sql` (o mesmo bloco está no fim de `supabase/install.sql`).
**Não foi aplicada no banco de produção**: a coordenação aplica no editor SQL do Supabase. Pode rodar mais de uma vez.

- Mesma fila do voluntariado (`interno.inscricoes`, `public.voluntariar`), com a coluna nova `tipo`
  (`voluntario` | `militante`; padrão `voluntario`, então nada do que existe muda), `consentimento_em` e `maior_idade`.
- **Dado sensível.** Dizer que quer militar numa frente política revela opinião política e filiação a organização de
  caráter político: dado pessoal sensível (LGPD, Lei 13.709/2018, art. 5º, II). O tratamento só com consentimento
  "de forma específica e destacada, para finalidades específicas" (art. 11, I). Por isso: uma caixa só para isso,
  nunca marcada de antemão, com a finalidade escrita; o banco recusa sem ela (`invalido:consentimento`) e guarda o
  momento (`consentimento_em`), porque a prova do consentimento cabe a quem trata o dado (art. 8º, § 2º). Uma
  restrição na tabela impede inscrição militante sem consentimento, mesmo por fora da função.
- **Idade.** A inscrição militante é só para quem declara 18 anos ou mais (`invalido:idade` sem a caixa). Dado sensível
  de adolescente pediria o consentimento de um dos pais ou responsável e o melhor interesse (LGPD, art. 14; ECA, Lei
  8.069/1990, arts. 17 e 18; ECA Digital, Lei 15.211/2025). O site não tem vínculo de contas com responsável, então a
  decisão conservadora é não receber. Quem tem menos de 18 continua estudando na Escola e no site. A autodeclaração é
  o mínimo possível sem pedir documento; ponto de revisão jurídica junto com o da porta da Escola
  (`components/escola/PortaDaEscola.tsx`).
- **Necessidade.** Os campos são os mesmos do voluntariado (nome, e-mail, Instagram opcional, frente de trabalho,
  apresentação). Nenhum endereço de rede é guardado na inscrição; o freio de abuso é o mesmo do voluntariado.
- **Apagar.** O e-mail de confirmação diz que a pessoa pode pedir para apagar a inscrição respondendo a ele.
- Os e-mails (confirmação e aviso à coordenação) dizem que é inscrição militante.

## O que fica para depois

- **Departamento "Revolucionários" no painel**: não foi feito aqui; a T30 (departamentos) cuida disso.
- O manifesto é um rascunho: o Jonathan ajusta em `content/escola/manifesto.md` e copia para `MANIFESTO.md`.
- O texto de "Quem foi Lúcia Maria" não usa as fotos do carrossel do Instagram (são da família; publicar pede
  decisão da coordenação) e não afirma o nome completo dela (as fontes dizem só "Lúcia").

## Testes

`npm run testar:militantes` (banco num Postgres local e as peças do site), `npm run testar:escola` (faixa e
"Quem foi" atualizados) e o teste dos textos da Escola (6 idiomas, sem "universidade"/"diploma").
