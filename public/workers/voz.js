// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A voz natural das aulas, numa linha de execução separada para a página não travar. Tudo vem do próprio site
// (/vozes/, preenchida por "npm run vozes:baixar"); nada vai para fora. O que baixa fica guardado no navegador
// (Cache Storage, "lucia-vozes"), conferido pelo sha256, e serve de novo sem internet. Só abre depois do clique.
//
// Mensagens que recebe:  { t: "carregar", voz }  ·  { t: "falar", id, texto, velocidade }
// Mensagens que manda:   { t: "progresso", feito, total }  ·  { t: "pronto", provedor }  ·  { t: "audio", id, pcm, taxa }
//                        { t: "erro", id?, mensagem }
importScripts("/workers/voz-motor.js");

var CACHE = "lucia-vozes";
var motor = null;
var carregando = null;
var vozAtual = null;
var progresso = { feito: 0, total: 0, visto: {} };

function avisarProgresso() {
  self.postMessage({ t: "progresso", feito: progresso.feito, total: progresso.total });
}

/** Busca um arquivo do site, com progresso, guarda no navegador e confere o sha256. */
async function buscar(arquivo) {
  var url = arquivo.url;
  var cache = null;
  try {
    cache = await caches.open(CACHE);
  } catch {
    cache = null; // navegação privada: baixa assim mesmo, sem guardar
  }
  var guardado = cache ? await cache.match(url) : null;
  if (guardado) {
    var dados = await guardado.arrayBuffer();
    progresso.feito += arquivo.bytes || dados.byteLength;
    avisarProgresso();
    return dados;
  }
  var resposta = await fetch(url, { credentials: "same-origin" });
  if (!resposta.ok || !resposta.body) throw new Error("arquivo da voz indisponível (" + resposta.status + ")");
  var leitor = resposta.body.getReader();
  var pedacos = [];
  var recebido = 0;
  for (;;) {
    var parte = await leitor.read();
    if (parte.done) break;
    pedacos.push(parte.value);
    recebido += parte.value.byteLength;
    progresso.feito += parte.value.byteLength;
    avisarProgresso();
  }
  var junto = new Uint8Array(recebido);
  var pos = 0;
  pedacos.forEach(function (p) { junto.set(p, pos); pos += p.byteLength; });
  if (arquivo.sha256 && !(await MotorDeVoz.conferirSha256(junto, arquivo.sha256, crypto.subtle))) throw new Error("arquivo da voz não confere (sha256)");
  if (cache) {
    try {
      await cache.put(url, new Response(junto, { headers: { "content-type": "application/octet-stream" } }));
    } catch {
      // sem espaço: fica só nesta sessão
    }
  }
  return junto.buffer;
}

/** Voz falsa dos testes automáticos (e2e/vozes.spec.ts): baixa os arquivos da lista e "fala" um zumbido baixo. */
async function abrirTeste(voz) {
  for (var i = 0; i < voz.arquivos.length; i++) await buscar(voz.arquivos[i]);
  motor = {
    falar: async function (texto, velocidade) {
      var taxa = 16000;
      var pcm = new Float32Array(Math.round((taxa * Math.min(4, 0.03 * texto.length + 0.2)) / (velocidade || 1)));
      for (var j = 0; j < pcm.length; j++) pcm[j] = 0.02 * Math.sin((j * 2 * Math.PI * 220) / taxa);
      return { pcm: pcm, taxa: taxa };
    },
  };
  vozAtual = voz.id;
  return "teste";
}

async function abrir(voz) {
  if (voz.motor === "teste") return abrirTeste(voz);
  var webgpu = voz.webgpu && self.navigator && navigator.gpu ? await navigator.gpu.requestAdapter().catch(function () { return null; }) : null;
  var biblioteca = webgpu ? voz.ort.webgpu : voz.ort.wasm;
  if (!self.ort) importScripts(biblioteca.js);
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  ort.env.wasm.wasmPaths = biblioteca.pasta;
  ort.env.wasm.wasmBinary = await buscar(biblioteca.wasm);
  if (!self.createPiperPhonemize) importScripts(voz.fonemas.js);
  motor = MotorDeVoz.criarMotor({
    ort: ort,
    buscar: buscar,
    criarFonemas: createPiperPhonemize,
    fonemas: voz.fonemas,
    provedores: webgpu ? ["webgpu", "wasm"] : ["wasm"],
  });
  await motor.carregar(voz);
  vozAtual = voz.id;
  return webgpu ? "webgpu" : "wasm";
}

self.onmessage = async function (evento) {
  var m = evento.data || {};
  if (m.t === "carregar") {
    if (vozAtual === m.voz.id && carregando) {
      await carregando;
      self.postMessage({ t: "pronto" });
      return;
    }
    progresso = { feito: 0, total: m.voz.bytes || 0 };
    carregando = abrir(m.voz);
    try {
      var provedor = await carregando;
      self.postMessage({ t: "pronto", provedor: provedor });
    } catch (erro) {
      carregando = null;
      self.postMessage({ t: "erro", mensagem: String((erro && erro.message) || erro) });
    }
    return;
  }
  if (m.t === "falar") {
    try {
      await carregando;
      var som = await motor.falar(m.texto, m.velocidade);
      self.postMessage({ t: "audio", id: m.id, pcm: som.pcm, taxa: som.taxa }, [som.pcm.buffer]);
    } catch (erro) {
      self.postMessage({ t: "erro", id: m.id, mensagem: String((erro && erro.message) || erro) });
    }
  }
};
