// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O motor das vozes naturais (Piper e Kokoro), igual no navegador (public/workers/voz.js) e no Node (scripts que geram
// as amostras e o teste local). Não sabe de onde vêm os arquivos: quem cria o motor entrega o "ort" (onnxruntime-web),
// a fábrica do espeak-ng (piper_phonemize) e uma função que busca um arquivo do próprio site.
//
// Texto → fonemas (espeak-ng, pt-br) → números → modelo ONNX → som (Float32, mono).
//   Piper: os números saem prontos do piper_phonemize; o modelo recebe input, input_lengths e scales (22 050 Hz).
//   Kokoro: os fonemas viram números pelo vocabulário do tokenizer.json; o estilo da voz é a linha do .bin escolhida
//   pelo tamanho da frase; o modelo recebe input_ids, style e speed (24 000 Hz).
(function (raiz) {
  "use strict";

  /** Junções do espeak que o Kokoro lê como um só símbolo (as africadas de "tia" e "dia"). */
  var JUNCOES = [["tʃ", "ʧ"], ["dʒ", "ʤ"], ["ts", "ʦ"], ["dz", "ʣ"]];

  function criarMotor(opcoes) {
    var ort = opcoes.ort;
    var buscar = opcoes.buscar;
    var criarFonemas = opcoes.criarFonemas;
    var fonemas = null;
    var saida = [];
    var voz = null;
    var sessao = null;
    var extra = null;

    function prepararFonemas(aoProgresso) {
      if (fonemas) return fonemas;
      fonemas = Promise.all([buscar(opcoes.fonemas.wasm, aoProgresso), buscar(opcoes.fonemas.dados, aoProgresso)]).then(function (partes) {
        return criarFonemas({
          wasmBinary: partes[0],
          getPreloadedPackage: function () { return partes[1]; },
          locateFile: function (nome) { return nome; },
          print: function (linha) { saida.push(linha); },
          printErr: function () {},
        });
      });
      fonemas.catch(function () { fonemas = null; });
      return fonemas;
    }

    async function fonemizar(texto) {
      var modulo = await prepararFonemas();
      saida = [];
      modulo.callMain(["-l", (voz && voz.espeak) || "pt-br", "--input", JSON.stringify([{ text: texto }]), "--espeak_data", "/espeak-ng-data"]);
      var ids = [];
      var simbolos = [];
      saida.forEach(function (linha) {
        try {
          var j = JSON.parse(linha);
          ids = ids.concat(j.phoneme_ids || []);
          if (simbolos.length) simbolos.push(" ");
          simbolos = simbolos.concat(j.phonemes || []);
        } catch {
          // linha que não é do resultado
        }
      });
      return { ids: ids, simbolos: simbolos };
    }

    /** Baixa (ou lê do armazenamento) tudo o que a voz precisa e abre o modelo. */
    async function carregar(novaVoz, aoProgresso) {
      if (voz && voz.id === novaVoz.id && sessao) return;
      voz = novaVoz;
      sessao = null;
      extra = null;
      var arquivos = novaVoz.arquivos;
      var modelo = arquivos.find(function (a) { return a.papel === "modelo"; });
      await prepararFonemas(aoProgresso);
      var dados = await buscar(modelo, aoProgresso);
      if (novaVoz.motor === "kokoro") {
        var vocab = JSON.parse(new TextDecoder().decode(await buscar(arquivos.find(function (a) { return a.papel === "vocabulario"; }), aoProgresso)));
        var estilo = new Float32Array(await buscar(arquivos.find(function (a) { return a.papel === "estilo"; }), aoProgresso));
        extra = { vocab: (vocab.model && vocab.model.vocab) || vocab, estilo: estilo };
      } else if (novaVoz.motor === "piper") {
        var config = JSON.parse(new TextDecoder().decode(await buscar(arquivos.find(function (a) { return a.papel === "configuracao"; }), aoProgresso)));
        extra = { config: config };
      }
      var provedores = opcoes.provedores || ["wasm"];
      try {
        sessao = await ort.InferenceSession.create(new Uint8Array(dados), { executionProviders: provedores, graphOptimizationLevel: "all" });
      } catch (erro) {
        if (provedores.length === 1 && provedores[0] === "wasm") throw erro;
        sessao = await ort.InferenceSession.create(new Uint8Array(dados), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      }
    }

    function bigints(lista) {
      var b = new BigInt64Array(lista.length);
      for (var i = 0; i < lista.length; i++) b[i] = BigInt(lista[i]);
      return b;
    }

    function fonemasDoKokoro(simbolos) {
      var texto = simbolos.join("");
      // O espeak junta as frases sem espaço depois do ponto ("bem.tudo"): o Kokoro precisa da pausa.
      texto = texto.replace(/([.!?;:,])(?=\S)/g, "$1 ");
      JUNCOES.forEach(function (par) { texto = texto.split(par[0]).join(par[1]); });
      return texto;
    }

    /** Fala um trecho curto (uma frase): devolve o som e a taxa de amostragem. */
    async function falar(texto, velocidade) {
      if (!sessao) throw new Error("voz não carregada");
      var v = Math.min(2, Math.max(0.5, Number(velocidade) || 1));
      var f = await fonemizar(texto);
      var resultado;
      if (voz.motor === "piper") {
        if (f.ids.length < 3) return { pcm: new Float32Array(0), taxa: extra.config.audio.sample_rate };
        var inf = extra.config.inference || {};
        var entrada = {
          input: new ort.Tensor("int64", bigints(f.ids), [1, f.ids.length]),
          input_lengths: new ort.Tensor("int64", bigints([f.ids.length]), [1]),
          scales: new ort.Tensor("float32", new Float32Array([inf.noise_scale != null ? inf.noise_scale : 0.667, (inf.length_scale || 1) / v, inf.noise_w != null ? inf.noise_w : 0.8]), [3]),
        };
        if (extra.config.num_speakers > 1) entrada.sid = new ort.Tensor("int64", bigints([0]), [1]);
        resultado = await sessao.run(entrada);
        return { pcm: new Float32Array(resultado[sessao.outputNames[0]].data), taxa: extra.config.audio.sample_rate };
      }
      var ipa = fonemasDoKokoro(f.simbolos);
      var ids = [];
      for (var c of ipa) if (extra.vocab[c] != null) ids.push(extra.vocab[c]);
      ids = ids.slice(0, 510);
      if (ids.length === 0) return { pcm: new Float32Array(0), taxa: 24000 };
      var n = Math.min(ids.length, 509);
      var estilo = extra.estilo.slice(n * 256, n * 256 + 256);
      resultado = await sessao.run({
        input_ids: new ort.Tensor("int64", bigints([0].concat(ids, [0])), [1, ids.length + 2]),
        style: new ort.Tensor("float32", estilo, [1, 256]),
        speed: new ort.Tensor("float32", new Float32Array([v]), [1]),
      });
      return { pcm: new Float32Array(resultado[sessao.outputNames[0]].data), taxa: 24000, fonemas: ipa };
    }

    return { carregar: carregar, falar: falar, fonemizar: fonemizar, prepararFonemas: prepararFonemas, fonemasDoKokoro: fonemasDoKokoro };
  }

  /** Confere o sha256 de um arquivo baixado (o mesmo valor fixado em scripts/vozes-baixar.mjs). */
  async function conferirSha256(dados, esperado, subtle) {
    var resumo = new Uint8Array(await subtle.digest("SHA-256", dados));
    var hex = "";
    for (var i = 0; i < resumo.length; i++) hex += resumo[i].toString(16).padStart(2, "0");
    return hex === esperado;
  }

  var api = { criarMotor: criarMotor, conferirSha256: conferirSha256 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.MotorDeVoz = api;
})(typeof self !== "undefined" ? self : this);
