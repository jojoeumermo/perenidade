// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Neste dia" com o olhar do instituto: das dezenas de fatos que a Wikipédia lista para cada data, ficam os de luta
// e conquista do povo (greves, revoluções, independências, direitos, resistência), com preferência para o Brasil, a
// América Latina e a África de língua portuguesa. Saem papas, coroações, polícias, bolsas de valores e quedas de avião.
// Nascimentos e mortes entram só de quem lutou (a lista de nomes abaixo). Sem os atalhos "@/": roda direto nos testes.

export interface FatoDoDia {
  ano: number;
  texto: string;
  link: string;
}

/** Sem acento e em minúsculas, para as palavras casarem em qualquer grafia. */
export const simples = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

type Pesos = [RegExp, number][];

// Cada idioma tem as suas raízes. Peso positivo puxa o fato para cima; negativo derruba.
const POSITIVOS: Record<string, Pesos> = {
  pt: [
    [/\bgreve|grevist/, 4], [/sindicat|central unica|\bcut\b/, 3], [/operari|trabalhador|proletari|campones|sem-terra|\bmst\b/, 3],
    [/revoluc(?!ao hungara)|revolucionari|insurreic|levante|revolta|rebeliao|sublevac|motim/, 3], [/comuna de paris|soviete|bolchevi/, 4],
    [/aboli(c|r)|escraviza|quilomb|zumbi|dandara|abolicionis/, 4], [/independencia|descoloniz|libertac|soberania|anticolon/, 3],
    [/sufragi|voto feminino|direito (ao|de) voto|direitos (civis|humanos|da mulher|das mulheres|trabalhistas|sociais)/, 4],
    [/feminis|mulheres|lgbt|homossexua|orgulho|stonewall|transexua/, 2], [/indigena|povos originarios|aborigene|quilombola/, 3],
    [/racis|apartheid|segregac|movimento negro|consciencia negra|direitos civis/, 3], [/reforma agraria|reforma de base|nacionaliz|estatiz/, 3],
    [/socialis|comunist|marxis|esquerda|partido dos trabalhadores|frente popular|unidade popular/, 2], [/antifascis|derrota do nazis|rendicao da alemanha|fim da ditadura|redemocratiz|diretas ja|anistia|constituinte|constituicao/, 3],
    [/protest|manifestac|passeata|marcha|ocupac|boicote|desobediencia/, 2], [/estudant|\bune\b|universidade publica|escola publica|educacao publica|alfabetiz/, 2],
    [/salario minimo|jornada|oito horas|clt|ferias remuneradas|previdencia|aposentadoria|\bsus\b|saude publica|vacina/, 3],
    [/nobel da paz|declaracao universal|direitos da crianca/, 2], [/mandela|guevara|fidel castro|allende|lula|marielle|chico mendes|paulo freire|marighella|prestes|tiradentes|joao candido|martin luther king|malcolm x|rosa parks|sankara|lumumba|bolivar|jose marti|sandino|zapata/, 4],
  ],
  es: [
    [/\bhuelga|huelguista/, 4], [/sindica/, 3], [/obrer|trabajador|proletari|campesin/, 3], [/revoluci|insurrecci|levantamiento|revuelta|rebelion|sublevaci|motin/, 3],
    [/comuna de paris|soviet|bolchevi/, 4], [/aboli|esclav|cimarr|quilomb/, 4], [/independencia|descoloniz|liberaci|soberania|anticolon/, 3],
    [/sufragio|voto femenino|derecho al voto|derechos (civiles|humanos|de la mujer|laborales|sociales)/, 4], [/feminis|mujeres|lgbt|homosexual|orgullo|stonewall/, 2],
    [/indigena|pueblos originarios|aborigen/, 3], [/racis|apartheid|segregaci|derechos civiles/, 3], [/reforma agraria|nacionaliz|expropia/, 3],
    [/socialis|comunist|marxis|izquierda|frente popular|unidad popular|sandinista|zapatista/, 2], [/antifascis|fin de la dictadura|derrota del nazis|amnistia|constituci/, 3],
    [/protest|manifestaci|marcha|ocupaci|boicot/, 2], [/estudiant|universidad publica|escuela publica|educacion publica|alfabetiz/, 2],
    [/salario minimo|jornada|ocho horas|jubilaci|seguridad social|salud publica|vacuna/, 3], [/nobel de la paz|declaracion universal/, 2],
    [/mandela|guevara|fidel castro|allende|lula|chico mendes|paulo freire|martin luther king|malcolm x|rosa parks|sankara|lumumba|bolivar|jose marti|sandino|zapata|victor jara|tupac amaru/, 4],
  ],
  en: [
    [/\bstrike|strikers/, 4], [/union|labor movement|labour movement/, 3], [/worker|working class|proletari|peasant|farmworker/, 3], [/revolution|insurrection|uprising|revolt|rebellion|mutiny/, 3],
    [/paris commune|soviet|bolshevi/, 4], [/abolition|abolish(ed|es) slavery|slaves? (are )?freed|maroon|quilombo/, 4], [/independence|decoloni|liberation|sovereignty|anti-colonial/, 3],
    [/suffrage|right to vote|women.{0,10}vote|civil rights|human rights|women's rights|labor rights/, 4], [/feminis|women|lgbt|gay|pride|stonewall|transgender/, 2],
    [/indigenous|native american|aboriginal|first nations/, 3], [/racism|apartheid|segregation|desegregat/, 3], [/land reform|agrarian reform|nationaliz/, 3],
    [/socialis|communist|marxis|left-wing|popular front|sandinista|zapatista/, 2], [/antifascis|end of the dictatorship|amnesty|constitution|nazi germany surrenders/, 3],
    [/protest|demonstrat|march on|boycott|sit-in|civil disobedience/, 2], [/student|public school|public education|literacy/, 2],
    [/minimum wage|eight-hour|8-hour|pension|social security|public health|vaccin/, 3], [/nobel peace|universal declaration/, 2],
    [/mandela|guevara|fidel castro|allende|lula|chico mendes|paulo freire|martin luther king|malcolm x|rosa parks|sankara|lumumba|bolivar|jose marti|sandino|zapata/, 4],
  ],
  fr: [
    [/\bgreve|grevist/, 4], [/syndica/, 3], [/ouvri|travailleu|proletari|paysan/, 3], [/revolution|insurrection|soulevement|revolte|rebellion|mutinerie/, 3],
    [/commune de paris|soviet|bolchevi/, 4], [/abolition|esclav|marron/, 4], [/independance|decolonis|liberation|souverainete|anticolon/, 3],
    [/suffrage|droit de vote|vote des femmes|droits (civiques|de l.homme|des femmes|sociaux)/, 4], [/feminis|femmes|lgbt|homosexu|fierte|stonewall/, 2],
    [/indigene|autochtone|aborigene/, 3], [/racism|apartheid|segregation/, 3], [/reforme agraire|nationalis/, 3],
    [/socialis|communist|marxis|gauche|front populaire|sandiniste|zapatiste/, 2], [/antifascis|fin de la dictature|amnistie|constitution|capitulation allemande/, 3],
    [/manifest|marche|boycott|occupation/, 2], [/etudiant|ecole publique|education publique|alphabetis/, 2],
    [/salaire minimum|journee de huit|retraite|securite sociale|sante publique|vaccin|conges payes/, 3], [/nobel de la paix|declaration universelle/, 2],
    [/mandela|guevara|fidel castro|allende|lula|chico mendes|paulo freire|martin luther king|malcolm x|rosa parks|sankara|lumumba|bolivar|jose marti|sandino|zapata/, 4],
  ],
  ru: [
    [/забастов|стачк/, 4], [/профсоюз/, 3], [/рабоч|пролетари|крестьян/, 3], [/революци|восстани|бунт|мятеж/, 3], [/парижская коммуна|совет рабоч/, 4],
    [/отмен.{0,12}рабств|рабств|аболицион/, 4], [/независимост|деколониз|освобожден|суверенитет/, 3], [/избирательн.{0,10}прав|права (женщин|человека)|гражданских прав/, 4],
    [/феминис|женщин|лгбт/, 2], [/коренн.{0,8}народ|индейц/, 3], [/апартеид|расизм|сегрегац/, 3], [/аграрн.{0,6}реформ|национализац/, 3],
    [/социалис|коммунис|марксис|народный фронт/, 2], [/антифаши|амнисти|конституци|капитуляци.{0,12}германи/, 3], [/протест|демонстрац|марш|бойкот/, 2],
    [/студент|грамотност|всеобщ.{0,10}образован/, 2], [/минимальн.{0,8}зарплат|восьмичасов|пенси|здравоохранен|вакцин/, 3], [/нобелевск.{0,10}мира|всеобщая декларация/, 2],
    [/мандел|гевар|кастро|альенде|лула|мартин лютер кинг|сенкар|лумумб|боливар|марти|сандино|сапат/, 4],
  ],
  zh: [
    [/罢工/, 4], [/工会/, 3], [/工人|无产|农民/, 3], [/革命|起义|暴动|叛乱/, 3], [/巴黎公社|苏维埃|布尔什维克/, 4], [/废除奴隶|奴隶制|废奴/, 4],
    [/独立|解放|主权|去殖民/, 3], [/选举权|投票权|民权|人权|妇女权利/, 4], [/女性主义|妇女|性少数|同性恋/, 2], [/原住民|土著/, 3], [/种族隔离|种族主义/, 3],
    [/土地改革|国有化/, 3], [/社会主义|共产|马克思/, 2], [/反法西斯|大赦|宪法|德国投降/, 3], [/抗议|示威|游行|抵制/, 2], [/学生|扫盲|公立学校/, 2],
    [/最低工资|八小时|养老金|公共卫生|疫苗/, 3], [/诺贝尔和平奖|世界人权宣言/, 2], [/曼德拉|格瓦拉|卡斯特罗|阿连德|卢拉|马丁·路德·金|桑卡拉|卢蒙巴|玻利瓦尔/, 4],
  ],
};

const NEGATIVOS: Record<string, Pesos> = {
  pt: [
    [/anticomunis|contra o governo comunista|contra o regime comunista|contrarrevoluc/, -8], [/\bpapa\b|pontificado|canoniz|beatific|\bsanto\b|santa se|vaticano|bispo|cardeal/, -8],
    [/\brei\b|rainha|coroac|imperador|imperatriz|principe|princesa|monarquia|xogun|dinastia|\bczar\b(?!.{0,30}derrub)/, -6],
    [/policia|pide|gestapo|\bkgb\b|servico secreto/, -5], [/bolsa de valores|acoes|mercado financeiro|banco central|empresa|lancamento|ipod|iphone|microsoft|apple/, -6],
    [/nazis|hitler|mussolini|fascis|pinochet|franquis|ditador assume|toma posse como ditador/, -3], [/golpe de estado|golpe militar/, -2],
    [/sismo|terremoto|furacao|tufao|tsunami|erupcao|inundac|naufragi|acidente|queda do aviao|desastre/, -5],
    [/voo inaugural|espacial|apollo|nasa|satelite|astronauta|foguete/, -5], [/batalha|guerra|bombarde|ofensiva|invasao/, -2], [/atentado|terroris|refens/, -4],
    [/futebol|copa do mundo|olimpi|campeonato|formula 1/, -2],
  ],
  es: [
    [/anticomunis|contra el gobierno comunista|contrarrevoluc/, -8], [/\bpapa\b|pontificado|canoniz|beatific|\bsanto\b|santa sede|vaticano|obispo|cardenal/, -8],
    [/\brey\b|reina|coronaci|emperador|emperatriz|principe|princesa|monarquia|dinastia|\bzar\b/, -6], [/policia|gestapo|\bkgb\b|servicio secreto/, -5],
    [/bolsa de valores|acciones|mercado financiero|empresa|lanzamiento|ipod|iphone|microsoft|apple/, -6], [/nazis|hitler|mussolini|fascis|pinochet|franquis/, -3], [/golpe de estado/, -2],
    [/sismo|terremoto|huracan|tifon|tsunami|erupcion|inundaci|naufragi|accidente|desastre/, -5], [/vuelo inaugural|espacial|apolo|nasa|satelite|astronauta|cohete/, -5],
    [/batalla|guerra|bombarde|ofensiva|invasion/, -2], [/atentado|terroris|rehenes/, -4], [/futbol|copa del mundo|olimpi|campeonato|formula 1/, -2],
  ],
  en: [
    [/anti-communis|anticommunis|against the communist|counter-revolution/, -8], [/\bpope\b|papacy|pontificate|canoniz|beatif|\bsaint\b|holy see|vatican|bishop|cardinal/, -8],
    [/(?<!luther )\bking\b|queen|coronation|emperor|empress|prince|princess|monarchy|dynasty|shogun|\btsar\b|\bczar\b/, -6], [/police|gestapo|\bkgb\b|secret service/, -5],
    [/stock exchange|stock market|shares|company|launch|ipod|iphone|microsoft|apple inc/, -6], [/nazi|hitler|mussolini|fascis|pinochet|francoist/, -3], [/coup d.etat|military coup/, -2],
    [/earthquake|hurricane|typhoon|tsunami|eruption|flood|shipwreck|crash|disaster/, -5], [/maiden flight|space|apollo|nasa|satellite|astronaut|rocket/, -5],
    [/battle|war\b|bombing|offensive|invasion/, -2], [/attack|terroris|hostage/, -4], [/football|world cup|olympic|championship|formula one/, -2],
  ],
  fr: [
    [/anticommunis|contre le gouvernement communiste|contre-revolution/, -8], [/\bpape\b|pontificat|canonis|beatific|\bsaint\b|saint-siege|vatican|eveque|cardinal/, -8],
    [/\broi\b|reine|couronnement|empereur|imperatrice|prince|princesse|monarchie|dynastie|shogun|\btsar\b/, -6], [/police|gestapo|\bkgb\b|services secrets/, -5],
    [/bourse|actions|entreprise|lancement|ipod|iphone|microsoft|apple/, -6], [/nazi|hitler|mussolini|fascis|pinochet|franquis/, -3], [/coup d.etat/, -2],
    [/seisme|tremblement de terre|ouragan|typhon|tsunami|eruption|inondation|naufrage|accident|catastrophe/, -5], [/premier vol|spatial|apollo|nasa|satellite|astronaute|fusee/, -5],
    [/bataille|guerre|bombardement|offensive|invasion/, -2], [/attentat|terroris|otage/, -4], [/football|coupe du monde|olympi|championnat|formule 1/, -2],
  ],
  ru: [
    [/антикоммунис|контрреволюц/, -8], [/папа римск|понтифик|канонизир|ватикан|епископ|кардинал/, -8], [/корол|императ|принц|монархи|династи|коронац|царь/, -6],
    [/полици|гестапо|кгб|спецслужб/, -5], [/бирж|акци|компани|выпуск|ipod|iphone|microsoft|apple/, -6], [/нацис|гитлер|муссолини|фашис|пиночет/, -3], [/государственный переворот/, -2],
    [/землетрясени|ураган|тайфун|цунами|извержени|наводнени|кораблекрушени|катастроф|авари/, -5], [/первый полёт|космич|аполлон|наса|спутник|космонавт|астронавт|ракет/, -5],
    [/битв|войн|бомбардиров|наступлени|вторжени/, -2], [/теракт|террорис|заложник/, -4], [/футбол|чемпионат|олимпи|формула-1/, -2],
  ],
  zh: [
    [/反共|反革命/, -8], [/教宗|教皇|梵蒂冈|封圣|主教|枢机/, -8], [/国王|女王|皇帝|皇后|王子|公主|君主|王朝|加冕|幕府|沙皇/, -6], [/警察|盖世太保|克格勃|秘密警察/, -5],
    [/股市|证券交易所|公司|发布|ipod|iphone|微软|苹果公司/, -6], [/纳粹|希特勒|墨索里尼|法西斯|皮诺切特/, -3], [/政变/, -2], [/地震|飓风|台风|海啸|喷发|洪水|沉船|空难|事故|灾难/, -5],
    [/首飞|太空|阿波罗|美国国家航空航天局|卫星|宇航员|火箭/, -5], [/战役|战争|轰炸|进攻|入侵/, -2], [/袭击|恐怖|人质/, -4], [/足球|世界杯|奥运|锦标赛|一级方程式/, -2],
  ],
};

// Brasil, América Latina e os países africanos de língua portuguesa ganham um empurrão.
const PERTO: Record<string, RegExp> = {
  pt: /brasil|america latina|latino-americ|cuba|chile|bolivia|venezuela|nicaragua|mexic|argentin|uruguai|paraguai|peru\b|colombia|equador|haiti|panama|el salvador|guatemala|honduras|porto rico|angola|mocambique|guine-bissau|cabo verde|sao tome|portugal/,
  es: /brasil|america latina|latinoameric|cuba|chile|bolivia|venezuela|nicaragua|mexic|argentin|uruguay|paraguay|peru\b|colombia|ecuador|haiti|panama|el salvador|guatemala|honduras|puerto rico/,
  en: /brazil|latin america|cuba|chile|bolivia|venezuela|nicaragua|mexic|argentin|uruguay|paraguay|peru\b|colombia|ecuador|haiti|panama|el salvador|guatemala|honduras|puerto rico|angola|mozambique/,
  fr: /bresil|amerique latine|cuba|chili|bolivie|venezuela|nicaragua|mexique|argentine|uruguay|paraguay|perou|colombie|equateur|haiti|panama|salvador|guatemala|honduras|porto rico|angola|mozambique/,
  ru: /бразил|латинск.{0,6}америк|куб|чили|боливи|венесуэл|никарагуа|мексик|аргентин|уругва|парагва|перу|колумби|эквадор|гаити|панам|сальвадор|гватемал|гондурас|ангол|мозамбик/,
  zh: /巴西|拉丁美洲|古巴|智利|玻利维亚|委内瑞拉|尼加拉瓜|墨西哥|阿根廷|乌拉圭|巴拉圭|秘鲁|哥伦比亚|厄瓜多尔|海地|巴拿马|萨尔瓦多|危地马拉|洪都拉斯|安哥拉|莫桑比克/,
};

/** Quem lutou: nascimentos e mortes dessas pessoas entram no quadro (nome sem acento, em minúsculas). */
const LUTADORES = [
  "karl marx", "friedrich engels", "lenin", "rosa luxemburgo", "rosa luxemburg", "antonio gramsci", "clara zetkin", "alexandra kollontai", "che guevara", "ernesto guevara", "fidel castro",
  "nelson mandela", "martin luther king jr", "malcolm x", "angela davis", "rosa parks", "harriet tubman", "frederick douglass", "frida kahlo", "paulo freire", "carlos marighella",
  "luis carlos prestes", "luiz carlos prestes", "olga benario", "marielle franco", "chico mendes", "dorothy stang", "lelia gonzalez", "abdias do nascimento", "carolina maria de jesus",
  "patricia galvao", "luiz gama", "andre reboucas", "jose do patrocinio", "joao candido", "antonio conselheiro", "darcy ribeiro", "florestan fernandes", "milton santos", "josue de castro",
  "nise da silveira", "oscar niemeyer", "jorge amado", "graciliano ramos", "lima barreto", "cruz e sousa", "salvador allende", "victor jara", "pablo neruda", "violeta parra",
  "mercedes sosa", "eduardo galeano", "gabriel garcia marquez", "simon bolivar", "jose marti", "augusto cesar sandino", "emiliano zapata", "farabundo marti", "oscar romero",
  "camilo torres", "berta caceres", "rigoberta menchu", "tupac amaru", "bartolina sisa", "thomas sankara", "patrice lumumba", "amilcar cabral", "samora machel", "agostinho neto",
  "ho chi minh", "dolores ibarruri", "sacco", "vanzetti", "joao goulart", "leonel brizola", "anisio teixeira", "betinho", "herbert de souza", "vladimir herzog", "stuart angel",
  "zuzu angel", "iara iavelberg", "carlos lamarca", "dandara", "zumbi", "luiz inacio lula da silva", "dilma rousseff", "hugo chavez", "evo morales", "kwame nkrumah", "steve biko",
  "desmond tutu", "winnie mandela", "mahatma gandhi", "eugene debs", "joe hill", "mother jones", "emma goldman", "louise michel", "flora tristan", "frantz fanon", "aime cesaire",
];

export interface Feed {
  selected?: Evento[];
  events?: Evento[];
  births?: Evento[];
  deaths?: Evento[];
}
export interface Evento {
  year?: number;
  text?: string;
  pages?: { titles?: { normalized?: string }; content_urls?: { desktop?: { page?: string } } }[];
}

const NASCE: Record<string, string> = { pt: "Nasce", es: "Nace", en: "Born:", fr: "Naissance de", ru: "Родился(ась):", zh: "出生：" };
const MORRE: Record<string, string> = { pt: "Morre", es: "Muere", en: "Died:", fr: "Mort de", ru: "Умер(ла):", zh: "逝世：" };

// Levantes contra governos socialistas (Hungria em 1956, por exemplo) não são as lutas que o quadro celebra.
const ANTISSOVIETICO = /anti-?sovi|antisovi|contra (os|el gobierno y los) sovieticos|антисоветск|反苏|hungarian revolution|revolucao hungara|revolucion hungara|revolution hongroise|венгерск.{0,12}восстани|匈牙利十月事件/;
function contraRevolucao(texto: string, ano: number): boolean {
  const t = simples(texto);
  return ANTISSOVIETICO.test(t) || ANTISSOVIETICO.test(texto.toLowerCase()) || (ano === 1956 && /hungr|hungar|hongr|budapest|венгр|匈牙利/.test(t));
}

/** A nota de um fato: quanto mais de luta e mais perto, maior. */
export function nota(texto: string, lingua: string): number {
  // Testa com e sem acento: no russo, "й" e "ё" perdem o sinal na forma simples.
  const t = simples(texto);
  const bruto = texto.toLowerCase();
  const casa = (re: RegExp) => re.test(t) || re.test(bruto);
  let n = 0;
  for (const [re, peso] of POSITIVOS[lingua] ?? POSITIVOS.pt) if (casa(re)) n += peso;
  for (const [re, peso] of NEGATIVOS[lingua] ?? NEGATIVOS.pt) if (casa(re)) n += peso;
  if (casa(PERTO[lingua] ?? PERTO.pt)) n += 2;
  return n;
}

const limpar = (texto: string) =>
  texto
    .replace(/<[^>]+>/g, "")
    .replace(/\s*\((?:na |em )?imagem\)|\s*\(pictured\)|\s*\((?:en la |en )?imagen\)|\s*\(на (?:фото|изображении)\)|\s*\((?:en |sur l'|sur la )?(?:image|photo)\)|\s*（[^）]*图[^）]*）/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

function linkDe(evento: Evento, lingua: string): string {
  const pagina = evento.pages?.find((item) => item.content_urls?.desktop?.page?.startsWith(`https://${lingua}.wikipedia.org/`));
  return pagina?.content_urls?.desktop?.page ?? `https://${lingua}.wikipedia.org/`;
}

/**
 * Escolhe até `quantos` fatos de luta para a data: primeiro os da lista da equipe (só em português), depois os da
 * Wikipédia com nota boa, depois nascimentos e mortes de quem lutou. Fato sem nota boa não entra: melhor dois fatos
 * certeiros do que três aleatórios.
 */
export function escolherFatos(feed: Feed | null, lingua: string, curados: FatoDoDia[], quantos = 3): FatoDoDia[] {
  const vistos = new Set<string>();
  const saida: (FatoDoDia & { n: number })[] = [];
  // Palavras de quatro letras ou mais: dois textos do mesmo ano que dividem três delas contam o mesmo fato.
  const palavras = (texto: string) => new Set(simples(texto).match(/\p{L}{4,}/gu) ?? []);
  const repete = (fato: FatoDoDia) => {
    const minhas = palavras(fato.texto);
    return saida.some((outro) => outro.ano === fato.ano && [...palavras(outro.texto)].filter((p) => minhas.has(p)).length >= 3);
  };
  const somar = (fato: FatoDoDia, n: number) => {
    // O mesmo fato costuma vir duas vezes (nos destaques e na lista do dia, ou na lista da equipe e na Wikipédia), com
    // textos diferentes: mesmo link ou as mesmas palavras no mesmo ano.
    const chaves = [`${fato.ano}:${simples(fato.texto).slice(0, 40)}`, ...(/\/wiki\/./.test(fato.link) ? [`${fato.ano}:${fato.link}`] : [])];
    if (chaves.some((chave) => vistos.has(chave)) || repete(fato)) return;
    for (const chave of chaves) vistos.add(chave);
    saida.push({ ...fato, n });
  };
  for (const fato of curados) somar(fato, 100);
  const eventos = [...(feed?.selected ?? []), ...(feed?.events ?? [])].filter((e) => typeof e.year === "number" && typeof e.text === "string" && e.text.trim());
  for (const evento of eventos) {
    const texto = limpar(evento.text!);
    if (contraRevolucao(texto, evento.year!)) continue;
    const n = nota(texto, lingua);
    if (n >= 4) somar({ ano: evento.year!, texto, link: linkDe(evento, lingua) }, n);
  }
  const pessoas = (lista: Evento[] | undefined, verbo: string) => {
    for (const evento of lista ?? []) {
      if (typeof evento.year !== "number" || typeof evento.text !== "string") continue;
      const nome = simples(evento.text);
      if (!LUTADORES.some((lutador) => nome.includes(lutador))) continue;
      const texto = limpar(evento.text);
      somar({ ano: evento.year, texto: `${verbo} ${texto}`, link: linkDe(evento, lingua) }, 5 + ((PERTO[lingua] ?? PERTO.pt).test(nome) ? 2 : 0));
    }
  };
  pessoas(feed?.births, NASCE[lingua] ?? NASCE.pt);
  pessoas(feed?.deaths, MORRE[lingua] ?? MORRE.pt);
  return saida
    .sort((a, b) => b.n - a.n || b.ano - a.ano)
    .slice(0, quantos)
    .sort((a, b) => b.ano - a.ano)
    .map(({ ano, texto, link }) => ({ ano, texto, link }));
}
