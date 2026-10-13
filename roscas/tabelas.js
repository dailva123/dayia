/* Rosca Fácil by DayIA · tabelas de rosca e comparação
   Famílias:
   - tubo:      BSPP (ISO 228, "G") reta 55° · BSPT (ISO 7, "R") cônica 55° · NPT (ASME B1.20.1) cônica 60°
   - mangueira: JIC 37° (SAE J514, rosca UNF) · ORFS (SAE J1453, rosca UN) — retas, 60°
   - metrica:   rosca métrica fina de conexões (ISO 8434 / DIN 2353) — reta, 60°
   Diâmetro nominal = diâmetro externo do macho. Para a fêmea, o furo é
   aproximado pelo diâmetro menor (nominal menos 2x a altura do filete). */
(function (raiz) {
  var IN = 25.4;
  var TUBO_BSP = {
    "1/16": [7.723, 28], "1/8": [9.728, 28], "1/4": [13.157, 19], "3/8": [16.662, 19],
    "1/2": [20.955, 14], "5/8": [22.911, 14], "3/4": [26.441, 14], "7/8": [30.201, 14],
    "1": [33.249, 11], "1.1/4": [41.910, 11], "1.1/2": [47.803, 11], "2": [59.614, 11],
    "2.1/2": [75.184, 11], "3": [87.884, 11], "4": [113.030, 11]
  };
  var TUBO_NPT = {
    "1/16": [7.938, 27], "1/8": [10.287, 27], "1/4": [13.716, 18], "3/8": [17.145, 18],
    "1/2": [21.336, 14], "3/4": [26.670, 14], "1": [33.401, 11.5], "1.1/4": [42.164, 11.5],
    "1.1/2": [48.260, 11.5], "2": [60.325, 11.5], "2.1/2": [73.025, 8], "3": [88.900, 8],
    "4": [114.300, 8]
  };
  // traço SAE: [diâmetro em polegada, fios por polegada, nome da rosca]
  var JIC = {
    "-2": [5 / 16, 24, "5/16\"-24"], "-3": [3 / 8, 24, "3/8\"-24"], "-4": [7 / 16, 20, "7/16\"-20"],
    "-5": [1 / 2, 20, "1/2\"-20"], "-6": [9 / 16, 18, "9/16\"-18"], "-8": [3 / 4, 16, "3/4\"-16"],
    "-10": [7 / 8, 14, "7/8\"-14"], "-12": [1 + 1 / 16, 12, "1.1/16\"-12"], "-14": [1 + 3 / 16, 12, "1.3/16\"-12"],
    "-16": [1 + 5 / 16, 12, "1.5/16\"-12"], "-20": [1 + 5 / 8, 12, "1.5/8\"-12"], "-24": [1 + 7 / 8, 12, "1.7/8\"-12"],
    "-32": [2 + 1 / 2, 12, "2.1/2\"-12"]
  };
  var ORFS = {
    "-4": [9 / 16, 18, "9/16\"-18"], "-6": [11 / 16, 16, "11/16\"-16"], "-8": [13 / 16, 16, "13/16\"-16"],
    "-10": [1, 14, "1\"-14"], "-12": [1 + 3 / 16, 12, "1.3/16\"-12"], "-16": [1 + 7 / 16, 12, "1.7/16\"-12"],
    "-20": [1 + 11 / 16, 12, "1.11/16\"-12"], "-24": [2, 12, "2\"-12"]
  };
  // métrica: [diâmetro mm, passo mm]
  var METRICA = {
    "M8x1": [8, 1], "M10x1": [10, 1], "M12x1,5": [12, 1.5], "M14x1,5": [14, 1.5], "M16x1,5": [16, 1.5],
    "M18x1,5": [18, 1.5], "M20x1,5": [20, 1.5], "M22x1,5": [22, 1.5], "M24x1,5": [24, 1.5], "M26x1,5": [26, 1.5],
    "M27x2": [27, 2], "M30x2": [30, 2], "M33x2": [33, 2], "M36x2": [36, 2], "M42x2": [42, 2], "M45x2": [45, 2], "M52x2": [52, 2]
  };

  var NORMAS = {
    BSPP: { familia: "tubo", forma: "reta", angulo: 55, nome: "BSP reta (BSPP / G)", desc: "Rosca reta inglesa. Veda com anel ou arruela." },
    BSPT: { familia: "tubo", forma: "conica", angulo: 55, nome: "BSP cônica (BSPT / R)", desc: "Rosca cônica inglesa. Veda na própria rosca, com fita veda-rosca." },
    NPT:  { familia: "tubo", forma: "conica", angulo: 60, nome: "NPT", desc: "Rosca cônica americana. Veda na própria rosca, com fita veda-rosca." },
    JIC:  { familia: "mangueira", forma: "reta", angulo: 60, vedacao: "cone", nome: "JIC 37°", desc: "Conexão de mangueira com assento em cone de 37°. Rosca UNF." },
    ORFS: { familia: "mangueira", forma: "reta", angulo: 60, vedacao: "face", nome: "ORFS", desc: "Conexão de face plana com anel de borracha (o-ring) na ponta." },
    MET:  { familia: "metrica", forma: "reta", angulo: 60, nome: "Métrica", desc: "Rosca métrica fina, comum em conexões hidráulicas europeias (DIN)." }
  };
  var FAMILIAS = { tubo: "Rosca BSP / NPT", mangueira: "Rosca JIC / ORFS", metrica: "Rosca métrica" };

  // diferença entre diâmetro externo e diâmetro menor (2 x altura do filete)
  function altura(passo, ang) { return (ang === 55 ? 1.2806 : 1.2269) * passo; }

  var BASE = (function () {
    var out = [];
    function add(norma, bitola, nominal, passo, rosca, grupo) {
      var N = NORMAS[norma];
      out.push({ norma: norma, familia: N.familia, nome: N.nome, desc: N.desc, forma: N.forma, angulo: N.angulo,
        vedacao: N.vedacao || "", bitola: bitola, rosca: rosca || "", nominal: nominal, passoExato: passo,
        tpi: +(IN / passo).toFixed(2), grupo: grupo });
    }
    Object.keys(TUBO_BSP).forEach(function (b) { var x = TUBO_BSP[b]; add("BSPP", b + "\"", x[0], IN / x[1], "", "T" + b); add("BSPT", b + "\"", x[0], IN / x[1], "", "T" + b); });
    Object.keys(TUBO_NPT).forEach(function (b) { var x = TUBO_NPT[b]; add("NPT", b + "\"", x[0], IN / x[1], "", "T" + b); });
    Object.keys(JIC).forEach(function (b) { var x = JIC[b]; add("JIC", b, x[0] * IN, IN / x[1], x[2], "U" + x[2]); });
    Object.keys(ORFS).forEach(function (b) { var x = ORFS[b]; add("ORFS", b, x[0] * IN, IN / x[1], x[2], "U" + x[2]); });
    Object.keys(METRICA).forEach(function (b) { var x = METRICA[b]; add("MET", b, x[0], x[1], "", "M" + b); });
    return out;
  })();

  function linhas(tipo, familia) {
    return BASE.filter(function (l) { return !familia || l.familia === familia; }).map(function (l) {
      var c = {}; for (var k in l) c[k] = l[k];
      var diam = tipo === "femea" ? l.nominal - altura(l.passoExato, l.angulo) : l.nominal;
      c.diametro = +diam.toFixed(2);
      c.passo = +l.passoExato.toFixed(3);
      c.razao = +(l.nominal / l.passoExato).toFixed(2);
      c.rotulo = rotulo(c);
      return c;
    });
  }

  /* Medida gravada/impressa na peça (ex.: "1/2", "3/4\"", "-6", "M16x1,5") → mesma forma dos rótulos da tabela */
  function normMarca(t) {
    t = String(t || "").toUpperCase().replace(/(\d+)\s+(\d+\/\d+)/, "$1.$2").replace(/["”″'\s]/g, "").replace(/POL(EGADA)?S?$/, "").replace(",", ".");
    t = t.replace(/^(\d+)[-.](\d+\/\d+)$/, "$1.$2");      // 1-1/4 ou 1 1/4 → 1.1/4
    return t;
  }
  function bateMarca(l, marca) {
    if (!marca) return false;
    var b = normMarca(l.bitola);
    if (l.familia === "metrica") return marca === b || (/^M\d+$/.test(marca) && b.indexOf(marca + "X") === 0);
    if (l.familia === "mangueira") return marca === b || marca === b.replace("-", "");
    return marca === b;
  }

  function rotulo(l) {
    if (l.familia === "mangueira") return l.norma + " " + l.bitola + " (" + l.rosca + ")";
    return l.bitola;
  }

  /* medida: {diametro_mm, tem_referencia, fios_por_polegada, passo_mm, razao, diametro_estimado_mm, forma, vedacao}
     - Com referência (cartão/régua/tela): compara o diâmetro em mm (preciso) e o passo.
     - Sem referência (só a foto): compara a RAZÃO diâmetro ÷ passo, que não muda
       com a distância da foto, e usa o tamanho estimado só para desempatar.
     Retorna lista ordenada do mais provável ao menos provável. */
  function comparar(medida, tipo, familia) {
    var d = Number(medida.diametro_mm);
    var razao = Number(medida.razao) || 0;
    var est = Number(medida.diametro_estimado_mm) || 0;
    var comRef = d > 0 && medida.tem_referencia !== false;
    // pente de rosca: passo exato. Com a proporção da foto, dá o diâmetro real (diâmetro = proporção x passo)
    var pentePasso = Number(medida.pente_passo_mm) || (Number(medida.pente_fios) ? IN / Number(medida.pente_fios) : 0);
    var penteAng = Number(medida.pente_angulo) === 55 || Number(medida.pente_angulo) === 60 ? Number(medida.pente_angulo) : 0;
    if (pentePasso > 0 && !comRef && razao > 0) { d = razao * pentePasso; comRef = true; }
    if (!comRef && !(razao > 0)) {
      if (est > 0) { d = est; comRef = true; } else return [];
    }
    var passo = pentePasso || Number(medida.passo_mm) || (Number(medida.fios_por_polegada) ? IN / Number(medida.fios_por_polegada) : 0);
    var forma = medida.forma === "reta" || medida.forma === "conica" ? medida.forma : "";
    var ved = medida.vedacao === "cone" || medida.vedacao === "face" ? medida.vedacao : "";
    var marca = normMarca(medida.marcacao);
    var lista = linhas(tipo, familia).filter(function (l) {
      if (penteAng && l.angulo !== penteAng) return false;   // 55° = BSP (Whitworth); 60° = NPT, JIC, ORFS, métrica
      if (forma === "reta" && l.forma !== "reta") return false;
      if (forma === "conica" && l.forma !== "conica") return false;
      if (ved && l.vedacao && l.vedacao !== ved) return false;
      return true;
    });
    lista.forEach(function (l) {
      if (comRef) {
        var erroD = Math.abs(d - l.diametro) / l.diametro;
        var erroP = passo ? Math.abs(passo - l.passo) / l.passo : 0;
        if (pentePasso) erroP *= 3;
        var erroR = razao && !passo ? Math.abs(razao - l.razao) / l.razao : 0;
        l.pontos = erroD + 0.35 * erroP + 0.2 * erroR;
      } else {
        var eR = Math.abs(razao - l.razao) / l.razao;
        var eE = est > 0 ? Math.abs(Math.log(est / l.diametro)) : 0;
        l.pontos = eR + 0.25 * eE;   // tamanho estimado pela IA (dedos, sextavado) separa 1/16" de 1/4" e 3/4" de 1"
      }
    });
    // medida gravada na peça e compatível com a medição: vale muito
    if (marca) lista.forEach(function (l) { if (bateMarca(l, marca) && l.pontos < 0.35) { l.pontos *= 0.25; l.marcada = true; } });
    lista.sort(function (a, b) { return a.pontos - b.pontos; });
    lista.semReferencia = !comRef;
    lista.comPente = pentePasso > 0;
    return lista;
  }

  /* Agrupa normas que empatam no mesmo tamanho (BSPP x BSPT x NPT; JIC x ORFS com a mesma rosca) */
  function resumir(lista) {
    if (!lista.length) return null;
    var m = lista[0];
    var empate = lista.filter(function (l, i) { return i > 0 && l.grupo === m.grupo; });
    var outras = [], vistos = {};
    vistos[m.grupo] = 1;
    lista.forEach(function (l) {
      if (vistos[l.grupo] || outras.length >= 3) return;
      vistos[l.grupo] = 1; outras.push(l);
    });
    var conf = m.pontos < 0.03 ? "alta" : m.pontos < 0.08 ? "média" : "baixa";
    if (lista.semReferencia) conf = m.pontos > 0.12 ? "baixa" : "média";
    if (lista.comPente && m.pontos < 0.06) conf = "alta";
    return { melhor: m, empate: empate, outras: outras, confianca: conf, semReferencia: !!lista.semReferencia };
  }

  /* Junta medições de várias fotos: mediana ponderada pela certeza;
     medições ajustadas à mão valem mais que as da IA. */
  function juntar(medidas) {
    var ok = medidas.filter(function (m) { return m && (razaoPossivel(m.razao) || m.tem_referencia); });
    if (!ok.length) return null;
    // com 3 fotos, a que destoa muito das outras duas (outra peça, contagem errada) fica de fora
    if (ok.length >= 3) {
      var rs = ok.map(function (m) { return Number(m.razao) || 0; }).filter(Boolean).sort(function (a, b) { return a - b; });
      var med = rs[Math.floor(rs.length / 2)];
      var dentro = ok.filter(function (m) { return !m.razao || Math.abs(m.razao - med) / med <= 0.2; });
      if (dentro.length >= 2) ok = dentro;
    }
    function peso(m) { return (m.ajustada ? 3 : 1) * Math.max(0.2, (Number(m.certeza) || 60) / 100); }
    function mediana(campo, filtro) {
      var xs = ok.filter(filtro || function (m) { return Number(m[campo]) > 0; })
        .map(function (m) { return { v: Number(m[campo]), p: peso(m) }; })
        .sort(function (a, b) { return a.v - b.v; });
      if (!xs.length) return null;
      var tot = xs.reduce(function (s, x) { return s + x.p; }, 0), acc = 0;
      for (var i = 0; i < xs.length; i++) { acc += xs[i].p; if (acc >= tot / 2) return xs[i].v; }
      return xs[xs.length - 1].v;
    }
    var temRef = function (m) { return m.tem_referencia && Number(m.diametro_mm) > 0; };
    var comRef = ok.filter(temRef);
    var formas = {};
    ok.forEach(function (m) { if (m.forma === "reta" || m.forma === "conica") formas[m.forma] = (formas[m.forma] || 0) + peso(m); });
    var forma = Object.keys(formas).sort(function (a, b) { return formas[b] - formas[a]; })[0] || "indefinida";
    var razoes = ok.map(function (m) { return Number(m.razao); }).filter(function (x) { return x > 0; });
    var espalho = razoes.length > 1 ? (Math.max.apply(null, razoes) - Math.min.apply(null, razoes)) / Math.min.apply(null, razoes) : 0;
    return {
      razao: mediana("razao"),
      diametro_estimado_mm: mediana("diametro_estimado_mm"),
      tem_referencia: comRef.length > 0,
      diametro_mm: comRef.length ? mediana("diametro_mm", temRef) : null,
      passo_mm: comRef.length ? mediana("passo_mm", function (m) { return temRef(m) && Number(m.passo_mm) > 0; }) : null,
      forma: forma,
      certeza: Math.round(ok.reduce(function (s, m) { return s + (Number(m.certeza) || 60); }, 0) / ok.length),
      fotos: ok.length,
      ajustada: ok.some(function (m) { return m.ajustada; }),
      espalho: +espalho.toFixed(3),
      problemas: ok.map(function (m) { return m.problemas; }).filter(Boolean)[0] || "",
      marcacao: ok.map(function (m) { return m.marcacao; }).filter(Boolean)[0] || "",
      pente_auto: ok.map(function (m) { return m.pente_auto; }).filter(Boolean)[0] || "",
      pente_fios: ok.map(function (m) { return Number(m.pente_fios) || 0; }).filter(Boolean)[0] || null,
      pente_passo_mm: ok.map(function (m) { return Number(m.pente_passo_mm) || 0; }).filter(Boolean)[0] || null,
      pente_angulo: ok.map(function (m) { return Number(m.pente_angulo) || 0; }).filter(Boolean)[0] || null
    };
  }

  /* Nenhuma rosca de conexão tem proporção diâmetro ÷ passo fora desta faixa
     (a menor é 1/16" ≈ 8,4; a maior, 4" BSP ≈ 49). Fora disso, a marcação está errada. */
  function razaoPossivel(r) { r = Number(r); return r >= 7.5 && r <= 55; }

  function pol(mm) { return (mm / IN).toFixed(3).replace(".", ",") + "\""; }

  var api = { razaoPossivel: razaoPossivel, NORMAS: NORMAS, FAMILIAS: FAMILIAS, linhas: linhas, comparar: comparar, resumir: resumir, juntar: juntar, pol: pol, rotulo: rotulo };
  if (typeof module !== "undefined") module.exports = api; else raiz.Roscas = api;
})(this);
