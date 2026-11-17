// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O dublê da comunicação da organização para a PRÉVIA (NEXT_PUBLIC_ALUMIA_PREVIA=sim): as mesmas respostas das funções do banco,
// numa memória que some ao recarregar. Tudo inventado. Na prévia, "você" fala pela organização de exemplo e outra pessoa (que não
// aparece) escreveu um dos textos da fila, para dar para ver o aprovar. As regras são as do banco: ninguém aprova o próprio texto,
// o teto do núcleo é 2 em 7 dias, números de pessoas só a partir de 3. Sem "@/" de propósito.
import type { Chamar } from "../cliente";
import type { ConferirDominio } from "../cliente-org-comunicacao";
import { dominioLimpo, LIMITES_DA_COMUNICACAO, type ComunicacaoDaOrg, type DominioDaComunicacao, type ItemDaFila, type MeuBoletim, type ModeloDaOrg, type PublicoDaOrg } from "./comunicacao";
import { HANDLE_DE_EXEMPLO } from "./exemplos";

const hora = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();
const dia = (d: number) => hora(d * 24).slice(0, 10);
let seq = 1;
const novoId = () => `ex-${Date.now().toString(36)}-${seq++}`;
const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

export function chamarDubleDaComunicacao(): { c: Chamar; conferir: ConferirDominio } {
  const item = (x: Partial<ItemDaFila> & Pick<ItemDaFila, "texto">): ItemDaFila => ({
    id: novoId(), tipo: "post", publico: "membros", situacao: "esperando", motivo: null, criadoEm: hora(-3), decididoDia: null, meu: false,
    possoDecidir: true, boletim: null, post: null, retido: null, ...x,
  });
  const fila: ItemDaFila[] = [
    item({ texto: "Assembleia aberta da campanha da tarifa zero no sábado, 10h, na praça da Sé. Traga sua faixa e chame quem mora perto.", publico: "seguidores", criadoEm: hora(-2) }),
    item({ texto: "A sessão de quinta vota o projeto do passe livre estudantil. Nosso voto e o porquê ficam em Prestação de contas.", meu: true, possoDecidir: false, criadoEm: hora(-5) }),
    item({ texto: "Mutirão de cartazes do núcleo Leste confirmado para terça.", situacao: "aprovado", possoDecidir: false, criadoEm: hora(-30), decididoDia: dia(-1), post: "ex-post-1", retido: false }),
    item({ texto: "Rascunho do convite para a plenária de bairro.", situacao: "recusado", motivo: "Falta o endereço do encontro e o horário.", possoDecidir: false, criadoEm: hora(-50), decididoDia: dia(-2) }),
  ];
  let modelos: ModeloDaOrg[] = [
    { id: novoId(), nome: "Chamado para ato", texto: "Ato marcado: [o quê], [quando], [onde]. Venha com o seu núcleo. Cuide de quem está do lado.", publico: "seguidores" },
    { id: novoId(), nome: "Como votamos", texto: "Votamos [sim/não] no projeto [nome]. O porquê, a fonte e o resultado estão em Prestação de contas.", publico: "internet" },
  ];
  const nucleos = [
    { id: "nu-leste", nome: "Núcleo Leste", restam: 1, volta: null as string | null },
    { id: "nu-centro", nome: "Núcleo Centro", restam: 0, volta: hora(52) },
    { id: "nu-sul", nome: "Núcleo Sul", restam: 2, volta: null as string | null },
  ];
  let dominio: DominioDaComunicacao | null = {
    dominio: "mandatapopular.exemplo.org", situacao: "verificado", metodo: "txt", verificadoEm: hora(-24 * 9), conferidoEm: hora(-24 * 9),
    txtNome: "_alumia.mandatapopular.exemplo.org", txtValor: "alumia-dominio=6f1c2a9b0e4d4f7a8c3b5d2e1f0a9b8c",
    arquivo: "https://mandatapopular.exemplo.org/.well-known/alumia-dominio.txt", arquivoTexto: "alumia-dominio=6f1c2a9b0e4d4f7a8c3b5d2e1f0a9b8c",
  };
  let ultimoBoletim: string | null = hora(-24 * 7);
  let meu: MeuBoletim = { assino: false, email: false, saidos: [] };

  const painel = (): ComunicacaoDaOrg => ({
    comunico: true, gerencio: true, selo: true,
    fila: structuredClone(fila).sort((a, b) => Number(b.situacao === "esperando") - Number(a.situacao === "esperando") || b.criadoEm.localeCompare(a.criadoEm)),
    modelos: structuredClone(modelos), nucleos: structuredClone(nucleos),
    boletim: {
      assinantes: 214, porEmail: 87, ultimo: ultimoBoletim,
      proximo: ultimoBoletim && Date.parse(ultimoBoletim) > Date.now() - 6 * 86400e3 ? new Date(Date.parse(ultimoBoletim) + 6 * 86400e3).toISOString() : null,
      posts: [
        { id: "ex-bp-1", texto: "Mutirão de cartazes do núcleo Leste confirmado para terça.", publico: "seguidores", criadoEm: hora(-24) },
        { id: "ex-bp-2", texto: "Votamos não no aumento da tarifa. O porquê está em Prestação de contas.", publico: "internet", criadoEm: hora(-60) },
        { id: "ex-bp-3", texto: "A consulta sobre a pauta de outubro está aberta até domingo para os núcleos.", publico: "membros", criadoEm: hora(-100) },
      ],
    },
    dominio: dominio ? structuredClone(dominio) : null,
  });
  const achar = (id: string) => {
    const i = fila.find((x) => x.id === id);
    if (!i) throw erro("nao_encontrado");
    return i;
  };

  const c = (async (funcao: string, a: Record<string, unknown> = {}) => {
    await new Promise((r) => setTimeout(r, 120));
    switch (funcao) {
      case "rede_org_comunicacao":
        return a.p_handle === HANDLE_DE_EXEMPLO ? painel() : null;
      case "rede_org_fila_escrever": {
        const p = a.p as { texto: string; publico: PublicoDaOrg };
        if (!p.texto.trim()) throw erro("invalido:texto");
        const novo = item({ texto: p.texto.trim(), publico: p.publico, meu: true, possoDecidir: false, criadoEm: hora(0) });
        fila.unshift(novo);
        return novo;
      }
      case "rede_org_fila_decidir": {
        const i = achar(String(a.p_id));
        if (i.situacao !== "esperando") throw erro("ja_decidido");
        if (i.meu) throw erro("outra_pessoa");
        Object.assign(i, a.p_aprovar ? { situacao: "aprovado", post: novoId(), retido: false } : { situacao: "recusado", motivo: String(a.p_motivo ?? "") || null });
        Object.assign(i, { meu: false, possoDecidir: false, decididoDia: dia(0) });
        if (a.p_aprovar && i.tipo === "boletim") ultimoBoletim = hora(0);
        return structuredClone(i);
      }
      case "rede_org_fila_retirar": {
        const i = achar(String(a.p_id));
        if (!i.meu || i.situacao !== "esperando") throw erro("nao_encontrado");
        Object.assign(i, { situacao: "retirado", meu: false, possoDecidir: false, decididoDia: dia(0) });
        return structuredClone(i);
      }
      case "rede_org_modelo_salvar": {
        const p = a.p as { id?: string; nome: string; texto: string; publico: PublicoDaOrg };
        if (p.id) modelos = modelos.map((m) => (m.id === p.id ? { ...m, ...p, id: m.id } : m));
        else {
          if (modelos.length >= LIMITES_DA_COMUNICACAO.modelos) throw erro("limite");
          if (modelos.some((m) => m.nome.toLowerCase() === p.nome.trim().toLowerCase())) throw erro("modelo_existe");
          modelos = [...modelos, { id: novoId(), nome: p.nome.trim(), texto: p.texto.trim(), publico: p.publico }];
        }
        return structuredClone(modelos).sort((x, y) => x.nome.localeCompare(y.nome));
      }
      case "rede_org_modelo_apagar":
        modelos = modelos.filter((m) => m.id !== a.p_id);
        return structuredClone(modelos);
      case "rede_org_nucleo_chamar": {
        const n = nucleos.find((x) => x.id === a.p_nucleo);
        if (!n) throw erro("sem_permissao");
        if (n.restam <= 0) throw erro("teto_do_nucleo");
        n.restam -= 1;
        if (n.restam === 0) n.volta = hora(24 * 7);
        return { post: novoId(), retido: false, avisadas: 12, restam: n.restam, volta: n.volta };
      }
      case "rede_org_boletim_propor": {
        const p = a.p as { texto: string; posts: string[]; publico: PublicoDaOrg };
        if (fila.some((x) => x.tipo === "boletim" && x.situacao === "esperando")) throw erro("boletim_esperando");
        const novo = item({ tipo: "boletim", texto: p.texto.trim(), publico: p.publico, meu: true, possoDecidir: false, criadoEm: hora(0),
          boletim: painel().boletim!.posts.filter((x) => p.posts.includes(x.id)).map((x) => ({ id: x.id, texto: x.texto })) });
        fila.unshift(novo);
        return novo;
      }
      case "rede_org_boletim":
        return structuredClone(meu);
      case "rede_org_boletim_assinar":
        meu = { ...meu, assino: Boolean(a.p_sim), email: Boolean(a.p_sim) && Boolean(a.p_email) };
        return structuredClone(meu);
      case "rede_org_dominio":
        return a.p_handle === HANDLE_DE_EXEMPLO && dominio?.situacao === "verificado" ? { dominio: dominio.dominio, desde: dominio.verificadoEm!.slice(0, 10) } : null;
      case "rede_org_dominio_pedir": {
        const d = dominioLimpo(String(a.p_dominio ?? ""));
        if (!d) throw erro("invalido:dominio");
        const desafio = Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
        dominio = { dominio: d, situacao: "esperando", metodo: null, verificadoEm: null, conferidoEm: null, txtNome: `_alumia.${d}`, txtValor: `alumia-dominio=${desafio}`,
          arquivo: `https://${d}/.well-known/alumia-dominio.txt`, arquivoTexto: `alumia-dominio=${desafio}` };
        return structuredClone(dominio);
      }
      case "rede_org_dominio_tirar":
        dominio = null;
        return { ok: true };
      default:
        throw erro("banco_desatualizado");
    }
  }) as Chamar;

  // Na prévia nada sai da máquina: a conferência "não acha" o que acabou de ser pedido e mantém o verificado como está.
  const conferir: ConferirDominio = async () => {
    await new Promise((r) => setTimeout(r, 300));
    if (!dominio) throw erro("nao_encontrado");
    dominio = { ...dominio, conferidoEm: hora(0) };
    return dominio.situacao === "verificado" ? { ok: true, metodo: dominio.metodo ?? "txt", dominio: structuredClone(dominio) } : { ok: false, motivo: "nao_achou", dominio: structuredClone(dominio) };
  };

  return { c, conferir };
}
