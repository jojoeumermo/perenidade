# Avisos de terceiros (NOTICE)

Bibliotecas e serviços usados pelo site do Instituto Lúcia, com licença. A página pública está em /creditos.

- Next.js, React — MIT
- Supabase (PostgreSQL, PostgREST, GoTrue) — Apache-2.0 / PostgreSQL License
- Pyodide — MPL-2.0
- php-wasm — Apache-2.0
- PGlite (@electric-sql/pglite) — Apache-2.0
- KaTeX — MIT · math.js — Apache-2.0 · MiniSearch — MIT · Tailwind CSS — MIT
- Jitsi Meet External API — Apache-2.0 (servidor público meet.jit.si por padrão; configurável)
- LanguageTool — LGPL-2.1 (consultado como serviço; servidor próprio recomendado)
- PhET Interactive Simulations, University of Colorado Boulder — simulações sob CC BY 4.0, embutidas pelo iframe oficial, sem modificação; nome e logotipo pertencem à universidade (conferido em 18/10/2026)
- Fontes EB Garamond, Inter, IBM Plex Mono — SIL OFL 1.1
- Vozes naturais do "Ouvir a aula" (rodam no aparelho; nada sai dele; veja docs/VOZES.md): onnxruntime-web 1.22.0 — MIT · piper_phonemize em WebAssembly (@diffusionstudio/piper-wasm 1.0.0) — MIT, com espeak-ng — GPL-3.0-or-later (compatível com a AGPL do site) · Kokoro-82M v1.0 e as vozes pf_dora, pm_alex, af_heart, am_michael, ef_dora, em_alex e ff_siwis (esta treinada com a base SIWIS, CC BY 4.0) — Apache-2.0 (conferido em 02/11/2026). As vozes pt_BR do Piper ficaram de fora: licença incerta (ajustadas a partir de vozes de uso não comercial).
- Narração dos vídeos curtos do curso ENEM (public/videos-curtos/): áudio gerado antes, na máquina de quem produz, com o Kokoro-82M v1.0 (Apache-2.0), vozes pf_dora ("Voz 1") e pm_alex ("Voz 2"). Voz sintética, que não imita nenhuma pessoa; o áudio sai sob CC BY-SA 4.0, como o resto do conteúdo. Veja docs/enem/voz/COMPARATIVO.md.
- Laboratórios externos (docs/LABS-EXTERNOS.md, conferido em 04/11/2026): LOOPY v1.1 (Nicky Case, CC0 1.0; cópia em public/labs/loopy/ com a interface traduzida para o português) · Parable of the Polygons (Vi Hart e Nicky Case, CC0 1.0; cópia em public/labs/polygons/) · The Evolution of Trust, tradução em português do Bruno Lemos, CC0 1.0 (aberta do site do tradutor, sem cópia) · modelos do NetLogo Web (Uri Wilensky, CC BY-NC-SA 3.0; abertos do netlogoweb.org, sem cópia) · GeoGebra (licença não comercial; aberto do site deles, sem cópia) · gráfico de expectativa de vida com dados do Our World in Data (CC BY 4.0) e da ONU, World Population Prospects 2024 (CC BY 3.0 IGO).
- Sala de aula ao vivo (infra/aula-ao-vivo/, conferido em 04/11/2026): Galène (Juliusz Chroboczek) — MIT; compilado da fonte oficial (tag galene-1.2.1) e rodado no servidor do instituto; nenhum código dele vai no site. Caddy — Apache-2.0 (HTTPS da sala). Plano B: PeerTube (AGPL-3.0, servidor do instituto, tocador embutido só após clique) e YouTube (nocookie, só após clique).
- Progresso por QR (lib/progresso-qr.ts, components/progresso/, conferido em 05/11/2026): jsQR 1.4.0 (cozmo/jsQR, Apache-2.0; arquivo LICENSE conferido no pacote npm) lê o QR pela câmera quando o navegador não tem o BarcodeDetector nativo; baixado só quando preciso, por dynamic import, e roda no aparelho (a imagem da câmera não sai dele). qrcode 1.5.4 (MIT) desenha o QR no aparelho. A cifra é a do próprio navegador (WebCrypto, AES-GCM), sem biblioteca. O chat privado da Alumia (`components/rede/chat/Qr.tsx`, conferido em 10/11/2026) usa as mesmas duas bibliotecas, do mesmo jeito (baixadas só quando a pessoa abre o código de segurança, rodando no aparelho; a imagem da câmera não sai dele), para mostrar e ler o QR do código de segurança.
