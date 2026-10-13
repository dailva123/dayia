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

    /* Bordas da rosca: onde existe a "ondinha" dos filetes (no passo medido) é rosca; fora dela, é fundo.
       Assim o diâmetro não depende de a IA ter marcado as bordas certinho. */
    var borda = bordas(p, mx, my, ux, uy, qx, qy, cm, comp, pp, D);
    var Dl = D, novos = null;
    if (borda && Roscas_ok(borda.D / pp) && borda.contraste >= 8 && Math.abs(borda.D - D) / D > 0.12 && Math.abs(borda.D - D) / D < 0.45) {
      Dl = borda.D;
      var cx0 = mx + ux * cm, cy0 = my + uy * cm;
      novos = { diam_a: [(cx0 + qx * borda.esq) / W, (cy0 + qy * borda.esq) / H], diam_b: [(cx0 + qx * borda.dir) / W, (cy0 + qy * borda.dir) / H] };
    }
    return { passo_px: pp / p.k, diametro_px: Dl / p.k, diametro_ia_px: D / p.k, razao: Dl / pp, qualidade: +q.toFixed(2),
      filetes: Math.round(compIA / pp), passo_ia: passoIA, bordas: novos, contraste: borda ? borda.contraste : 0 };
  }

  function Roscas_ok(r) { return r >= 7.5 && r <= 55; }
  // energia da ondinha no passo pp, em cada linha paralela ao eixo (deslocamento o em relação ao centro)
  function bordas(p, mx, my, ux, uy, qx, qy, cm, comp, pp, D) {
    var passoO = Math.max(1, D / 160), os = [], E = [];
    var L = Math.max(comp, pp * 4), w = 2 * Math.PI / pp;
    var R = Math.max(1.1 * D, 13 * pp);
    for (var o = -R; o <= R; o += passoO) {
      var v = [], ok = true;
      for (var t = -L / 2; t <= L / 2; t += 1) {
        var a = amostra(p, mx + ux * (cm + t) + qx * o, my + uy * (cm + t) + qy * o);
        if (isNaN(a)) { ok = false; break; }
        v.push(a);
      }
      os.push(o);
      if (!ok || v.length < 20) { E.push(0); continue; }
      v = semTendencia(v, Math.max(3, Math.round(pp * 1.5)));
      var re = 0, im = 0;
      for (var i = 0; i < v.length; i++) { re += v[i] * Math.cos(w * i); im += v[i] * Math.sin(w * i); }
      E.push(Math.sqrt(re * re + im * im) / v.length);
    }
    // suaviza (meio passo) para os reflexos não abrirem buracos
    var jan = Math.max(1, Math.round(pp / 2 / passoO)), Es = [];
    for (var j = 0; j < E.length; j++) { var s = 0, n = 0; for (var k = j - jan; k <= j + jan; k++) if (k >= 0 && k < E.length) { s += E[k]; n++; } Es.push(s / n); }
    var ord = Es.slice().sort(function (x, y) { return x - y; });
    var fundo = ord[Math.floor(ord.length * 0.15)], topo = ord[Math.floor(ord.length * 0.95)];
    if (!(topo > fundo * 2.5)) return null;
    var lim = fundo + 0.22 * (topo - fundo);
    // parte do ponto mais forte perto do centro e abre para os dois lados, pulando buracos pequenos
    var c0 = 0, best = -1;
    for (var m = 0; m < Es.length; m++) if (Math.abs(os[m]) < 0.6 * D && Es[m] > best) { best = Es[m]; c0 = m; }
    var buraco = Math.max(2, Math.round(Math.max(pp * 1.2, D * 0.06) / passoO));
    function anda(dir) {
      var ultimo = c0, falta = 0;
      for (var i2 = c0 + dir; i2 >= 0 && i2 < Es.length; i2 += dir) {
        if (Es[i2] >= lim) { ultimo = i2; falta = 0; } else if (++falta > buraco) break;
      }
      return ultimo;
    }
    var a = anda(-1), b = anda(1);
    if (a <= 0 || b >= Es.length - 1) return null;          // encostou no limite: não achou a borda
    var esq = os[a] - passoO / 2, dir = os[b] + passoO / 2;
    return { esq: esq, dir: dir, D: dir - esq, contraste: +(topo / Math.max(1e-6, fundo)).toFixed(1) };
  }

  /* A IA às vezes devolve os pontos em outra escala (0 a 1000, ou em pixels) ou com x e y trocados.
     Aí as bolinhas iam parar num lugar padrão, fora da rosca. Aqui o app testa as leituras possíveis
     e fica com a que cai em cima de filetes de verdade. */
  function ajustarPontos(img, pt, diametroPxIA) {
    if (!pt) return null;
    var chaves = ["diam_a", "diam_b", "fil_ini", "fil_fim"];
    if (!chaves.every(function (k) { return pt[k] && pt[k].length === 2 && isFinite(pt[k][0]) && isFinite(pt[k][1]); })) return null;
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    var ke = Math.min(1, 1024 / Math.max(W, H)), We = W * ke, He = H * ke;   // tamanho da foto que foi para a IA
    var maior = Math.max.apply(null, chaves.map(function (k) { return Math.max(pt[k][0], pt[k][1]); }));
    var escalas = [[1, 1]];
    if (maior > 1.02) escalas = [[1000, 1000], [We, He], [W, H]];
    var melhor = null;
    escalas.forEach(function (e) {
      [false, true].forEach(function (troca) {
        var q = { n_intervalos: pt.n_intervalos }, ok = true;
        chaves.forEach(function (k) {
          var x = troca ? pt[k][1] : pt[k][0], y = troca ? pt[k][0] : pt[k][1];
          var v = [x / e[0], y / e[1]];
          if (!(v[0] >= -0.02 && v[0] <= 1.02 && v[1] >= -0.02 && v[1] <= 1.02)) ok = false;
          q[k] = [Math.min(1, Math.max(0, v[0])), Math.min(1, Math.max(0, v[1]))];
        });
        if (!ok) return;
        var r = null; try { r = passo(img, q); } catch (err) { r = null; }
        var nota = r ? r.qualidade : 0;
        if (r && diametroPxIA > 0) {   // diâmetro que a IA disse em pixels deve bater com os pontos
          var dq = Math.hypot((q.diam_b[0] - q.diam_a[0]) * We, (q.diam_b[1] - q.diam_a[1]) * He);
          nota -= Math.min(0.3, Math.abs(Math.log(dq / diametroPxIA)) * 0.3);
        }
        if (!troca) nota += 0.02;   // na dúvida, a ordem normal (x, y)
        if (!melhor || nota > melhor.nota) melhor = { nota: nota, pontos: q, r: r };
      });
    });
    return melhor;
  }

  /* ===== Medida pelos dois toques =====
     A e B (0 a 1): pontas dos filetes dos dois lados da rosca.
     O app descobre a direção da rosca (em que direção a ondinha dos filetes é mais forte),
     mede o passo e o diâmetro (A–B medido na direção certa). */
  var cache = { img: null, p: null };
  function cinzaCache(img, max) { var ch = (max || 0); if (cache.img !== img || cache.max !== ch) { cache.img = img; cache.max = ch; cache.p = cinza(img, max); } return cache.p; }
  function autocorr(p, M, ux, uy, qx, qy, D, c, L, minLag, maxLag) {
    var soma = new Float64Array(maxLag + 2), usadas = 0, faixas = 7, larg = D * 0.28;
    for (var f = 0; f < faixas; f++) {
      var o = -larg + 2 * larg * f / (faixas - 1), v = [];
      for (var t = -L / 2; t <= L / 2; t += 1) {
        var bx = M[0] + ux * (c + t) + qx * o, by = M[1] + uy * (c + t) + qy * o, s = 0, n = 0;
        for (var e = -2; e <= 2; e++) { var a = amostra(p, bx + qx * e, by + qy * e); if (!isNaN(a)) { s += a; n++; } }
        if (n) v.push(s / n);
      }
      if (v.length < L * 0.7) continue;
      v = semTendencia(v, Math.max(3, Math.round(maxLag)));
      var ac0 = 0; for (var i = 0; i < v.length; i++) ac0 += v[i] * v[i];
      if (!ac0) continue;
      for (var lag = 1; lag <= maxLag + 1; lag++) { var s2 = 0; for (var j = 0; j + lag < v.length; j++) s2 += v[j] * v[j + lag]; soma[lag] += s2 / ac0; }
      usadas++;
    }
    if (usadas < 3) return null;
    var ac = Array.prototype.map.call(soma, function (x) { return x / usadas; });
    var best = 0;
    for (var L2 = minLag; L2 <= maxLag; L2++) if (ac[L2] >= ac[L2 - 1] && ac[L2] >= ac[L2 + 1] && (!best || ac[L2] > ac[best])) best = L2;
    if (!best || ac[best] <= 0.05) return { q: 0 };
    // se a metade também tem pico forte, o passo de verdade é a metade
    var meio = Math.round(best / 2);
    for (var k = Math.max(minLag, meio - 1); k <= meio + 1; k++) if (k < best && ac[k] >= ac[k - 1] && ac[k] >= ac[k + 1] && ac[k] >= 0.8 * ac[best]) { best = k; break; }
    function fino(x) { var y0 = ac[x - 1], y1 = ac[x], y2 = ac[x + 1], den = y0 - 2 * y1 + y2; return x + (den ? 0.5 * (y0 - y2) / den : 0); }
    var pp = fino(best), vals = [pp];
    [2, 3].forEach(function (m) { var alvo = Math.round(pp * m); if (alvo + 1 < ac.length) { var bb = alvo; for (var z = alvo - 2; z <= alvo + 2; z++) if (z > 0 && z + 1 < ac.length && ac[z] > ac[bb]) bb = z; if (ac[bb] > 0.1) vals.push(fino(bb) / m); } });
    pp = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    return { q: ac[best], pp: pp };
  }
  function medirEntre(img, An, Bn) {
    // rapidez: trabalha numa cópia em que a rosca tem no máximo ~220 px de largura (sobra precisão e fica leve no celular)
    var Wn = img.naturalWidth || img.width, Hn = img.naturalHeight || img.height;
    var Dn = Math.hypot((Bn[0] - An[0]) * Wn, (Bn[1] - An[1]) * Hn);
    var max = Dn > 220 ? Math.round(Math.max(Wn, Hn) * 220 / Dn) : 0;
    var p = cinzaCache(img, max); if (!p) return null;
    var A = [An[0] * p.w, An[1] * p.h], B = [Bn[0] * p.w, Bn[1] * p.h];
    var D0 = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (D0 < 20) return null;
    var M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], q0 = [(B[0] - A[0]) / D0, (B[1] - A[1]) / D0];
    var minLag = Math.max(3, Math.floor(D0 / 45)), maxLag = Math.ceil(D0 / 6.5), L = Math.max(D0 * 1.1, maxLag * 5);
    var melhor = null;
    function testa(th, c) {
      var cs = Math.cos(th), sn = Math.sin(th);
      var ux = -q0[1] * cs - q0[0] * sn, uy = q0[0] * cs - q0[1] * sn;   // eixo = perpendicular ao toque, girado th
      var r = autocorr(p, M, ux, uy, -uy, ux, D0, c, L, minLag, maxLag);
      var nota = r && r.pp ? r.q - 0.25 * Math.abs(th) : -1;
      if (r && r.pp && (!melhor || nota > melhor.nota)) melhor = { q: r.q, nota: nota, pp: r.pp, ux: ux, uy: uy, c: c, th: th };
    }
    var graus = Math.PI / 180;
    [-0.45 * D0, 0, 0.45 * D0].forEach(function (c) { for (var g = -24; g <= 24; g += 3) testa(g * graus, c); });
    if (!melhor) return null;
    var g0 = melhor.th, c0 = melhor.c;
    for (var g2 = -2; g2 <= 2; g2 += 1) testa(g0 + g2 * graus, c0);   // afina o ângulo
    var qx = -melhor.uy, qy = melhor.ux;
    var D = Math.abs((B[0] - A[0]) * qx + (B[1] - A[1]) * qy);       // largura medida na direção certa
    return { razao: D / melhor.pp, passo_px: melhor.pp, diametro_px: D, qualidade: +melhor.q.toFixed(2),
      eixo: [melhor.ux, melhor.uy], centro: [(M[0] + melhor.ux * c0) / p.w, (M[1] + melhor.uy * c0) / p.h], W: p.w, H: p.h };
  }

  /* ===== Tela dos dois toques ===== */
  function marcar(opts) {
    var img = opts.img, W = img.naturalWidth, H = img.naturalHeight;
    var pts = [], res = null, zoom = 1, foco = [W / 2, H / 2], arrastando = -1, apertado = null;
    var ov = document.createElement("div");
    ov.className = "editor marcar";
    ov.innerHTML =
      '<div class="ed-topo"><button type="button" class="mc-x" aria-label="Fechar">✕</button><b>Marque a rosca</b><span></span></div>' +
      '<div class="ed-palco"><canvas class="mc-foto"></canvas><canvas class="ed-lupa mc-lupa" width="240" height="240" hidden></canvas>' +
      '<div class="mc-passo" aria-live="polite"></div>' +
      '<div class="ed-zoom"><button type="button" data-z="in" aria-label="Aumentar a foto">+</button><button type="button" data-z="out" aria-label="Diminuir a foto">−</button></div>' +
      '<div class="ed-zoom-tag"></div></div>' +
      '<div class="ed-painel"><div class="ed-previa mc-res">Toque na <b>ponta dos filetes</b> de um lado da rosca e depois do outro lado. Se errar, arraste a bolinha.</div>' +
      '<div class="ed-acoes"><button type="button" class="btn sec mc-limpar">Marcar de novo</button><button type="button" class="btn mc-ok" disabled>Usar esta medida</button></div></div>';
    document.body.appendChild(ov);
    var palco = ov.querySelector(".ed-palco"), cv = ov.querySelector(".mc-foto"), ctx = cv.getContext("2d");
    var lupa = ov.querySelector(".mc-lupa"), lctx = lupa.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
    var pw = 0, ph = 0, base = 1;
    function S() { return base * zoom; }
    function org() { return [pw / 2 - foco[0] * S(), ph / 2 - foco[1] * S()]; }
    function tela(q) { var o = org(); return [q[0] * S() + o[0], q[1] * S() + o[1]]; }
    function foto(x, y) { var o = org(); return [(x - o[0]) / S(), (y - o[1]) / S()]; }
    function limitar() {
      var vw = pw / S(), vh = ph / S();
      foco[0] = vw >= W ? W / 2 : Math.min(W - vw / 2, Math.max(vw / 2, foco[0]));
      foco[1] = vh >= H ? H / 2 : Math.min(H - vh / 2, Math.max(vh / 2, foco[1]));
    }
    function layout() {
      pw = palco.clientWidth; ph = palco.clientHeight;
      cv.style.width = pw + "px"; cv.style.height = ph + "px"; cv.width = Math.round(pw * dpr); cv.height = Math.round(ph * dpr);
      base = Math.min(pw / W, ph / H); limitar(); desenhar();
    }
    function passoTxt() {
      var t = pts.length === 0 ? "1️⃣ Toque na <b>ponta dos filetes</b> de um lado da rosca" :
        pts.length === 1 ? "2️⃣ Agora toque na ponta dos filetes do <b>outro lado</b>" :
        res && res.qualidade >= 0.12 ? "✅ Confira: o espaço entre os risquinhos azuis deve ser igual ao espaço entre os filetes" : "⚠️ Não achei os filetes entre os toques";
      ov.querySelector(".mc-passo").innerHTML = t;
    }
    function desenhar() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0B1B2C"; ctx.fillRect(0, 0, pw, ph);
      var o = org(); ctx.drawImage(img, o[0], o[1], W * S(), H * S());
      if (pts.length === 2) {
        var a = tela(pts[0]), b = tela(pts[1]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = "#F2C230"; ctx.lineWidth = 3; ctx.stroke();
      }
      if (res && res.qualidade >= 0.12) {
        // pente desenhado: risquinhos a cada passo, ao longo do eixo, nas duas bordas
        var k = W / res.W, ux = res.eixo[0], uy = res.eixo[1], qx = -uy, qy = ux;
        var c = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], pp = res.passo_px * k, half = res.diametro_px * k / 2;
        var n = 3;
        // fase: alinha com o meio do toque
        ctx.strokeStyle = "#3BA3FF"; ctx.lineWidth = 2.5;
        [-1, 1].forEach(function (lado) {
          for (var i = -n; i <= n; i++) {
            var p0 = [c[0] + ux * i * pp + qx * lado * half * 0.86, c[1] + uy * i * pp + qy * lado * half * 0.86];
            var p1 = [c[0] + ux * i * pp + qx * lado * half * 1.12, c[1] + uy * i * pp + qy * lado * half * 1.12];
            var s0 = tela(p0), s1 = tela(p1);
            ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
          }
        });
      }
      pts.forEach(function (q, i) {
        var t = tela(q);
        ctx.beginPath(); ctx.arc(t[0], t[1], 13, 0, 7); ctx.fillStyle = "rgba(242,194,48,.25)"; ctx.fill();
        ctx.beginPath(); ctx.arc(t[0], t[1], 5, 0, 7); ctx.fillStyle = "#F2C230"; ctx.fill(); ctx.strokeStyle = "#0E2238"; ctx.lineWidth = 2; ctx.stroke();
      });
      ov.querySelector(".ed-zoom-tag").textContent = zoom > 1.05 ? zoom.toFixed(1).replace(".", ",") + "x" : "";
      passoTxt();
    }
    function mostrarLupa(q, sx) {
      lupa.hidden = false;
      lupa.style.left = (sx < pw / 2 ? pw - 130 : 10) + "px";
      var z = 4 / dpr * Math.max(1, S()), r = 120 / z;   // região da foto mostrada
      lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, 240, 240);
      lctx.save(); lctx.beginPath(); lctx.arc(120, 120, 118, 0, 7); lctx.clip();
      lctx.fillStyle = "#000"; lctx.fillRect(0, 0, 240, 240);
      lctx.drawImage(img, q[0] - r, q[1] - r, 2 * r, 2 * r, 0, 0, 240, 240);
      lctx.restore();
      lctx.strokeStyle = "#F2C230"; lctx.lineWidth = 3; lctx.beginPath(); lctx.arc(120, 120, 117, 0, 7); lctx.stroke();
      lctx.strokeStyle = "#ff2d55"; lctx.lineWidth = 2; lctx.beginPath(); lctx.moveTo(120, 96); lctx.lineTo(120, 144); lctx.moveTo(96, 120); lctx.lineTo(144, 120); lctx.stroke();
    }
    function calcular() {
      res = null;
      var ok = ov.querySelector(".mc-ok"), box = ov.querySelector(".mc-res");
      if (pts.length < 2) { ok.disabled = true; desenhar(); return; }
      res = medirEntre(img, [pts[0][0] / W, pts[0][1] / H], [pts[1][0] / W, pts[1][1] / H]);
      if (!res || res.qualidade < 0.12 || res.razao < 7.5 || res.razao > 55) {
        ok.disabled = true;
        box.innerHTML = "⚠️ Não achei os filetes entre os dois toques. Toque bem <b>na ponta dos filetes</b>, um de cada lado da rosca (use o <b>+</b> para aumentar a foto).";
        if (res && res.qualidade < 0.12) res = null;
      } else {
        ok.disabled = false;
        box.innerHTML = "Proporção <b>" + String(res.razao.toFixed(1)).replace(".", ",") + "</b>" + (opts.previa ? " → " + opts.previa(res.razao) : "");
      }
      desenhar();
    }
    function ponto(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener("pointerdown", function (e) {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      var s = ponto(e);
      arrastando = -1;
      pts.forEach(function (q, i) { var t = tela(q); if (Math.hypot(t[0] - s[0], t[1] - s[1]) < 30) arrastando = i; });
      if (arrastando < 0 && pts.length < 2) { pts.push(foto(s[0], s[1])); arrastando = pts.length - 1; }
      apertado = s;
      if (arrastando >= 0) { mostrarLupa(pts[arrastando], s[0]); desenhar(); }
    });
    cv.addEventListener("pointermove", function (e) {
      if (arrastando < 0 || !apertado) return;
      var s = ponto(e), q = foto(s[0], s[1]);
      pts[arrastando] = [Math.min(W, Math.max(0, q[0])), Math.min(H, Math.max(0, q[1]))];
      res = null; mostrarLupa(pts[arrastando], s[0]); desenhar();
    });
    function soltar() {
      if (!apertado) return;
      apertado = null; lupa.hidden = true;
      if (arrastando >= 0 && zoom > 1) { foco = pts[arrastando].slice(); limitar(); }
      if (pts.length === 1 && zoom === 1 && base * W < 900) { zoom = 2.2; foco = pts[0].slice(); limitar(); }
      arrastando = -1; calcular();
    }
    cv.addEventListener("pointerup", soltar); cv.addEventListener("pointercancel", soltar);
    ov.querySelector('[data-z="in"]').onclick = function () { zoom = Math.min(6, zoom * 1.6); if (pts.length) foco = pts.length === 2 ? [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2] : pts[0].slice(); limitar(); desenhar(); };
    ov.querySelector('[data-z="out"]').onclick = function () { zoom = Math.max(1, zoom / 1.6); limitar(); desenhar(); };
    ov.querySelector(".mc-limpar").onclick = function () { pts = []; res = null; ov.querySelector(".mc-ok").disabled = true;
      ov.querySelector(".mc-res").innerHTML = "Toque na <b>ponta dos filetes</b> de um lado da rosca e depois do outro lado."; desenhar(); };
    function fechar() { window.removeEventListener("resize", layout); ov.remove(); }
    ov.querySelector(".mc-x").onclick = function () { fechar(); if (opts.cancelar) opts.cancelar(); };
    ov.querySelector(".mc-ok").onclick = function () {
      if (!res) return;
      var r2 = res; fechar();
      var A = [pts[0][0] / W, pts[0][1] / H], B = [pts[1][0] / W, pts[1][1] / H];
      var u = r2.eixo, meia = r2.passo_px * 3 / r2.W;
      opts.pronto({ razao: +r2.razao.toFixed(2), diametro_px: r2.diametro_px, passo_px: r2.passo_px, ajustada: true, toques: true,
        certeza: r2.qualidade >= 0.35 ? 88 : 72, tem_referencia: false,
        pontos: { diam_a: A, diam_b: B, fil_ini: [r2.centro[0] - u[0] * meia, r2.centro[1] - u[1] * meia * r2.W / r2.H],
          fil_fim: [r2.centro[0] + u[0] * meia, r2.centro[1] + u[1] * meia * r2.W / r2.H], n_intervalos: 6 } });
    };
    ov._tela = function (q) { var t = tela(q), r = cv.getBoundingClientRect(); return [t[0] + r.left, t[1] + r.top]; };   // usado nos testes
    window.addEventListener("resize", layout);
    requestAnimationFrame(layout);
    return { fechar: fechar };
  }

  raiz.RoscaLocal = { nitidez: nitidez, passo: passo, ajustarPontos: ajustarPontos, medirEntre: medirEntre, marcar: marcar };
})(this);
