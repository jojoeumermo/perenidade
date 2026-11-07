# Vale o Escrito: cadastros gratuitos que só o Jonathan pode fazer

Pacote "fontes-e-dossies". Conferido em 04/11/2026 (curl e WebFetch). Cadastro, senha e chave são do Jonathan: ninguém da equipe de código cria conta em nome do Instituto nem guarda senha em arquivo. Cada chave vai para um **segredo do GitHub Actions** (Settings, Secrets and variables, Actions), nunca para o repositório, e o robô a lê de variável de ambiente. Sem a chave, o robô pula a fonte e segue (regra do fluxo: sem cota ou sem chave, segue sem aquela fonte).

O detalhe de cada fonte (RSS, API, licença, observação) está em `content/vale-o-escrito/fontes.json`; aqui só o que pede ação.

## 1. Cadastros que a fonte pede (confirmado)

| Fonte | O que fazer | Segredo sugerido | Observação |
|---|---|---|---|
| **Portal da Transparência (CGU)** | Pedir a chave da API pelo cadastro de e-mail do próprio portal (a documentação em `api.portaldatransparencia.gov.br/swagger-ui` explica; a API devolveu 401 sem chave). É gratuita; tem limite de requisições por minuto. | `PORTAL_TRANSPARENCIA_CHAVE` | Licença: Decreto 8.777/2016 (campo `license` do OpenAPI). |
| **ACLED** | Criar conta em `acleddata.com/user/register` e aceitar os termos (contrato de licença, termos de uso de conteúdo, política de atribuição, em `acleddata.com/terms-and-conditions`). A API devolveu 403 sem credencial. | `ACLED_EMAIL`, `ACLED_CHAVE` | **A assessoria jurídica lê os termos antes de o robô usar**: a licença tem regra própria de uso e de republicação. Só dado agregado de evento, nunca nome de pessoa. |

## 2. Provavelmente pedem cadastro (não deu para confirmar daqui)

| Fonte | Por que está aqui | O que fazer |
|---|---|---|
| **Diário Oficial da União (INLABS)** | `inlabs.in.gov.br` respondeu 200, mas a tela de entrada não foi aberta; pelo que a Imprensa Nacional anuncia, o download dos XML do dia pede cadastro gratuito. | Abrir `inlabs.in.gov.br` num navegador brasileiro e ver se há "Cadastre-se". Se houver, cadastrar e guardar `INLABS_EMAIL` e `INLABS_SENHA` como segredos. |
| **Fogo Cruzado (API)** | A documentação abre em `api.fogocruzado.org.br/docs`, mas é página de JavaScript e não deu para ler se pede conta. | Abrir a documentação e ver como se obtém o token; se for conta gratuita, cadastrar e guardar `FOGO_CRUZADO_EMAIL` e `FOGO_CRUZADO_SENHA`. |
| **MapBiomas Alerta (API)** | `alerta.mapbiomas.org/api/` abre; não deu para ver se a API de alertas exige cadastro. Os números dos relatórios (PDF) não precisam. | Abrir a documentação da API; se pedir conta, cadastrar. |

## 3. Não pedem cadastro, mas exigem atenção

- **DataJud (CNJ)**: a API usa uma **chave pública** publicada na própria wiki (`datajud-wiki.cnj.jus.br/api-publica/acesso/`), sem cadastro pessoal, e o CNJ avisa que pode trocá-la a qualquer momento. Guardar como segredo `DATAJUD_CHAVE_PUBLICA` e trocar quando a API devolver 401.
- **Querido Diário**: a API (`api.queridodiario.org.br`) **não respondeu** do computador usado nos testes (que está fora do Brasil). Provavelmente é aberta, mas é preciso conferir de um IP brasileiro, ou da própria máquina do GitHub Actions num teste.
- **CNPJ (Receita)**: `dadosabertos.rfb.gov.br` não respondeu e a página do gov.br pediu autenticação para ser vista. Conferir de um IP brasileiro onde ficam hoje os arquivos mensais.
- **TCU**: o portal responde, mas os endereços de API que tentamos não; conferir o endereço atual dos serviços.
- **Observatório do Clima**: o site e o feed devolveram 403 para o robô (proteção contra automação). Se quiser o feed, pedir liberação à organização ou ler à mão.

## 4. Pegadinhas de endereço (valem como aviso para o robô)

- **Alma Preta**: o domínio `almapreta.com` (sem `.br`) hoje redireciona para um site que nada tem a ver com o jornal. O endereço certo é `almapreta.com.br`. O robô só aceita link do domínio exato.
- **Agência Lupa**: `lupa.news` redireciona para `agencialupa.org`.
- **Anistia Internacional**: o site brasileiro não tem feed; o feed da seção Brasil é o do site internacional, em inglês.
- **Grupo Gay da Bahia**: só `http://www.ggb.org.br` respondeu.

## 5. Termos que a assessoria jurídica precisa ler

Itens de licença que apareceram nas páginas e mudam o que o Instituto pode fazer com o texto:

- Portais do **gov.br** (PF, FUNAI, IBAMA e outros) trazem **CC BY-ND 3.0** no rodapé: atribuição, sem obra derivada. O Vale o Escrito só guarda trecho curto com link e crédito; confirmar se o resumo escrito pela IA ou pela curadoria conta como "derivação".
- **Agência Pública**: CC BY-ND 4.0 na página inicial (mesma pergunta).
- **MapBiomas**: "CC BY 4.0" na página inicial (a que produto se aplica não foi conferido).
- A maioria das organizações e dos jornais não declarou licença aberta na página inicial: citação curta com crédito e link (Lei 9.610/1998, art. 46; **não conferido** no planalto.gov.br nesta fase).

## 6. O que não precisa de nada

Câmara, Senado, TSE (CKAN), IBGE (localidades e malhas) e os feeds RSS de CIMI, CPT, ISA, FBSP, Fogo Cruzado, Rede de Observatórios, Sou da Paz, Justiça Global, ANTRA, HRW, Anistia (internacional), Agência Pública, Repórter Brasil, InfoAmazonia, Amazônia Real, Ponte, Alma Preta, De Olho nos Ruralistas, Intercept, Brasil de Fato, Lupa, Aos Fatos, MapBiomas, IBAMA, STF e STJ respondem sem chave.

## 7. Casos a preencher: campo e trabalho escravo (frente T12, 07/11/2026)

Achados reais que ficaram FORA de `content/vale-o-escrito/novos-casos/campo-e-trabalho-escravo.json` porque falta dado ou fonte oficial lida. Nada inventado: entram quando alguém achar o que falta.

| Caso | O que falta |
|---|---|
| Syngenta e a morte de um agricultor sem-terra em Santa Tereza do Oeste (PR, 2007) | Só a Terra de Direitos (parte no processo) relata a decisão do STJ (2024); falta o acórdão ou nota do STJ/TJPR. |
| Operação Fortis Status na Fazenda Mutamba, Marabá (PA, 11/10/2024), dois sem-terra mortos | A Nota Técnica 6/2025 da PFDC/MPF trata do caso, mas o PDF não foi lido; sem fonte oficial lida, não entrou. |
| Assassinato do casal de extrativistas em Nova Ipixuna (PA, 2011) | Condenações do júri (2013 e 2016) só em reportagem; falta nota do TJPA/MPPA. Não nomear quem morreu. |
| Massacre de Corumbiara (RO, 1995) | Fontes divergem sobre quem foi condenado; falta acórdão do TJRO. |
| Restaurantes de Teresópolis (RJ): MPF obtém condenação (05/05/2025) | A nota do MPF não traz o ano dos fatos (só a denúncia, de 2014). |
| Cargill (RO) e RRX Comércio de Carnes (Porto Murtinho, MS): ações do MPT (abril de 2026) | A nota do MPT não dá data, lugar exato nem número de trabalhadores dos flagrantes. |
| Rumo Malha Paulista: acordo de R$ 20 milhões no TST (11/11/2022) | A nota do MPT não dá o ano do resgate. |
| Zara e a oficina da AHA (SP, 2011) | O acórdão do TRT-2 (2017) só aparece citado em trabalho acadêmico; falta a fonte do tribunal. |
| Lista suja do MTE: atualizações de 06/04/2026 (169 empregadores) e 06/10/2026 (82) | São dados agregados oficiais, sem situação jurídica que caiba no modelo; a BYD entrou como caso próprio. Decidir se vira painel de números. |
| Pastor e professora condenados em Mossoró (RN), TRF5 (15/07/2025) | Fonte oficial existe, mas a pessoa explorada começou adolescente: a curadoria decide se há como contar sem expor (ECA, art. 17). |
## 7. Casos "a preencher": violência policial e chacinas (frente T12, 07/11/2026)

Lote pronto para a curadoria: `content/vale-o-escrito/novos-casos/violencia-policial-chacinas.json` (21 casos, todos `pendente-curadoria`, cada um com fonte oficial e situação jurídica; conferência: `npm run testar:vale-o-escrito-novos-casos`; junção aos dossiês: `npm run vale-o-escrito:importar-novos-casos -- --gravar`, que pula duplicata por id ou link). Ficaram de fora, por falta de dado verificável, e entram quando alguém achar a peça que falta:

| Caso | O que falta |
|---|---|
| Vigário Geral (RJ, 1993) | Fonte primária da condenação/absolvição (só achamos reportagem citando o TJRJ e páginas do Observatório da Câmara que não abriram). |
| Vila Cruzeiro (RJ, maio/2022) | As notas do MPF sobre o procedimento investigatório mudaram de endereço (404); só há reportagem. Falta o desfecho do PIC 1.30.001.001985/2022 e dos inquéritos da Polícia Civil. |
| Guadalupe (RJ, 2019, Exército) | A notícia do STM sobre a apelação final saiu do ar (404) e o acórdão na revista do STM é PDF comprimido; a nota do MPM (mar/2024) é anterior ao resultado. Precisa de fonte do tipo "processo" para a condenação. |
| Complexo do Alemão (RJ, set/2019, morte de uma menina de 8 anos) | Só reportagem sobre a absolvição no júri (nov/2024) e o recurso do MPRJ; falta nota oficial do MPRJ ou do TJRJ. |
| Complexo do Lins (RJ, jun/2021, morte de uma jovem grávida) | A página do MPRJ (Memorial Vidas Marcadas) não tem data de publicação; falta fonte datada da denúncia ou do júri. |
| Campo Limpo (SP, 2013) e lava-rápido na zona norte (SP, maio/2006) | Só nota do MPSP sobre as condenações no júri; a regra exige a decisão (fonte "processo") para "condenado". |
| Baixada Fluminense (RJ, 2005) e Fallet-Fogueteiro (RJ, 2019) | Nenhuma fonte oficial com a situação atual. |
| Varginha (MG, 2021, PRF e PM) | Ofício do MPMG sem data nem desfecho. |
| Operação Contenção (RJ, 2025), já publicada | Atualizar a ficha: segundo o MPRJ (09/10/2026), a Auditoria da Justiça Militar recebeu três denúncias contra oito PMs por crimes como invasão de domicílio, furto e retirada das câmeras (https://www.mprj.mp.br/web/guest/visualizar?noticiaId=243602). |
