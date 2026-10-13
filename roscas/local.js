/* Rosca Fácil · medição feita no próprio celular (sem internet)
   - nitidez(img): diz se a foto está tremida/desfocada antes de mandar para a IA
   - passo(img, pontos): conta os filetes pela ondinha de claro/escuro ao longo da rosca,
     no trecho que a IA apontou. É conta, não chute: corrige quando a IA erra a contagem. */
(function (raiz) {
  function cinza(img, max) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var k = Math.min(1, (max || 99999) / Math.max(w, h));
    var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    var cx = c.getContext("2d"); cx.drawImage(img, 0, 0, c.width, c.height);
    var d; try { d = cx.getImageData(0, 0, c.width, c.height).data; } catch (e) { return null; }
    var g = new Float32Array(c.width * c.height);
    for (var i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2];
    var out = { g: g, w: c.width, h: c.height, k: k };
    c.width = c.height = 0;
    return out;
  }

  /* Nitidez: variação do "Laplaciano" no pedaço mais nítido da foto (a peça focada).
     Foto tremida ou com o foco no fundo dá número baixo. */
  function nitidez(img) {
    var p = cinza(img, 480); if (!p) return null;
    var g = p.g, w = p.w, h = p.h, T = 6, melhor = 0;
    for (var ty = 1; ty < T - 1; ty++) for (var tx = 1; tx < T - 1; tx++) {   // ignora a borda da foto
      var x0 = Math.floor(tx * w / T), x1 = Math.floor((tx + 1) * w / T), y0 = Math.floor(ty * h / T), y1 = Math.floor((ty + 1) * h / T);
      var s = 0, s2 = 0, n = 0;
      for (var y = Math.max(1, y0); y < Math.min(h - 1, y1); y++) for (var x = Math.max(1, x0); x < Math.min(w - 1, x1); x++) {
        var i = y * w + x, L = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
        s += L; s2 += L * L; n++;
      }
      if (n) { var v = s2 / n - (s / n) * (s / n); if (v > melhor) melhor = v; }
    }
    return Math.round(melhor);
  }

  function amostra(p, x, y) {   // bilinear
    if (x < 0 || y < 0 || x >= p.w - 1 || y >= p.h - 1) return NaN;
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * p.w + x0, g = p.g;
    return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + p.w] * (1 - fx) + g[i + p.w + 1] * fx) * fy;
  }
  function semTendencia(v, jan) {
    var out = [], pre = [0];
    for (var i = 0; i < v.length; i++) pre.push(pre[i] + v[i]);
    for (var j = 0; j < v.length; j++) {
      var a = Math.max(0, j - jan), b = Math.min(v.length - 1, j + jan);
      out.push(v[j] - (pre[b + 1] - pre[a]) / (b - a + 1));
    }
    return out;
  }

  /* pontos (0 a 1): diam_a, diam_b (bordas), fil_ini, fil_fim (1º e último filete), n_intervalos.
     Volta { passo_px, razao, qualidade, filetes } na escala da foto original, ou null. */
  function passo(img, pt) {
    if (!pt || !pt.diam_a || !pt.diam_b || !pt.fil_ini || !pt.fil_fim) return null;
    var p = cinza(img); if (!p) return null;
    var W = p.w, H = p.h;
    function P(v) { return [v[0] * W, v[1] * H]; }
    var A = P(pt.diam_a), B = P(pt.diam_b), C = P(pt.fil_ini), Dd = P(pt.fil_fim);
    var D = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (D < 30) return null;
    // eixo da rosca: perpendicular ao diâmetro, no sentido do 1º → último filete
    var qx = (B[0] - A[0]) / D, qy = (B[1] - A[1]) / D, ux = -qy, uy = qx;
    if ((Dd[0] - C[0]) * ux + (Dd[1] - C[1]) * uy < 0) { ux = -ux; uy = -uy; }
    var nInt = Number(pt.n_intervalos) || 0;
    var compIA = Math.abs((Dd[0] - C[0]) * ux + (Dd[1] - C[1]) * uy);
    var passoIA = nInt > 0 && compIA > 0 ? compIA / nInt : 0;
    // trecho: o que a IA marcou, com um pouco de folga; centro = meio do diâmetro projetado no meio dos filetes
    var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    var cm = ((C[0] + Dd[0]) / 2 - mx) * ux + ((C[1] + Dd[1]) / 2 - my) * uy;
    var comp = Math.max(compIA * 1.15, D * 0.6), larg = D * 0.3;
    comp = Math.min(comp, D * 2.5);
    // perfis em várias faixas paralelas (o reflexo muda de uma faixa para outra); soma as autocorrelações
    var faixas = 9, maxLag = Math.round(Math.min(comp / 2.5, D / 4)), soma = new Float64Array(maxLag + 1), usadas = 0;
    for (var f = 0; f < faixas; f++) {
      var o = -larg + (2 * larg) * f / (faixas - 1), v = [], ok = true;
      for (var t = -comp / 2; t <= comp / 2; t += 1) {
        var bx = mx + ux * (cm + t) + qx * o, by = my + uy * (cm + t) + qy * o, s = 0, n = 0;
        for (var e = -2; e <= 2; e++) { var a = amostra(p, bx + qx * e, by + qy * e); if (!isNaN(a)) { s += a; n++; } }
        if (!n) { ok = false; break; }
        v.push(s / n);
      }
      if (!ok || v.length < 30) continue;
      v = semTendencia(v, Math.max(4, Math.round(D / 9)));
      var ac0 = 0; for (var i = 0; i < v.length; i++) ac0 += v[i] * v[i];
      if (!ac0) continue;
      for (var lag = 0; lag <= maxLag; lag++) { var s2 = 0; for (var i2 = 0; i2 + lag < v.length; i2++) s2 += v[i2] * v[i2 + lag]; soma[lag] += s2 / ac0; }
      usadas++;
    }
    if (usadas < 3) return null;
    var ac = Array.prototype.map.call(soma, function (x) { return x / usadas; });
    // picos da autocorrelação depois do primeiro vale
    var z = 2; while (z < maxLag && ac[z] > 0) z++;
    var picos = [];
    for (var L = Math.max(z, 3); L < maxLag; L++) if (ac[L] > 0.05 && ac[L] >= ac[L - 1] && ac[L] >= ac[L + 1]) picos.push(L);
    if (!picos.length) return null;
    // o passo é o 1º pico forte (os seguintes são 2x, 3x o passo); se a IA deu um passo, prefere o pico perto dele
    var forte = Math.max.apply(null, picos.map(function (L2) { return ac[L2]; }));
    var esc = picos.filter(function (L2) { return ac[L2] >= forte * 0.6; })[0];
    var lagM = esc;
    function fino(L3) { var y0 = ac[L3 - 1], y1 = ac[L3], y2 = ac[L3 + 1], den = y0 - 2 * y1 + y2; return L3 + (den ? 0.5 * (y0 - y2) / den : 0); }
    var pp = fino(lagM);
    // usa o 2º e o 3º pico para afinar (passo médio de mais filetes)
    var mult = [2, 3].map(function (m) {
      var alvo = pp * m, best = 0;
      picos.forEach(function (L4) { if (Math.abs(L4 - alvo) <= Math.max(2, pp * 0.15) && (!best || ac[L4] > ac[best])) best = L4; });
      return best ? fino(best) / m : 0;
    }).filter(Boolean);
    if (mult.length) pp = (pp + mult.reduce(function (s3, x) { return s3 + x; }, 0)) / (1 + mult.length);
    var q = ac[lagM];
    // passo da IA muito diferente (ex.: o dobro) com pico fraco no nosso: não confia
    if (passoIA && Math.abs(pp - passoIA) / passoIA > 0.45 && q < 0.35) return null;
    return { passo_px: pp / p.k, diametro_px: D / p.k, razao: D / pp, qualidade: +q.toFixed(2), filetes: Math.round(compIA / pp), passo_ia: passoIA };
  }

  raiz.RoscaLocal = { nitidez: nitidez, passo: passo };
})(this);
