# Alumia: pedidos entre as frentes de trabalho

Uma frente pede à outra uma mudança num arquivo que não é dela (por exemplo, pôr um componente novo na linha do Início).
Escreva embaixo, com data, quem pede, o arquivo e o que pôr. Quem atende marca "feito" com o commit.

- Faixa 1: telas, linha, perfil, stories, atos, comunidade (`components/rede/**`, `app/[lang]/alumia/**`, `lib/rede/**` fora de fediverso e chat).
- Faixa 2: Fediverso e criptografia (`lib/rede/fediverso/**`, `app/api/fediverso/**`, `app/.well-known/**`, `components/rede/fediverso/**`, chat e `lib/sigilo.ts`).

## Aviso da Faixa 2 (2026-11-10): frente pausada até 2026-11-15

A Faixa 2 parou em 10/11. Até ela voltar, a Faixa 1 pode assumir os arquivos dela.

- `faixa2-fediverso-cripto`: pronto, revisado e com os testes passando. Pode ser juntado na `previa-alumia`. Não juntar direto no `master`.
- `faixa2-wip-chat-blocos-e-privacidade`: **terminado em 12/11/2026** (commit f63fbd9d). Os achados das duas revisões de 10/11 e de uma revisão nova foram tratados (o que é de arquivo da Faixa 1 virou P16 a P20) e os testes da Faixa 2 passam (rede-chat, fediverso, saída, entrada, tela, banco, sigilo, alumia-casca, alumia-rota, rede-integracao). Inclui o atendimento do pedido das caronas pelo chat. Ainda não foi juntado no `faixa2-fediverso-cripto` nem enviado ao GitHub, e as três migrações dele (`20261110-fediverso-privacidade.sql`, `20261110-chat-blocos.sql`, `20261111-chat-caronas.sql`) ainda não rodaram em produção: ordem e passo a passo em `docs/rede/CHAT-PRIVADO.md` e `docs/rede/FEDIVERSO.md`.
- A migração `20261110-fediverso-bloqueio-padrao.sql` já rodou em produção em 10/11. Se `20261109-fediverso-total.sql` ou `2026-11-alumia.sql` forem rodadas de novo, ela precisa rodar em seguida.
- O timer `lucia-fediverso` ainda não foi instalado na VPS (`docs/rede/FEDIVERSO-OPERACAO.md`).
- A tela de gente de fora só aparece depois dos pedidos P0 a P7 abaixo.

## Pedidos

### Faixa 2 → Faixa 1: gente de fora no mesmo visual (F4 do Fediverso), 2026-11-10

Vale para todos os pedidos abaixo:

- As peças já existem em `components/rede/fediverso/` e `lib/rede/fediverso/tela/`. Cada uma confere sozinha a mesma regra:
  dentro da casca nova (`rede-v2` + `alumia-2`) e com `fediverso-total` ligado **ou na prévia** (`deForaVale()` em
  `lib/rede/fediverso/tela/linha.ts`; `fediversoNaTela()` em `components/rede/fediverso/encaixe.tsx`). Fora disso devolvem nulo,
  não baixam o código delas (`next/dynamic`, `ssr: false`) e não pedem nada à rede. Na prévia mostram os dados de exemplo
  (`lib/rede/fediverso/tela/exemplos.ts`) e não chamam rota nem banco.
- Se um pedido não for atendido, nada quebra: a peça fica dormindo e a tela continua como hoje. O que deixa de aparecer está
  dito em cada pedido.
- Regras que as peças já cumprem e que o lugar onde entram precisa manter: nenhuma foto de fora (rosto em mosaico pelo @),
  mídia só pela rota-proxy `/api/fediverso/midia`, HTML de fora só por `HtmlDeFora`, nenhuma lista de quem curtiu ou
  impulsionou, número só a partir de 3.
- As linhas são aproximadas (conferidas em 2026-11-10 no ramo `faixa2-fediverso-cripto`).

#### P0 · 2026-11-10 · Faixa 2 pede · somar o encaixe do Fediverso

Arquivo: `components/rede/encaixes.tsx`, linhas ~24-32 (importações) e ~119 (`ENCAIXES`).

```tsx
import { encaixe as fediverso } from "./fediverso/encaixe";
// …
export const ENCAIXES: EncaixesJuntos = juntarEncaixes([publicar, atos, conversa, org, stories, seguranca, chat, protecao, alcance, fediverso]);
```

E uma linha no comentário do alto: `./fediverso/encaixe   Faixa 2 · gente de fora (Fediverso)`.

Por quê: deixa o caminho fixo registrado como o das outras frentes. Hoje o encaixe é `{}` de propósito (os pontos comuns, como
menu, ações do cartão e abas, não servem a esta etapa: gente de fora entra dentro da linha, do cartão, da conversa, dos avisos
e da busca), então somar não muda nada na tela. Se um ponto comum passar a servir, a Faixa 2 preenche sem novo pedido.

Se não atender: nada muda. Os pedidos P1 a P5 não dependem deste.

#### P1 · 2026-11-10 · Faixa 2 pede · o cartão de fora no lugar do cartão de sempre

Arquivo: `components/rede/CartaoDePost.tsx`, linhas ~79-82 (`export function CartaoDePost`).

```tsx
import { CartaoDeForaNaLinha, eDeForaNaTela } from "./fediverso/encaixe";

export function CartaoDePost(props: PropsDoCartao) {
  const al2 = useAlumia2();
  if (al2 && eDeForaNaTela(props.post)) return <CartaoDeForaNaLinha post={props.post} lang={props.lang} logado={props.logado} completo={props.completo} />;
  return al2 ? <CartaoDaAlumia2 {...props} /> : <CartaoClassico {...props} />;
}
```

Por quê: `CartaoDePost` é a porta única do cartão (linha, perfil, busca, listas). O post de fora tem as mesmas chaves de `Post`
mais `origem: "fediverso"`, mas o `id` é o endereço https da nota e o texto vem em `html`: no cartão de sempre o link do post e as
ações (apoiar, salvar, responder) apontariam para funções do banco que não conhecem esse id. `CartaoRemoto` usa as rotas certas
(`/api/fediverso/interagir`, `responder`, `denunciar`). `aoResponder` não é repassado: responder a um post de fora é do próprio
cartão (vira um post público daqui).

Se não atender: os cartões de fora não devem chegar à linha (não atender o P2 nem o P8 sozinhos), senão saem no cartão de sempre
com links quebrados.

#### P2 · 2026-11-10 · Faixa 2 pede · a linha "Seguindo" com gente de fora no meio

Arquivo: `components/rede/Linha.tsx`. Só a aba `seguindo`, só na casca nova; com sessão, ou na prévia. Depende do P1.

Importações (linhas ~4-17):

```tsx
import { chaveDoItem, deForaVale, estadoInicialDeFora, limiteDaPagina, maisDeFora, misturarDeFora, type EstadoDeFora } from "@/lib/rede/fediverso/tela/linha";
import type { CartaoDeFora } from "@/lib/rede/fediverso/tela/tipos";
```

Estado lembrado (interface `Lembrada`, linhas ~29-36), para voltar ao Início sem pedir de novo:

```tsx
  fora: CartaoDeFora[];
  estadoDeFora: EstadoDeFora;
  foraTemMais: boolean;
```

Estado da linha (perto de `comReposts`, linha ~100):

```tsx
  const comFora = Boolean(al2) && aba === "seguindo" && (previa || logado) && deForaVale(previa);
  const [fora, setFora] = useState<CartaoDeFora[]>(() => lembrada?.fora ?? []);
  const estadoDeFora = useRef<EstadoDeFora>(lembrada?.estadoDeFora ?? estadoInicialDeFora());
  const [foraTemMais, setForaTemMais] = useState(lembrada?.foraTemMais ?? false);
```

Guardar na memória (linha ~114): somar `fora, estadoDeFora: estadoDeFora.current, foraTemMais` ao `memoria.set` (e `fora`,
`foraTemMais` às dependências do efeito).

Primeira página (dentro do `.then` de `rede.linha(aba, null, 20)`, linhas ~133-137): pedir o lado de fora até o limite da página daqui.

```tsx
          const f = comFora ? await maisDeFora(estadoInicialDeFora(), { ate: limiteDaPagina(r.itens, r.proximo), logado }) : null;
          // …devolver `f` junto; no .then seguinte (linhas ~139-146):
          estadoDeFora.current = f?.estado ?? estadoInicialDeFora();
          setFora(f?.itens ?? []);
          setForaTemMais(f?.temMais ?? false);
```

Mais posts (`maisPosts`, linhas ~204-227): a linha continua enquanto um dos dois lados tiver página.

```tsx
    if ((!proximo && !foraTemMais) || maisCarregando) return;
    // …
      const r = proximo ? await rede.linha(aba, proximo, 20) : { itens: [] as Post[], proximo: null };
      // …depois de tratar a página daqui:
      if (comFora) {
        const f = await maisDeFora(estadoDeFora.current, { ate: limiteDaPagina(r.itens, r.proximo), logado });
        estadoDeFora.current = f.estado;
        setFora((atual) => [...atual, ...f.itens]);
        setForaTemMais(f.temMais);
      }
```

Desenho (linhas ~266 e ~336-345): misturar na hora de desenhar, com a chave do item.

```tsx
  const juntos = fora.length ? (misturarDeFora(itens, fora) as unknown as Post[]) : itens;
  const visiveis = silencios.length ? juntos.filter((p) => !silenciadoNoAparelho(p, silencios)) : juntos;
  // …
              <li key={chaveDoItem(p)} …>
```

Fim da linha (linhas ~229-235 e ~347): trocar `proximo` por `proximo || foraTemMais` na sentinela, no botão "mais posts" e na
condição do carimbo "VOCÊ VIU TUDO".

Por quê: são duas listas com cursor próprio. `maisDeFora` guarda o cursor de fora e só pede página nova quando precisa; solta só
o que é mais novo que o post mais antigo da página daqui (`limiteDaPagina`) e guarda o resto na espera, assim a ordem não pula
quando a página seguinte chega. `misturarDeFora` ordena por `criado_em` (estável, os daqui antes no empate) e mostra uma vez só a
nota que veio como original e como impulso (fica a ocorrência mais recente). `chaveDoItem` é a `chave` da linha de fora (o impulso
tem a dele) ou o `id`. `maisDeFora` nunca lança: em erro devolve `erro` e o estado de antes (a linha daqui segue).

Na prévia `maisDeFora` não pede nada: devolve, uma vez só, o post de exemplo da arte (Tião do Morro, `linhaDeExemplo()`) e
encerra o lado de fora. Por isso o P8 mudou: com este pedido atendido, o "exemplo-tiao" daqui precisa sair dos posts de exemplo
(senão o Tião aparece duas vezes; `misturarDeFora` não compara post daqui com cartão de fora).

Limites conhecidos: a pílula "N posts novos" conta só os daqui (`rede.novos`); o que chegou de fora entra ao tocar nela ou ao
recarregar. Uma chamada pede no máximo 3 páginas de fora (60 cartões) por página daqui.

Se não atender: gente de fora não aparece no Início; continua visível só pelo perfil e pelo fio em `/alumia/fediverso`.

#### P3 · 2026-11-10 · Faixa 2 pede · respostas de fora na conversa de um post daqui

Arquivo: `components/rede/conversa/TelaDaConversaAlumia.tsx`, linha ~293 (logo depois do `</ol>` de `ol.al3-fio`, ainda dentro
da `<section aria-label={t.conversa.titulo}>`, depois do fecho `)}` do ternário).

```tsx
import { RespostasDeForaNaConversa } from "../fediverso/encaixe";
// …
        <RespostasDeForaNaConversa post={post} lang={lang} logado={logado} />
```

`logado` é opcional (sem ele vale "sim": a rota só responde a quem entrou).

Por quê: a árvore da conversa daqui não traz as respostas que vieram de outros servidores (`rede_fed_respostas_de` foi feita
para ser chamada junto). A peça desenha uma seção própria ("Respostas de outros servidores"), com o cartão de fora na densidade
compacta, e some quando não há nenhuma. Não entra na árvore daqui (resposta de fora não tem "ajudou", reação nem recolher).

A rota já existe (`GET /api/fediverso/remoto?respostas=<id do post>[&cursor=…]` → `{ itens, proximo, total }`, conferida em
`npm run testar:fediverso-entrada`); a peça a chama por `deFora.respostasDe`. Na prévia aparece a resposta de exemplo da prancha
celular-conversa-fediverso ("Entregador do Porto", `@porto@mastodon.social`), sem pedido nenhum.

Se não atender: as respostas de fora a um post daqui não aparecem na conversa (o aviso de resposta leva ao fio de fora).

#### P4 · 2026-11-10 · Faixa 2 pede · avisos com gente de fora

Arquivos: `lib/rede/tipos-avisos.ts` (interface `ItemDeAviso`, linhas ~13-32) e `components/rede/avisos/Tela.tsx` (laço dos
itens em `ListaDeAvisos`, linhas ~259-300).

Em `tipos-avisos.ts`, o que `rede_aviso_listar` já devolve desde `20261109-fediverso-total.sql` (seção 4):

```ts
/** Os tipos da federação. Não entram em TIPOS_DE_AVISO: a preferência é a do tipo de sempre (curtida = apoio, impulso = citação). */
export const TIPOS_DE_AVISO_DE_FORA = ["fed_seguidor", "fed_resposta", "fed_mencao", "fed_curtida", "fed_impulso"] as const;

// em ItemDeAviso:
  /** Quem é de fora (o mais recente do grupo) e a nota de fora. `avatar` é endereço de outro servidor: NUNCA vai para <img>. */
  ator_remoto?: { ator: string; handle: string | null; nome: string | null; avatar: string | null; servidor: string | null } | null;
  atores_remotos?: unknown[];
  objeto_remoto?: string | null;
```

Em `Tela.tsx`:

```tsx
import { AvisoDeForaNaLista, destinoDoAvisoDeFora, eAvisoDeFora } from "../fediverso/encaixe";
// … dentro do itens.map:
            const deFora = eAvisoDeFora(item);
            const href = deFora ? destinoDoAvisoDeFora(lang, item) : destino(lang, item);
            // …
            const conteudo = deFora ? <AvisoDeForaNaLista item={item} lang={lang} novo={l.novo} /> : ( /* o miolo de hoje */ );
```

O `<li>` e o `Link`/`button` continuam os de hoje (a peça só devolve o miolo `span.al3-aviso-linha`, sem link dentro).

Por quê: hoje o aviso de fora cai na reserva de `fraseDoAviso` (o texto fixo em português que o banco gravou, sem rosto e sem
destino para seguidor e menção). A peça mostra o rosto em mosaico, o @ e o selo do servidor, e leva ao perfil de fora (seguidor),
ao fio de fora (menção, resposta única) ou ao post daqui.

Privacidade (manter em qualquer mudança futura desta tela): em `fed_curtida` e `fed_impulso` NÃO se mostra quem foi, nem nome,
nem @, nem servidor, nem rosto, só "Alguém do Fediverso curtiu/impulsionou o seu post"; o número só a partir de 3. A peça ignora
`ator_remoto` nesses dois tipos. O campo `ator_remoto.avatar` é o endereço cru de outro servidor e nunca pode ir para uma imagem
(vazaria o IP de quem lê).

Se não atender: os avisos de fora continuam aparecendo com o texto genérico do banco, em português, sem rosto.

#### P5 · 2026-11-10 · Faixa 2 pede · achar conta de fora pela busca

Arquivo: `components/rede/descoberta/Buscar.tsx`, linha ~66 (dentro do `<>` dos resultados, antes da seção de pessoas).

```tsx
import { BuscaDeForaNaBusca } from "../fediverso/encaixe";
// …
          <BuscaDeForaNaBusca q={q} lang={lang} />
```

Por quê: quando o que se escreveu é `@nome@servidor`, a peça pede ao servidor da Alumia (`/api/fediverso/buscar`) e mostra a
conta num resumo (mosaico, nome, @, selo) com link para `/alumia/fediverso?conta=…`. Qualquer outro texto: nulo, sem pedido e
sem baixar a peça. Conta da própria Alumia vira link para o perfil daqui.

Se não atender: a conta de fora só é achada pela busca da tela `/alumia/fediverso`.

#### P6 · 2026-11-10 · Faixa 2 pede · menção a `@nome@servidor` no texto

Arquivos: `lib/rede/tipos-conversa.ts` (linhas ~131-147, `MENCAO` e `trechosComMencoes`), `components/rede/conversa/TextoComMencoes.tsx`
(linhas ~14-22) e `components/rede/conversa/CampoComMencoes.tsx` (linhas ~58-80).

Em `tipos-conversa.ts`: hoje `@tiao@mastodon.social` vira link para o perfil DAQUI `@tiao` (a expressão casa só o primeiro
pedaço). Pedido: reconhecer o domínio colado e devolver um trecho próprio.

```ts
const DOMINIO_COLADO = /^@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?![a-z0-9_-])/i;

export type TrechoDoTexto =
  | { tipo: "texto"; valor: string }
  | { tipo: "mencao"; valor: string; handle: string }
  | { tipo: "mencao_de_fora"; valor: string; conta: string };

// em trechosComMencoes, no lugar do push da menção e da conta de `ultimo`:
    const fim = inicio + 1 + m[2].length;
    const fora = DOMINIO_COLADO.exec(texto.slice(fim));
    if (fora) saida.push({ tipo: "mencao_de_fora", valor: `@${m[2]}${fora[0]}`, conta: `@${m[2]}@${fora[1].toLowerCase()}` });
    else saida.push({ tipo: "mencao", valor: `@${m[2]}`, handle: m[2].toLowerCase() });
    ultimo = fim + (fora ? fora[0].length : 0);
```

Em `TextoComMencoes.tsx`:

```tsx
import { ligado } from "@/lib/recursos";
import { enderecoDoPerfilRemoto } from "@/lib/rede/fediverso/tela/tipos";
// …
        t.tipo === "mencao_de_fora" ? (
          ligado("fediverso-total") ? (
            <Link key={i} href={enderecoDoPerfilRemoto(lang, t.conta)} className="font-bold text-[#c21f16] hover:underline">{t.valor}</Link>
          ) : (
            <span key={i}>{t.valor}</span>
          )
        ) : …
```

Em `CampoComMencoes.tsx`: nada obrigatório. Conferido: ao digitar o segundo `@`, `mencaoEmDigitacao` devolve nulo, a lista de
sugestões fecha e o endereço inteiro fica no texto. Opcional, para depois: quando o texto digitado já é um `@nome@servidor`
completo (`contaValida`), oferecer uma sugestão vinda de `deFora.buscar` (mosaico, nome, selo); a Faixa 2 escreve a peça se a
Faixa 1 abrir o ponto.

Por quê: link para um perfil daqui com o mesmo nome confunde e pode apontar para outra pessoa. Limite: o nome antes do domínio
segue a forma daqui (3 a 20 letras, números ou `_`); nomes de fora com ponto, hífen ou mais curtos ficam como texto.

Se não atender: o texto continua legível; só o link de `@nome@servidor` segue apontando para o perfil daqui `@nome`.

#### P7 · 2026-11-10 · Faixa 2 pede · `/@nome@servidor` no endereço da Alumia

Arquivos: `lib/rede/alumia.ts` (tipo `DecisaoDaAlumia`, linha ~88, e o bloco `/@nome`, linhas ~104-109) e `proxy.ts` (linhas ~162-167).

```ts
// alumia.ts, no tipo:
  | { tipo: "redirecionar"; destino: string; busca?: string }

// alumia.ts, dentro do bloco de /@nome, antes do teste de HANDLE:
    const fora = /^([a-z0-9_](?:[a-z0-9_.-]{0,62}[a-z0-9_])?)@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/.exec(handle);
    if (fora && !ap) return { tipo: "redirecionar", destino: "/pt/alumia/fediverso", busca: `?conta=${encodeURIComponent(`@${handle}`)}` };

// proxy.ts, no ramo "redirecionar":
      url.search = decisao.busca ?? "";
```

Por quê: hoje `/@tiao@mastodon.social` no endereço da Alumia cai em `/pt/alumia/u/-` (perfil não encontrado). É o formato que as
outras redes do Fediverso usam para "ver esta conta daqui". Precisa ser redirecionamento e não reescrita, porque o destino da
reescrita vai em `url.pathname` (a busca `?conta=` não cabe ali). A página `/alumia/fediverso` já lê `?conta=` e `?nota=`; com a
flag desligada ela mostra a tela de hoje. Pede também um caso em `scripts/testar-alumia-rota.mjs`.

Se não atender: o endereço curto continua dando "não encontrado"; o perfil de fora abre pelo link completo.

#### P8 · 2026-11-10 · Faixa 2 pede · o post do Tião como post de fora na prévia (revisto em 2026-11-10)

Arquivo: `lib/rede/publicar/exemplos-alumia2.ts`, linhas ~103-110 (o item `exemplo-tiao` de `postsDeExemplo`). Depende do P1.

Há dois caminhos; a Faixa 1 escolhe UM (os dois juntos mostram o Tião duas vezes):

1. **Com o P2 atendido (preferido):** tirar o objeto `exemplo-tiao` de `postsDeExemplo` na aba "Seguindo". O post chega pela
   linha de fora: na prévia `maisDeFora` devolve `linhaDeExemplo()` uma vez, sem pedir nada, e o P1 o desenha com `CartaoRemoto`.
2. **Sem o P2:** trocar o objeto pelo cartão de fora de verdade, sem depender da flag (na prévia `eDeForaNaTela` já vale):

```ts
import { cartaoDeExemplo } from "../fediverso/tela/exemplos";

    // No lugar do objeto "exemplo-tiao": o cartão de fora de verdade (origem: "fediverso").
    { ...cartaoDeExemplo(agora), criado_em: new Date(agora - 34 * MIN).toISOString(), comunidade: "moradia-zona-leste", respostas: 27 } as unknown as Post,
```

Por quê: na prévia o post "Tião do Morro" (`@tiao@mastodon.social`, pranchas computador-inicio e celular-inicio) é hoje um post
daqui com um `@` de fora no `handle`. Com `origem: "fediverso"` ele passa pelo `CartaoRemoto` (P1) e a prévia mostra o cartão de
fora de verdade (selo, curtir, impulsionar, abrir no original), sem chamar rota nenhuma (`deFora.*` devolve exemplos na prévia).
O exemplo não tem imagem de fora. Se algum teste da Faixa 1 acha os posts de exemplo pelo `id`, o `id` passa a ser o da nota de
exemplo. Sem o P1 atendido, nenhum dos dois caminhos: o cartão de sempre receberia um `id` que é endereço https.

Se não atender: a prévia segue como hoje (o selo do servidor aparece pelo `handle`, mas o cartão é o daqui).

#### P9 · 2026-11-10 · Faixa 2 pede · DECISÃO e SQL: post de perfil com público "internet" no modo total

Arquivos: `supabase/migracoes/` (função `public.rede_publicar`; a regra está em `2026-11-rede-publicar.sql:267` e
`2026-11-rede-fundacao.sql:391`) e o seletor de público do compositor (`components/rede/publicar/alumia2/EscreverDaAlumia2.tsx`).

A regra de hoje:

```sql
if v_publico = 'internet' and (c.slug is null or c.categoria <> 'disciplinas') then perform interno.erro('invalido:publico'); end if;
```

O que se pede decidir: com `interno.rede_fed_total()` ligado, aceitar `'internet'` também sem comunidade (post de perfil), com o
rótulo "Internet e Fediverso" no compositor; ou manter a regra e mudar o rótulo de "membros".

Por quê: no modo total só sai para o Fediverso o post em que a PESSOA escolheu "internet" (comentário em
`supabase/migracoes/20261109-fediverso-total.sql:25-32`). Como `rede_publicar` recusa "internet" fora das disciplinas, o post de
perfil escrito pela tela é sempre "membros" e nunca federa: quem segue alguém da Alumia a partir de outro servidor não recebe os
posts de perfil. A resposta a uma nota de fora (`rede_fed_responder_remoto`) já sai como "internet". É decisão de produto e de
LGPD (finalidade: a pessoa precisa ler que o post sai da Alumia), por isso é pedido de decisão e não de código pronto. Nenhuma
migração foi escrita nesta etapa.

Se não atender: nada quebra; a federação de saída continua valendo só para as comunidades abertas das disciplinas e para as
respostas a notas de fora.

#### P10 · 2026-11-10 · Faixa 2 pede · manter o item de menu "Fediverso"

Arquivos: `components/rede/Casca.tsx` (linha ~40), `components/rede/publicar/alumia2/CascaDaAlumia2.tsx` (linhas ~249 e ~513) e
`components/rede/publicar/alumia2/ContaDaAlumia2.tsx` (linha ~58).

Pedido: não mudar nada agora. O item continua apontando para `/alumia/fediverso`:

```tsx
{ chave: "fediverso", href: `${linha}/fediverso`, rotulo: t.menu.fediverso, icone: "fediverso", atual: ativo === "fediverso", emblema: null },
```

Por quê: com gente de fora dentro da linha, a tela `/alumia/fediverso` deixa de ser "a aba do Fediverso" e passa a ser os ajustes
da federação (endereço, ligar e desligar, aparecer em buscas, achar conta) e a página do perfil e do fio de fora (`?conta=`,
`?nota=`). O menu, o cartão "Você também está no Fediverso" da coluna da direita e os links dos avisos dependem desse endereço.
Quando a Faixa 1 quiser trocar o rótulo para "Ajustes do Fediverso" ou mover o item para dentro de Ajustes, o endereço precisa
continuar o mesmo (ou ganhar redirecionamento).

Se não atender (se o item for removido): os ajustes da federação ficam sem entrada pelo menu; os links diretos continuam valendo.

#### P11 · 2026-11-10 · Faixa 2 pede · SQL (próxima migração): avisos de curtida e impulso sem dizer quem foi

**Situação (10/11/2026): resolvido do lado da Faixa 2**, em `supabase/migracoes/20261110-fediverso-privacidade.sql`.
`interno.rede_fed_aviso_remoto` não devolve ninguém em `fed_curtida` e `fed_impulso` (`ator_remoto` nulo, `atores_remotos`
`[]`) e a chave `avatar` saiu de todos os tipos. O total e as pessoas desses dois tipos só saem a partir de 3 (abaixo disso, 1:
"alguém"): para isso `public.rede_aviso_listar` é remendada no lugar, trocando `'total', n.total, 'pessoas', n.pessoas,` por
`interno.rede_fed_aviso_total(n.tipo, …)`. O que fica com a Faixa 1: quem recriar `rede_aviso_listar` precisa levar esse trecho
(ou rodar a migração da privacidade de novo em seguida); o teste do banco do Fediverso acusa se o remendo sumir. Falta só o bloco
entrar no `install.sql` (quem junta as frentes).

O pedido original:

Arquivo: `supabase/migracoes/` (função `interno.rede_fed_aviso_remoto` e o remendo de `public.rede_aviso_listar`, em
`20261109-fediverso-total.sql:366-394`). Nesta etapa não houve SQL novo; fica para a próxima migração.

Pedido: nos grupos de avisos de tipo `fed_curtida` e `fed_impulso`, devolver `ator_remoto` nulo e `atores_remotos` `[]`; e tirar
a chave `avatar` do objeto em todos os tipos (a tela usa o mosaico pelo @, nunca a foto).

```sql
''ator_remoto'', case when n.tipo in (''fed_curtida'', ''fed_impulso'') then null else interno.rede_fed_aviso_remoto(n.ids) -> ''atores'' -> 0 end,
''atores_remotos'', case when n.tipo in (''fed_curtida'', ''fed_impulso'') then ''[]''::jsonb else coalesce(interno.rede_fed_aviso_remoto(n.ids) -> ''atores'', ''[]''::jsonb) end,
```

Por quê: a regra da casa é "nenhuma lista de quem curtiu ou impulsionou". A tela (`AvisoDeFora`) já ignora o campo nesses dois
tipos, mas o dado (endereço, @, nome e o avatar com o endereço cru de outro servidor) chega ao navegador de quem recebeu o aviso.
O avatar cru fica a um `<img>` de vazar o IP de quem lê.

Se não atender: nada muda na tela; o dado continua indo no JSON.

#### P12 · 2026-11-10 · Faixa 2 pede · SQL e depósito (próxima migração): guardar a mídia de fora quando a nota chega

**Situação (12/11/2026): FEITO pela Faixa 2, sem pedir nada à Faixa 1.** As imagens ficam no disco da VPS (não no Storage: o
plano gratuito do Supabase tem 1 GB). Migração `20261112-fediverso-midia-guardada.sql`, `lib/rede/fediverso/midia-guardada.ts`,
a rota-proxy e a de entrega, e `infra/contabo/atualizar.sh` (a pasta montada no contêiner). Detalhe em `docs/rede/FEDIVERSO.md`.

**Situação anterior (10/11/2026): continuava aberto.** A migração `20261110-fediverso-privacidade.sql` não trata disto (ficou de fora de
propósito). O que ela já deixa pronto para este pedido: a nota impulsionada por quem alguém daqui segue passa a ficar guardada,
então a mídia dela entra na mesma conta quando o depósito existir. Continua faltando o lugar no depósito, a coluna com o caminho
guardado e a faxina.

Arquivos: `supabase/migracoes/` (uma tabela ou coluna para o caminho guardado e a regra do depósito) e a faxina que apaga o que
venceu. O código que busca e serve é da Faixa 2 (`lib/rede/fediverso/entrada/**`, `app/api/fediverso/midia/route.ts`).

Pedido: um lugar no depósito para a mídia de fora (por exemplo `rede-midia/fed/<hash do endereço>`), com validade igual à da nota
guardada, para a caixa de entrada baixar a imagem na chegada (ou num lote com atraso sorteado) e a rota-proxy servir a cópia.

Por quê: hoje a rota-proxy esconde QUEM lê (o servidor de fora só vê a Alumia), mas não QUANDO: a imagem só é buscada na origem
no momento em que o primeiro leitor a pede. Um servidor mal-intencionado que mande uma nota pública mencionando uma pessoa só,
com um endereço de imagem único, fica sabendo a hora em que ela abriu o aviso ou o fio. O limite está registrado em
`docs/rede/FEDIVERSO.md` ("Limites conhecidos de privacidade").

Se não atender: o limite continua. Quem lê segue sem expor IP, navegador nem cookie.

#### P13 · 2026-11-10 · Faixa 2 avisa · `chamarComoPessoa` devolve a mensagem crua do banco

Arquivo: `lib/rede/publicar/servidor.ts`, linhas ~27-28.

Sem pedido de mudança obrigatória: é um aviso. O `codigo` devolvido é a mensagem do Postgres cortada em 80 letras; num erro
inesperado (tabela ou coluna que não existe, restrição violada) ela traz nomes internos. As rotas `app/api/fediverso/**` passaram
a filtrar com `codigoParaATela` (`lib/rede/fediverso/servidor.ts`): só sai o que tem a forma de código da casa
(`nao_encontrado`, `invalido:post`); o resto vira `falha`. As rotas `app/api/rede/**` que repassam `r.codigo` direto têm o mesmo
vazamento; se a Faixa 1 quiser, a mesma função serve lá.

### Faixa 2 → Faixa 1: chat privado em blocos (formato "c3"), 2026-11-10

Nenhum destes pedidos segura o chat: as peças da Faixa 2 já funcionam sem eles (`docs/rede/CHAT-PRIVADO.md`).

#### P14 · 2026-11-10 · Faixa 2 pede · o texto de ajuda do "Sair rápido" dizer que a chave do chat também é apagada

Arquivo: `i18n/rede/{pt,en,es,fr,ru,zh}.json`, chave `sairRapidoAjuda` (linha ~89 no pt).

```json
"sairRapidoAjuda": "Apaga o que a Alumia guardou neste aparelho, inclusive a chave do chat privado, e abre uma página comum de fora (a previsão do tempo), sem nada do Instituto."
```

Por quê: o chat passou a pendurar a limpeza dele no `aoSairRapido` (`components/rede/chat/encaixe.tsx`): o banco IndexedDB do
chat inteiro some, e depois é preciso ativar o chat de novo neste aparelho (a chave nova muda o código de segurança). A tela de
Ajustes do chat já avisa; o texto do botão é o outro lugar onde a pessoa lê isso antes de tocar.

Se não atender: nada quebra. O aviso fica só nos Ajustes do chat.

#### P15 · 2026-11-10 · Faixa 2 pede · registrar no NOTICE o uso de `jsqr` e `qrcode` no chat

Arquivo: `docs/NOTICE.md`, linha ~19 (a linha do "Progresso por QR").

Acrescentar ao fim da linha, ou numa linha nova: "O chat privado da Alumia (`components/rede/chat/Qr.tsx`, conferido em
10/11/2026) usa as mesmas duas bibliotecas, do mesmo jeito (baixadas só quando a pessoa abre o código de segurança, rodando no
aparelho; a imagem da câmera não sai dele), para mostrar e ler o QR do código de segurança."

Por quê: nenhuma dependência nova entrou, mas as duas passaram a ser usadas em mais um lugar, e o NOTICE lista os usos.

Se não atender: nada quebra; o registro fica incompleto.

### Faixa 1 → Faixa 2: "Combinar pelo chat" das caronas do ato (pedido de 10/11/2026) — feito pela Faixa 2 em 12/11/2026

O pedido está no `master` e no `b1-juntar` (seção "Pedidos" deste arquivo). **Feito** no ramo `faixa2-wip-chat-blocos-e-privacidade`:

- `supabase/migracoes/20261111-chat-caronas.sql`: `public.rede_dm_abrir_carona(p_carona)`, security definer, `search_path =
  interno, pg_temp`, membro 18+, o ato precisa valer para quem chama (a mesma regra de `interno.rede_ato_aberto`, repetida dentro
  da função para não depender dela), as regras de `rede_dm_abrir` sem exceção (bloqueio, perfil invisível, recusa recente, "quem
  pode me chamar", limite de pedidos) e um limite próprio de 30 por dia que vale também para a recusa. Nenhuma
  resposta devolve o id nem o codinome de quem ofereceu antes de a conversa existir; nenhuma lista de quem combinou. Roda DEPOIS de
  `20261110-alumia-b1-atos.sql` (sem a tabela das caronas, recusa rodar). **Quem junta as frentes:** colar o bloco no `install.sql`
  depois do bloco B1 dos atos (neste ramo ele não entra, porque a tabela da Faixa 1 ainda não está aqui).
- `lib/rede/chat/carona.ts` (o abridor, que baixa o cliente do chat só no toque) e o registro em `components/rede/chat/encaixe.tsx`.
- `lib/rede/atos/combinar.ts` foi copiado do `b1-juntar` **byte a byte**, só para este ramo compilar sozinho: a junção não dá
  conflito. O arquivo continua da Faixa 1.
- A tela das conversas abre `?conversa=<id>` e tira o id do endereço (`components/rede/chat/Tela.tsx`).
- Teste: `npm run testar:rede-chat` (no Postgres local, com a tabela das caronas na mesma forma da B1).
- Recusa que a tela das caronas pode receber (como `Error.message`, pelo `combinarCarona`): `dm_fechada` (sem dizer o motivo),
  `nao_encontrado`, `ato_cancelado`, `ato_passou`, `consentimento`, `muitos_pedidos`. O banco devolve `dm_fechada` como resposta
  (`{erro}`), não como exceção, para o limite valer também na recusa; `lib/rede/chat/carona.ts` a transforma no erro de sempre.

### Faixa 2 → Faixa 1: o que a revisão do chat e da privacidade do Fediverso achou em arquivo da Faixa 1, 2026-11-12

Nenhum destes segura o chat nem o Fediverso. Do lado da Faixa 2, tudo o que dava já foi feito (`docs/rede/CHAT-PRIVADO.md`,
`docs/rede/FEDIVERSO.md`).

#### P16 · 2026-11-12 · Faixa 2 pede · a saída do site (três Esc) rodar também as limpezas do "Sair rápido" da Alumia

Arquivo: `lib/modo-seguro.ts` (linhas ~157-183).

Hoje existem duas saídas rápidas e só a da Alumia chama `ENCAIXES.aoSairRapido` (onde está `apagarTudoDoChat`). A do site apaga o
banco do chat direto, sem avisar o chat. A Faixa 2 já se protege (o banco só nasce na ativação, e a página que encontra o banco
sumido se limpa), mas o certo é a saída do site rodar as mesmas limpezas, ou pelo menos `apagarTudoDoChat` de
`lib/rede/chat/gaveta.ts` (arquivo sem importações, leve).

Se não atender: o banco some do mesmo jeito; as chaves de conversa de outra aba aberta só somem quando ela notar.

#### P17 · 2026-11-12 · Faixa 2 pede · o "Sair rápido" da Alumia encerrar a sessão da conta

Arquivo: `lib/rede/saida.ts` (linhas ~17 e ~66-77).

Hoje ele só apaga as chaves que começam com `lucia:rede`; a sessão mora em `lucia:sessao`. Quem pega o aparelho abre a Alumia já
dentro da conta, vê com quem a pessoa conversa e pode ativar o chat de novo em nome dela. A saída do site revoga a sessão; a da
Alumia, não. Pedido: encerrar a sessão como a saída do site faz. Enquanto isso, o texto dos Ajustes do chat já diz que a conta
continua aberta e aponta "Sair da conta".

Se não atender: o limite continua, dito na tela.

#### P18 · 2026-11-12 · Faixa 2 pede · o "baixar meus dados" não levar quem curtiu nem quem impulsionou (GRAVIDADE ALTA)

Arquivo: `supabase/install.sql` (`public.conta_meus_dados`, linha ~10872).

`conta_meus_dados` despeja `to_jsonb` das linhas de `interno.avisos`, inclusive `ator_remoto` dos tipos `fed_curtida` e
`fed_impulso`: o endereço de quem curtiu, que é dado de terceiro e que a tela de avisos esconde de propósito. Pedido: nessas linhas,
tirar `ator_remoto` (e `atores_remotos`, se aparecer). O histórico do consentimento do Fediverso já entra sozinho (a coluna passou a
se chamar `usuario`).

Se não atender: quem baixa os próprios dados vê o endereço de quem curtiu e impulsionou os posts dela.

#### P19 · 2026-11-12 · Faixa 2 pede · `rede_avisos`, `avisos_meus` e o resumo semanal sem o número exato de curtidas abaixo de 3

Arquivos: `supabase/install.sql` (`public.rede_avisos` ~2072, `public.avisos_meus` ~26890, `interno.rede3_aviso_resumo`).

Só `rede_aviso_listar` aplica o "abaixo de 3 sai 1 (alguém)". As duas RPCs antigas devolvem uma linha por curtida de fora, com a
hora de cada uma, e o resumo semanal soma o total cru. Pedido: deixar de fora `fed_curtida` e `fed_impulso` nessas duas RPCs (ou
juntar numa linha só por post, com o piso) e aplicar o piso no resumo. Se o dono aceitar o número exato para a própria pessoa,
basta dizer isso no `FEDIVERSO.md`.

Se não atender: não sai nome, só o número exato e as horas, para a própria pessoa.

#### P20 · 2026-11-12 · Faixa 2 pede · a lista das caronas não revelar a dona quando quem lê bloqueia alguém

Arquivo: `supabase/migracoes/20261110-alumia-b1-atos.sql` (`interno.rede_ato_caronas_json`, linha ~333) e `public.rede_bloquear`.

A lista tira as caronas de quem está bloqueado nos DOIS sentidos (`not interno.rede_bloqueado(x.quem, p_quem)`). Então quem lê
consegue saber se @Y vai ao ato: bloqueia Y, recarrega a lista, vê quais caronas sumiram, desbloqueia. `rede_bloquear` não tem
limite nem avisa ninguém; dá para testar dezenas de suspeitos por hora. Ir a um ato revela opinião política (LGPD art. 11).
Pedido: filtrar só quando a DONA bloqueou quem lê (é essa a proteção que importa), não quando quem lê bloqueou a dona; e pôr um
limite em bloquear e desbloquear (por exemplo, não desfazer um bloqueio antes de algumas horas). Do lado da Faixa 2,
`rede_dm_abrir_carona` já gasta o limite também na recusa, então não serve mais de atalho.

Pedido junto: apagar as caronas depois do ato (cancelado, ou passou), na faxina. Hoje elas ficam para sempre, e a ligação
"esta pessoa ia a este ato" continua no banco sem utilidade de combinar viagem.

Se não atender: a lista continua respondendo, para quem bloqueia, quais caronas eram de quem bloqueou.
