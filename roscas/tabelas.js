/* Rosca Fácil by DayIA · tabelas de rosca de tubo e comparação
   BSPP (ISO 228, "G")  reta  · 55°
   BSPT (ISO 7, "R")    cônica · 55°  (mesmo diâmetro e passo da BSPP)
   NPT  (ASME B1.20.1)  cônica · 60°
   Diâmetro nominal = diâmetro externo do macho. Para a fêmea, o furo é
   aproximado pelo diâmetro menor (nominal menos a altura do filete). */
(function (raiz) {
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
  var NORMAS = {
    BSPP: { tab: TUBO_BSP, forma: "reta", angulo: 55, nome: "BSP reta (BSPP / G)", desc: "Rosca reta inglesa. Veda com anel ou arruela." },
    BSPT: { tab: TUBO_BSP, forma: "conica", angulo: 55, nome: "BSP cônica (BSPT / R)", desc: "Rosca cônica inglesa. Veda na própria rosca, com fita veda-rosca." },
    NPT:  { tab: TUBO_NPT, forma: "conica", angulo: 60, nome: "NPT", desc: "Rosca cônica americana. Veda na própria rosca, com fita veda-rosca." }
  };

  // diferença entre diâmetro externo e diâmetro menor (2 x altura do filete)
  function altura(passo, ang) { return (ang === 55 ? 1.2806 : 1.2269) * passo; }

  function linhas(tipo) {
    var out = [];
    Object.keys(NORMAS).forEach(function (n) {
      var N = NORMAS[n];
      Object.keys(N.tab).forEach(function (b) {
        var d = N.tab[b][0], tpi = N.tab[b][1], passo = 25.4 / tpi;
        var diam = tipo === "femea" ? d - altura(passo, N.angulo) : d;
        out.push({ norma: n, nome: N.nome, desc: N.desc, forma: N.forma, bitola: b,
          diametro: +diam.toFixed(2), nominal: d, tpi: tpi, passo: +passo.toFixed(3) });
      });
    });
    return out;
  }

  /* medida: {diametro_mm, fios_por_polegada, forma: reta|conica|indefinida}
     Retorna lista ordenada do mais provável ao menos provável. */
  function comparar(medida, tipo) {
    var d = Number(medida.diametro_mm);
    if (!(d > 0)) return [];
    var tpi = Number(medida.fios_por_polegada) || 0;
    var forma = medida.forma === "reta" || medida.forma === "conica" ? medida.forma : "";
    var lista = linhas(tipo).filter(function (l) { return !forma || l.forma === forma; });
    lista.forEach(function (l) {
      var erroD = Math.abs(d - l.diametro) / l.diametro;          // erro relativo do diâmetro
      var erroT = tpi ? Math.abs(tpi - l.tpi) / l.tpi : 0;         // erro relativo dos fios
      l.erro_mm = +Math.abs(d - l.diametro).toFixed(2);
      l.pontos = erroD + 0.35 * erroT;
    });
    lista.sort(function (a, b) { return a.pontos - b.pontos; });
    return lista;
  }

  /* Agrupa normas que empatam na mesma bitola (ex.: BSPP x BSPT, BSPT x NPT) */
  function resumir(lista) {
    if (!lista.length) return null;
    var m = lista[0];
    // Na mesma bitola, BSP e NPT diferem 1 a 4% no diâmetro: menos que a
    // precisão de uma foto. Por isso todas as normas da bitola ficam juntas.
    var empate = lista.filter(function (l, i) { return i > 0 && l.bitola === m.bitola; });
    var outras = [], vistos = {};
    vistos[m.bitola] = 1;
    lista.forEach(function (l) {
      if (vistos[l.bitola] || outras.length >= 2) return;
      vistos[l.bitola] = 1; outras.push(l);
    });
    var conf = m.pontos < 0.03 ? "alta" : m.pontos < 0.08 ? "média" : "baixa";
    return { melhor: m, empate: empate, outras: outras, confianca: conf };
  }

  function pol(mm) { return (mm / 25.4).toFixed(3).replace(".", ",") + "\""; }

  var api = { NORMAS: NORMAS, linhas: linhas, comparar: comparar, resumir: resumir, pol: pol };
  if (typeof module !== "undefined") module.exports = api; else raiz.Roscas = api;
})(this);
