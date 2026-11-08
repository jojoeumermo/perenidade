# Campus e calendário (E4-09)

Pacote da onda 3 da Etapa 4. Ideias: D1-1, D1-2, D1-4, D1-5, D1-6, D1-7, R1-46, R1-67 e R1-73.
Tudo o que é novo fora de `/escola` fica atrás de `ligado("escola")`. Sem a flag, o "Mais", o `/explorar` e a página inicial ficam como antes.

## O que tem

| Ideia | Onde | O que faz |
| --- | --- | --- |
| D1-1 Mapa do campus | `lib/escola/campus.ts`, `components/escola/campus/MapaDoCampus.tsx` e `Predio.tsx` | Oito prédios (Escola, Biblioteca, Rádio, Memória e luta, Oficinas, Praça, Território, Secretaria) por cima da lista do "Mais" (`lib/secoes-do-site.ts`). Cada endereço da lista cai em exatamente um prédio, e o teste confere. Com a flag, o "Mais" mostra a grade de prédios (2 colunas no celular, 3 ou 4 no computador). A busca, as "mais usadas", a conta, os ladrilhos, o tema e o idioma continuam lá. `/explorar` e `/escola/campus` mostram o mesmo mapa, e os links funcionam sem JavaScript. |
| D1-2 Clima do prédio | `components/celular/Atalhos.tsx` | Cada prédio usa a cor de um atalho que já existe, um desenho novo no mesmo traço e uma frase de porta. Não entra cor, textura nem fonte nova. |
| R1-73 Passaporte | `lib/escola/passaporte.ts`, `components/escola/campus/RegistroDoPassaporte.tsx` | A primeira visita a cada prédio fica gravada em `lucia:escola:passaporte`, só no aparelho. O modo seguro não grava. O mapa mostra o carimbo e "Conheça o campus: 3 de 8 prédios". Não há pontos nem ranking. |
| D1-5 Ano letivo | `lib/escola/calendario.ts`, `/escola/calendario` | Mostra o semestre atual e o próximo, numa lista por mês. Entram começo, fim, semana de provas (de `semanaDeProvas`, sem redefinir), aulas magnas, feriados e exames. Enquanto a coordenação não confirmar, aparece "Proposto, a confirmar pela coordenação". Cada evento tem "Pôr na minha agenda" (.ics de um evento só, sem recorrência, feito no aparelho na hora do clique). |
| D1-6 Aula magna | `content/escola/calendario.json` e a RPC `aulas_ao_vivo_listar` | Entram as aulas magnas do JSON, que está vazio, e as aulas ao vivo cujo título começa com "Aula magna". Sem nenhuma, aparece "A aula magna do semestre ainda não foi marcada". |
| D1-7 Feriados do campus | `content/escola/feriados.json`, `FeriadoDoCampus.tsx` | São oito datas de luta, cada uma conferida no teste contra `content/neste-dia.json` ou `festaDe` (`components/Festa.tsx`). No dia aparece a faixa "Hoje é feriado no campus", com a fonte e a aula do tema. O feriado não tira aula do plano. |
| R1-46 Exames externos | `content/escola/exames.json` | As datas do ENEM saem de `content/enem/edicao.yml`, com fonte, órgão e data da consulta; o teste confere se ficaram iguais. O link vai para `/enem`. |
| D1-4 Quadro de avisos | `components/escola/QuadroDeAvisos.tsx`, `content/escola/avisos.json` | Mostra no máximo 3 cartões: avisos da coordenação dentro do prazo, o próximo evento, a turma do mês e as 3 novidades mais novas (`/{lang}/novidades.json`, buscadas quando a página fica ociosa). Abaixo vem a presença somada (E4-02). Só aparece para quem volta, ou seja, quem tem aula concluída ou matrícula. Não mostra contador e não manda notificação. Os lidos ficam em `lucia:escola:avisos-lidos`. No celular fica no início; no computador, acima das quatro janelas. |
| D1-4 Continuar no ponto | `components/inicio/Janelas.tsx` (`enderecoDeContinuar`) | Com a flag, o "continue de onde parou" do computador e do celular leva ao parágrafo (`linkDoPonto` + `pontoDaAula`). |
| R1-67 Estação do ano | `components/escola/EstacaoDoAno.tsx`, `app/[lang]/escola/layout.tsx` | Um enfeite pequeno no topo da Escola com o nome do semestre, das férias ou do feriado. O layout recebe `data-semestre` (`1`, `2` ou `ferias`) e `data-feriado`. Não aparece no leitor de tinta, no modo leve nem no leitor. |

Textos: `i18n/escola/campus/{pt,en,es,fr,ru,zh}.json`. Estilos: `styles/escola-campus.css` (só tokens que já existem). A parte do servidor, com textos, montagem do mapa e semestres formatados, fica em `lib/escola/campus-servidor.ts`.

## O que ficou de fora, e por quê

- **Cor, textura e mudança de identidade (D1-2 e R1-67).** O plano manda manter o visual. O clima do prédio ficou no tom que já existe, no desenho em traço e na frase de porta. A estação ficou num enfeite de uma linha.
- **ENCCEJA.** Em 03/11/2026 as páginas oficiais do Inep (área do Encceja e legislação) não traziam a data da próxima edição. Por isso o exame não entrou. Quando a data for publicada, ela entra em `exames.json` com `exame: "ENCCEJA"`, `curso: "eja-de-ponta-a-ponta"`, `fonte` (url oficial) e `consultadoEm`. O teste já confere esse formato.
- **Concursos e vestibulinhos.** Estão na lista "fora" do plano.

## Privacidade

O passaporte e os avisos lidos ficam só no aparelho, em chaves `lucia:escola:*` já registradas em `CHAVES_DA_ESCOLA`. Elas entram na cópia de segurança e somem com "apagar meus dados". O servidor só é consultado em leituras que já existiam e que não levam dado da pessoa: `aulas_ao_vivo_listar`, `novidades.json` (arquivo estático) e a presença somada (E4-02).

## Para atualizar

- **Exames do ENEM** (quando `edicao.yml` mudar), rodando na raiz:

  ```
  node -e "const y=require('js-yaml'),fs=require('fs');const e=y.load(fs.readFileSync('content/enem/edicao.yml','utf8'),{schema:y.CORE_SCHEMA});const j=JSON.parse(fs.readFileSync('content/escola/exames.json','utf8'));j.exames=[...j.exames.filter(x=>x.exame!=='ENEM'),...Object.entries(e.fatos).filter(([k,f])=>f.tipo==='data'&&typeof f.valor==='string').map(([k,f])=>({exame:'ENEM',edicao:e.edicao,etapa:f.afirmacao,data:f.valor,fonte:e.fontes[f.fonte].url,orgao:e.fontes[f.fonte].orgao,consultadoEm:f.conferido,curso:'enem',fato:k}))].sort((a,b)=>a.data.localeCompare(b.data));fs.writeFileSync('content/escola/exames.json',JSON.stringify(j,null,2)+'\n')"
  ```

- **Avisos e aulas magnas:** edite `content/escola/avisos.json` e `content/escola/calendario.json`. O `_sobre` de cada arquivo descreve o formato.
- **Feriado novo:** só entra com o fato já em `neste-dia.json` ou com a data em `festaDe`, e com decisão da coordenação.

## Testes

- `npm run testar:escola-campus`: prédios contra a lista do "Mais", `predioDoCaminho`, passaporte (incluindo o modo seguro), `eventosDoSemestre` (bordas e férias), feriados contra a origem, ENEM contra `edicao.yml`, `.ics` (CRLF, UID, DTSTART em data) e textos nos 6 idiomas.
- `e2e/escola-campus.spec.ts`: sem a flag, o "Mais" fica como antes. Com a flag, o mapa abre, a busca filtra, o carimbo aparece e o modo seguro não carimba. Também cobre o mapa sem JS, `/escola/calendario` em `/pt` e `/zh`, o quadro (aparece para quem volta e não para quem chega), 360 px e o tema escuro.

## Pendências da coordenação

1. Confirmar o ano letivo (`content/escola/ano-letivo.json` e `calendario.json`, `confirmado: true`).
2. Marcar a aula magna de cada semestre (no JSON ou como aula ao vivo com título "Aula magna ...").
3. Aprovar a lista de feriados do campus e os nomes dos prédios e as frases de porta [A REVISAR PELA COORDENAÇÃO].
4. Conferir a divergência no Eldorado do Carajás: `content/neste-dia.json` diz 19 mortos e a aula `historia-da-luta-pela-terra/eldorado-do-carajas` diz 21. O feriado não cita o número.
5. Publicar avisos em `avisos.json` quando houver.
