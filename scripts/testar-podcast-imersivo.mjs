// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o T17 do podcast sem navegador: o áudio espacial (lib/audio-imersivo.ts, a resposta ao impulso gerada aqui, a
// posição dos alto-falantes virtuais, a escolha guardada) e o podcast ao vivo (lib/podcast-ao-vivo.ts: os endereços aceitos
// e quem fica na sala direta), mais as amarras de texto: o tocador usa o modo, nada diz "Dolby", a migração tem o
// consentimento e não grava nada. Uso: npm run testar:podcast (roda depois das regras do banco).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AMBIENTES, lerEscolha, montarEspacial, posicaoDoAltoFalante, respostaAoImpulso } from "../lib/audio-imersivo.ts";
import { LIMITE_DIRETO, PRAZO_LIGAR_MS, enderecoAberto, naSalaDireta, semLigacao } from "../lib/podcast-ao-vivo.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let certos = 0;
const falhas = [];
const conferir = (nome, ok) => (ok ? certos++ : falhas.push(nome));

// ---------------------------------------------------------------- áudio espacial
for (const [nome, p] of Object.entries(AMBIENTES)) {
  const [e, d] = respostaAoImpulso(48000, p);
  conferir(`${nome}: dois canais do tamanho certo`, e.length === Math.round(p.segundos * 48000) && d.length === e.length);
  let energia = 0;
  let diferente = 0;
  for (let i = 0; i < e.length; i++) {
    energia += e[i] * e[i] + d[i] * d[i];
    if (Math.abs(e[i] - d[i]) > 1e-6) diferente++;
  }
  conferir(`${nome}: energia normalizada (≈ 2)`, Math.abs(energia - 2) < 1e-3);
  conferir(`${nome}: canais diferentes entre si (dá largura)`, diferente > e.length / 2);
  conferir(`${nome}: nada antes do pré-atraso`, e.slice(0, Math.round(p.preAtraso * 48000)).every((v) => v === 0));
  conferir(`${nome}: sem valor inválido`, e.every(Number.isFinite) && d.every(Number.isFinite));
  // A cauda cai: o último décimo tem bem menos energia que o primeiro.
  const parte = (a, b) => e.slice(a, b).reduce((t, v) => t + v * v, 0);
  const dez = Math.floor(e.length / 10);
  conferir(`${nome}: a cauda decai`, parte(e.length - dez, e.length) < parte(0, dez) / 20);
  conferir(`${nome}: ambiência baixa (voz clara)`, p.molhado > 0 && p.molhado <= 0.25);
}
const [a1] = respostaAoImpulso(44100, AMBIENTES.sala);
const [a2] = respostaAoImpulso(44100, AMBIENTES.sala);
conferir("a mesma semente dá a mesma sala", a1.every((v, i) => v === a2[i]));
conferir("no máximo 3 segundos de impulso", respostaAoImpulso(48000, { ...AMBIENTES.sala, segundos: 30 })[0].length === 3 * 48000);

const frente = posicaoDoAltoFalante(0);
const direita = posicaoDoAltoFalante(30);
const esquerda = posicaoDoAltoFalante(-30);
conferir("alto-falante a 0° fica à frente", frente.x === 0 && frente.z === -1);
conferir("±30° ficam simétricos, à frente", direita.x > 0 && esquerda.x === -direita.x && direita.z < 0 && direita.z === esquerda.z);

conferir("escolha sem nada guardado: desligado, sala", JSON.stringify(lerEscolha(null)) === JSON.stringify({ ligado: false, ambiente: "sala" }));
conferir("escolha guardada volta", JSON.stringify(lerEscolha('{"ligado":true,"ambiente":"auditorio"}')) === JSON.stringify({ ligado: true, ambiente: "auditorio" }));
conferir("escolha estragada não quebra", lerEscolha("{x").ligado === false && lerEscolha('{"ligado":"sim","ambiente":"igreja"}').ambiente === "sala");

// A cadeia num contexto de mentira: HRTF nos dois lados, convolver com o impulso gerado, e desmontar solta tudo.
{
  const criados = [];
  const no = (tipo) => {
    const n = { tipo, ligacoes: [], desligado: false, connect(o) { n.ligacoes.push(o); return o; }, disconnect() { n.desligado = true; }, gain: { value: 1 } };
    criados.push(n);
    return n;
  };
  const parametro = () => ({ setValueAtTime() {} });
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createGain: () => no("ganho"),
    createChannelSplitter: () => no("separar"),
    createPanner: () => Object.assign(no("painel"), { positionX: parametro(), positionY: parametro(), positionZ: parametro() }),
    createConvolver: () => no("convolver"),
    createBuffer: (canais, tamanho) => ({ canais, tamanho, copyToChannel() {} }),
  };
  const entrada = no("entrada");
  const saida = no("saida");
  const cadeia = montarEspacial(ctx, entrada, saida, "estudio");
  const paineis = criados.filter((n) => n.tipo === "painel");
  conferir("dois painéis HRTF", paineis.length === 2 && paineis.every((p) => p.panningModel === "HRTF"));
  const conv = criados.find((n) => n.tipo === "convolver");
  conferir("convolver com o impulso de dois canais", conv?.buffer?.canais === 2 && conv.normalize === false);
  conferir("o som chega à saída (direto e ambiência)", criados.filter((n) => n.ligacoes.includes(saida)).length === 2);
  cadeia.desmontar();
  conferir("desmontar desliga todos os nós", criados.filter((n) => n !== entrada && n !== saida).every((n) => n.desligado));
}

// ---------------------------------------------------------------- podcast ao vivo
const peertube = ["video.exemplo.org"];
conferir("PeerTube da lista vira tocador", enderecoAberto("https://video.exemplo.org/w/9c9de5e8-0a1e-484a-b099-e80766180a6d", peertube)?.tipo === "peertube");
conferir("YouTube vira tocador", enderecoAberto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", peertube)?.tipo === "youtube");
conferir("domínio de fora fica só como link", enderecoAberto("https://outro.exemplo.net/live", peertube)?.tipo === "link");
conferir("http e lixo são recusados", enderecoAberto("http://video.exemplo.org/w/abc", peertube) === null && enderecoAberto("javascript:alert(1)", peertube) === null && enderecoAberto("", peertube) === null);

const gente = Array.from({ length: LIMITE_DIRETO + 5 }, (_, i) => ({ chave: `k${String(i).padStart(3, "0")}`, nome: "", papel: "aluno" }));
gente.push({ chave: "zzz", nome: "Quem transmite", papel: "educador" });
const primeira = naSalaDireta(gente);
conferir(`até ${LIMITE_DIRETO} pessoas na sala direta, mais quem transmite`, primeira.lista.filter((p) => p.papel === "aluno").length === LIMITE_DIRETO && primeira.lista.some((p) => p.papel === "educador") && primeira.fora.length === 5);
conferir("a ordem é a mesma em todo navegador", JSON.stringify(naSalaDireta([...gente].reverse()).lista) === JSON.stringify(primeira.lista));
const chegou = { chave: "a000", nome: "", papel: "aluno" };
const depois = naSalaDireta([chegou, ...gente], primeira.admitidos);
conferir("quem já assiste não perde a vaga para quem chegou", !depois.admitidos.has("a000") && [...primeira.admitidos].every((c) => depois.admitidos.has(c)));
const saiu = naSalaDireta([chegou, ...gente.slice(1)], primeira.admitidos);
conferir("vaga livre vai para quem espera", saiu.admitidos.has("a000") && saiu.admitidos.size === LIMITE_DIRETO);

// T33: presenças falsas com chaves "0000…" não tomam as vagas: vale a ordem de chegada, e quem não liga o vídeo sai.
const reais = Array.from({ length: 3 }, (_, i) => ({ chave: `f${i}`, nome: "", papel: "aluno" }));
const falsas = Array.from({ length: LIMITE_DIRETO }, (_, i) => ({ chave: `000000000000000${i.toString(16)}`, nome: "", papel: "aluno" }));
const chegada = new Map([...reais.map((p, i) => [p.chave, i]), ...falsas.map((p, i) => [p.chave, 100 + i])]);
const porChegada = naSalaDireta([...falsas, ...reais], new Set(), LIMITE_DIRETO, { chegada });
conferir("com a ordem de chegada, quem chegou antes entra (a chave escolhida não fura a fila)", reais.every((p) => porChegada.admitidos.has(p.chave)));
const t0 = 1_000_000;
const admitidoEm = new Map([...porChegada.admitidos].map((c) => [c, t0]));
const ligaram = new Set(reais.map((p) => p.chave));
const sairam = semLigacao(porChegada.admitidos, admitidoEm, ligaram, t0 + PRAZO_LIGAR_MS + 1);
conferir("quem pegou vaga e não ligou o vídeo no prazo perde a vaga; quem ligou fica", sairam.length === porChegada.admitidos.size - reais.length && sairam.every((c) => c.startsWith("0000")));
conferir("antes do prazo, ninguém perde a vaga", semLigacao(porChegada.admitidos, admitidoEm, new Set(), t0 + 1000).length === 0);
const novaRodada = naSalaDireta([...falsas, ...reais, chegou], new Set(reais.map((p) => p.chave)), LIMITE_DIRETO, { chegada: new Map([...chegada, ["a000", 50]]), barrados: new Set(sairam) });
conferir("barrado não volta logo; a vaga vai para quem espera de verdade, e o barrado recebe o aviso de sala cheia", novaRodada.admitidos.has("a000") && sairam.every((c) => !novaRodada.admitidos.has(c) && novaRodada.fora.some((p) => p.chave === c)));
const salaDireta = ler("components", "podcast", "AoVivoSala.tsx");
conferir("sem retransmissão, quem assiste não liga direto (T33)", /if \(!rede\) \{\s*transmissao\.current = null;\s*setFase\("semRede"\)/.test(salaDireta));
conferir("sem retransmissão, quem transmite não começa e sai do ar (T33)", /if \(!rede\) return void \(await desistir\(s\.semRedeEstudio\)\)/.test(salaDireta) && /podcast_ao_vivo_encerrar/.test(salaDireta));
conferir("sem câmera, segue só com o som (faixa preta); sem microfone, para o pulso e sai do ar (T33)", /video = faixaPreta\(\);\s*inicial = "audio";/.test(salaDireta) && /window\.clearInterval\(pulso\)/.test(salaDireta) && /return void \(await desistir\(s\.falhaMidia\)\)/.test(salaDireta));
conferir("os trilhos abertos param na saída e no erro (o microfone não fica aceso)", /trilhos\.forEach\(\(tr\) => tr\.stop\(\)\)/.test(salaDireta));
const rotaRede = ler("app", "api", "aovivo", "rede", "route.ts");
conferir("TURN (T33): limite por pessoa e faixa antes de qualquer credencial", /limitador\.consumir\(ipDoPedido\(pedido\.headers\)\)/.test(rotaRede) && rotaRede.indexOf("limitador.consumir(") < rotaRede.indexOf("generate-ice-servers"));
conferir("TURN (T33): uma credencial por sala a cada poucos minutos", /daSala\.get\(sala\)/.test(rotaRede) && /daSala\.set\(sala/.test(rotaRede));
conferir("TURN (T33): teto do mês com folga (600 GB)", /TETO_BYTES = 600 \* 1024 \*\* 3/.test(rotaRede));
for (const idioma of ["pt", "en", "es", "fr", "ru", "zh"]) conferir(`${idioma}: textos do podcast sem retransmissão`, Boolean(JSON.parse(ler("i18n", `${idioma}.json`)).podcast?.aoVivo?.semRedeEstudio));

// ---------------------------------------------------------------- amarras de texto
const tocador = ler("components", "RadioPlayer.tsx");
conferir("o tocador do layout tem o botão do modo", tocador.includes("<BotaoEspacial disponivel={processavel} />"));
conferir("o tocador troca o elemento <audio> entre som processável e som de fora", tocador.includes("key={chaveDoAudio}"));
conferir("o tocador retoma a Web Audio suspensa", tocador.includes('addEventListener("statechange"'));
conferir("o layout monta o tocador (o som segue entre páginas)", ler("app", "[lang]", "layout.tsx").includes("RadioPlayer"));
const pagina = ler("app", "[lang]", "podcasts", "page.tsx");
conferir("a página do podcast tem o cartão do modo e o ao vivo", pagina.includes("<CartaoEspacial />") && pagina.includes("<PodcastAoVivo"));
for (const idioma of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const dic = JSON.parse(ler("i18n", `${idioma}.json`));
  conferir(`${idioma}: textos do modo e do ao vivo`, Boolean(dic.radio?.espacial?.nome && dic.podcast?.aoVivo?.consentimento && dic.errors?.consentimento));
  conferir(`${idioma}: nada de "Dolby" na tela`, !JSON.stringify(dic.radio.espacial).includes("Dolby"));
}
for (const arq of ["AudioEspacial.tsx", "AoVivo.tsx"]) conferir(`components/podcast/${arq} sem "Dolby"`, !ler("components", "podcast", arq).includes("Dolby"));
const migracao = ler("supabase", "migracoes", "20261106-t17-podcast-ao-vivo.sql");
conferir("migração exige o consentimento (LGPD art. 7º, I)", migracao.includes("interno.erro('consentimento')") && /art\. 7º/.test(migracao));
conferir("migração não guarda gravação nem quem assiste", !/gravac|grava\b|espectador/i.test(migracao.replace(/--.*$/gm, "")));
conferir("install.sql tem a migração", ler("supabase", "install.sql").includes("podcast_ao_vivo_estado"));
const rede = ler("app", "api", "aovivo", "rede", "route.ts");
conferir("o TURN serve também o podcast ao vivo", rede.includes("podcast_ao_vivo_estado"));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`podcast imersivo e ao vivo: ${certos} conferências certas`);
