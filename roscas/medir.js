/* Rosca Fácil by DayIA · ferramentas de precisão
   1) Editor: ajustar a medida na foto com o dedo (marcadores + lupa + pente virtual)
   2) Pente na tela: filetes em tamanho real para encostar a peça (com calibração da tela) */
(function (raiz) {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function fmt(n, c) { return Number(n).toFixed(c === undefined ? 1 : c).replace(".", ","); }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  /* Telas cheias (ajuste, calibrar, pente) entram no histórico do navegador:
     o gesto/botão "voltar" do celular fecha a tela de cima em vez de sair do app. */
  var pilha = [], ignorarVolta = 0;
  function empilhar(fecharReal) {
    pilha.push(fecharReal);
    try { history.pushState({ rf: pilha.length }, ""); } catch (e) {}
  }
  function desempilhar(fecharReal) {
    var i = pilha.indexOf(fecharReal);
    if (i < 0) return;
    pilha.splice(i, 1);
    ignorarVolta++;
    try { history.back(); } catch (e) { ignorarVolta--; }
  }
  window.addEventListener("popstate", function () {
    if (ignorarVolta > 0) { ignorarVolta--; return; }
    var f = pilha.pop();
    if (f) { f(true); return; }
    if (raiz.Medir && typeof raiz.Medir.aoVoltar === "function") raiz.Medir.aoVoltar();
  });
  function depoisDeFechar(fn) { setTimeout(fn, 120); }
  var reduzMov = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =================================================================
     1) EDITOR DE MEDIDA NA FOTO
     ================================================================= */
  var REFS = { nenhuma: 0, cartao_maior: 85.6, cartao_menor: 53.98, outra: 0 };

  function abrirEditor(opts) {
    // opts: {img: HTMLImageElement, pontos?: {...normalizados}, nIntervalos?, previa: fn(medida)->texto, pronto: fn(medida)}
    var img = opts.img, W = img.naturalWidth, H = img.naturalHeight;
    var P = opts.pontos || {};
    function pt(v, dx, dy) { return v && v.length === 2 && v[0] >= 0 && v[0] <= 1 && v[1] >= 0 && v[1] <= 1 ? [v[0] * W, v[1] * H] : [W * dx, H * dy]; }
    var h = {
      a: pt(P.diam_a, 0.38, 0.5), b: pt(P.diam_b, 0.62, 0.5),
      c: pt(P.fil_ini, 0.5, 0.35), d: pt(P.fil_fim, 0.5, 0.62),
      r1: pt(P.ref_a, 0.2, 0.15), r2: pt(P.ref_b, 0.8, 0.15)
    };
    var n = Math.max(1, Math.min(40, Math.round(Number(P.n_intervalos) || 6)));
    var ref = P.ref_a && P.ref_b ? (P.ref_tipo && REFS[P.ref_tipo] !== undefined ? P.ref_tipo : "cartao_maior") : "nenhuma";
    var refOutra = 0;

    var ov = document.createElement("div");
    ov.className = "editor";
    ov.innerHTML =
      '<div class="ed-topo"><button type="button" class="ed-x" aria-label="Fechar">✕</button><b>Ajustar na foto</b><span></span></div>' +
      '<div class="ed-palco"><canvas class="ed-foto"></canvas><canvas class="ed-lupa" width="240" height="240"></canvas>' +
      '<div class="ed-zoom"><button type="button" data-z="in" aria-label="Aumentar a foto">+</button><button type="button" data-z="out" aria-label="Diminuir a foto">−</button>' +
      '<button type="button" data-z="trazer" aria-label="Trazer os marcadores para cá">📍</button><button type="button" data-z="rosca" aria-label="Ir para os marcadores">🎯</button><button type="button" data-z="tudo" aria-label="Ver a foto inteira">⤢</button><button type="button" data-z="trava" class="ed-trava" aria-label="Foto travada: toque para soltar">🔒</button></div>' +
      '<div class="ed-zoom-tag" aria-live="polite"></div></div>' +
      '<div class="ed-painel">' +
      '<button type="button" class="btn ed-auto">🔩 Encaixar o pente de rosca</button>' +
      '<div class="ed-auto-msg" aria-live="polite"></div>' +
      '<p class="ed-dica">O app testa as lâminas do pente nos filetes e encaixa a que serve. Se precisar: <b>dois dedos</b> aumentam a foto, ' +
      '<span class="bol am"></span><b>amarelas</b> nas bordas da rosca, e o pente se arrasta pelo botão ✥.</p>' +
      '<div class="ed-linha"><span>Dentes do pente</span><div class="ed-n"><button type="button" data-n="-1" aria-label="Menos">−</button><output>' + n + '</output><button type="button" data-n="1" aria-label="Mais">+</button></div></div>' +
      '<div class="ed-linha"><span>Referência na foto</span><select aria-label="Referência na foto">' +
      '<option value="nenhuma">Nenhuma</option><option value="cartao_maior">Cartão · lado maior</option>' +
      '<option value="cartao_menor">Cartão · lado menor</option><option value="outra">Outra medida…</option></select></div>' +
      '<div class="ed-ref-dica" hidden><span class="bol vd"></span>Arraste as <b>verdes</b> até as pontas da referência.</div>' +
      '<div class="ed-previa" aria-live="polite"></div>' +
      '<div class="ed-acoes"><button type="button" class="btn sec ed-cancelar">Cancelar</button><button type="button" class="btn ed-ok">Usar esta medida</button></div>' +
      "</div>";
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    var palco = $(".ed-palco", ov);
    var cv = $(".ed-foto", ov), ctx = cv.getContext("2d");
    var lupa = $(".ed-lupa", ov), lctx = lupa.getContext("2d");
    var sel = $("select", ov); sel.value = ref;
    var dpr = window.devicePixelRatio || 1;
    // vista: tela = ponto_da_foto * S + (tx, ty);  S = base * zoom
    var base = 1, zoom = 1, tx = 0, ty = 0, pw = 0, ph = 0, ZMAX = 12;
    var dedos = {}, arrastando = null, pinca = null, pan = null;
    var lamina = null; // lâmina do pente que o app encaixou (rótulo, fios, ângulo)

    function S() { return base * zoom; }
    function tela(p) { return [p[0] * S() + tx, p[1] * S() + ty]; }
    function foto(sx, sy) { return [(sx - tx) / S(), (sy - ty) / S()]; }
    function mostraZoom() { $(".ed-zoom-tag", ov).textContent = zoom > 1.05 ? zoom.toFixed(1).replace(".", ",") + "x" : ""; }
    function limitar() {
      // não deixa a foto sumir da tela
      var w = W * S(), hh = H * S(), m = 60;
      tx = w < pw ? (pw - w) / 2 : Math.min(m, Math.max(pw - w - m, tx));
      ty = hh < ph ? (ph - hh) / 2 : Math.min(m, Math.max(ph - hh - m, ty));
    }
    function zoomEm(novo, sx, sy) {
      novo = Math.max(1, Math.min(ZMAX, novo));
      var p = foto(sx, sy);
      zoom = novo;
      tx = sx - p[0] * S(); ty = sy - p[1] * S();
      limitar(); desenhar(); mostraZoom();
    }
    function enquadrar(pts, folga) {
      var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var bw = Math.max(40, x1 - x0) * folga, bh = Math.max(40, y1 - y0) * folga;
      zoom = Math.max(1, Math.min(ZMAX, Math.min(pw / bw, ph / bh) / base));
      tx = pw / 2 - (x0 + x1) / 2 * S(); ty = ph / 2 - (y0 + y1) / 2 * S();
      limitar(); desenhar(); mostraZoom();
    }
    function irRosca() { enquadrar([h.a, h.b, h.c, h.d], 1.8); }
    function visivel(p) { var q = tela(p); return q[0] >= 0 && q[0] <= pw && q[1] >= 0 && q[1] <= ph; }
    // coloca os marcadores no meio do que está aparecendo (útil depois de aumentar a foto)
    function trazer() {
      var c = foto(pw / 2, ph / 2), lx = pw * 0.22 / S(), ly = ph * 0.2 / S();
      h.a = [c[0] - lx, c[1]]; h.b = [c[0] + lx, c[1]];
      h.c = [c[0] + lx * 0.25, c[1] - ly]; h.d = [c[0] + lx * 0.25, c[1] + ly];
      desenhar();
    }
    function trazerSeSumiram() { if (![h.a, h.b, h.c, h.d].some(visivel)) trazer(); }
    function layout() {
      pw = palco.clientWidth; ph = palco.clientHeight;
      cv.style.width = pw + "px"; cv.style.height = ph + "px";
      cv.width = Math.round(pw * dpr); cv.height = Math.round(ph * dpr);
      base = Math.min(pw / W, ph / H);
      limitar(); desenhar();
    }
    function medida() {
      var dpx = dist(h.a, h.b), passoPx = dist(h.c, h.d) / n;
      var m = { razao: passoPx > 0 ? dpx / passoPx : 0, diametro_px: dpx, passo_px: passoPx, ajustada: true, certeza: 90, tem_referencia: false,
        pente_auto: lamina ? lamina.texto : "" };
      var mmRef = ref === "outra" ? refOutra : REFS[ref];
      if (mmRef > 0) {
        var k = mmRef / dist(h.r1, h.r2);
        m.tem_referencia = true; m.diametro_mm = dpx * k; m.passo_mm = passoPx * k;
      }
      return m;
    }
    function meioCD() { return [(h.c[0] + h.d[0]) / 2, (h.c[1] + h.d[1]) / 2]; }
    function meioAB() { return [(h.a[0] + h.b[0]) / 2, (h.a[1] + h.b[1]) / 2]; }
    // puxador: arrasta o par inteiro (pente ou diâmetro) sem mudar tamanho nem inclinação
    var PARES = { m: ["c", "d"], ma: ["a", "b"] };
    function centro(k) { return k === "m" ? meioCD() : k === "ma" ? meioAB() : h[k]; }
    function bolinha(p, cor, rot) {
      var s = tela(p);
      ctx.beginPath(); ctx.arc(s[0], s[1], 13, 0, 7); ctx.fillStyle = cor; ctx.globalAlpha = .3; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(s[0], s[1], 4, 0, 7); ctx.fillStyle = cor; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
      if (rot) { ctx.font = "700 11px Archivo, sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.strokeText(rot, s[0] + 15, s[1] - 10); ctx.fillStyle = "#fff"; ctx.fillText(rot, s[0] + 15, s[1] - 10); }
    }
    function puxador(p, cor) {
      // botão de mover (setas nas 4 direções), sempre do mesmo tamanho na tela
      var s = tela(p), r = 13, x = s[0], y = s[1];
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 6;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - r, y - r, 2 * r, 2 * r, 7); else ctx.rect(x - r, y - r, 2 * r, 2 * r);
      ctx.fillStyle = cor; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (d) {
        var ax = x + d[0] * 8, ay = y + d[1] * 8;
        ctx.beginPath(); ctx.moveTo(ax, ay);
        ctx.lineTo(ax - d[0] * 3.5 - d[1] * 3, ay - d[1] * 3.5 - d[0] * 3);
        ctx.lineTo(ax - d[0] * 3.5 + d[1] * 3, ay - d[1] * 3.5 + d[0] * 3);
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    }
    function linha(p, q, cor, w) { var s = tela(p), t = tela(q); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(t[0], t[1]); ctx.strokeStyle = cor; ctx.lineWidth = w || 2; ctx.stroke(); }
    function desenhar() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0B1B2C"; ctx.fillRect(0, 0, pw, ph);
      ctx.imageSmoothingEnabled = zoom < 4;
      ctx.drawImage(img, tx, ty, W * S(), H * S());
      desenharLamina();
      linha(h.c, h.d, "rgba(43,140,232,.45)", 1);
      linha(h.a, h.b, "rgba(0,0,0,.5)", 4); linha(h.a, h.b, "#F2C230", 2);
      bolinha(h.a, "#F2C230"); bolinha(h.b, "#F2C230", "diâmetro");
      bolinha(h.c, "#2B8CE8"); bolinha(h.d, "#2B8CE8");
      puxador(meioCD(), "#2B8CE8"); puxador(meioAB(), "#C99A0E");
      if (sel.value !== "nenhuma") { linha(h.r1, h.r2, "#1F8A5B", 2.5); bolinha(h.r1, "#1F8A5B"); bolinha(h.r2, "#1F8A5B", "referência"); }
      var m = medida(), txt = opts.previa ? opts.previa(m) : "";
      $(".ed-previa", ov).innerHTML = "Proporção <b>" + fmt(m.razao) + "</b>" + (m.tem_referencia ? " · diâmetro <b>" + fmt(m.diametro_mm) + " mm</b>" : "") + (txt ? " → " + txt : "");
    }
    /* Lâmina de pente de rosca desenhada sobre a borda da rosca, com dentes no passo atual */
    function geoPente() {
      var vx = h.d[0] - h.c[0], vy = h.d[1] - h.c[1], len = Math.hypot(vx, vy) || 1;
      var ux = vx / len, uy = vy / len, qx = -uy, qy = ux;
      var sa = (h.a[0] - h.c[0]) * qx + (h.a[1] - h.c[1]) * qy;      // borda amarela "a" em relação ao eixo
      var lado = sa >= 0 ? 1 : -1, borda = Math.abs(sa);
      var pp = len / n, dente = pp * 0.62, corpo = Math.max(pp * 2.2, 16 / S());
      return { len: len, ux: ux, uy: uy, qx: qx * lado, qy: qy * lado, borda: borda, pp: pp, dente: dente, corpo: corpo };
    }
    function PL(g, t, o) { return [h.c[0] + g.ux * t + g.qx * o, h.c[1] + g.uy * t + g.qy * o]; }
    function desenharLamina() {
      var g = geoPente(), pts = [];
      var base = g.borda + g.dente * 0.15, ponta = g.borda - g.dente * 0.85, fora = base + g.corpo;
      var t0 = -g.pp * 0.5, t1 = g.len + g.pp * 0.5;
      pts.push(PL(g, t0, fora)); pts.push(PL(g, t0, base));
      for (var k = 0; k <= n; k++) {
        var t = k * g.pp;
        pts.push(PL(g, t - g.pp / 2, base)); pts.push(PL(g, t, ponta)); pts.push(PL(g, t + g.pp / 2, base));
      }
      pts.push(PL(g, t1, base)); pts.push(PL(g, t1, fora));
      ctx.save();
      ctx.beginPath();
      pts.forEach(function (q, i) { var s2 = tela(q); if (i) ctx.lineTo(s2[0], s2[1]); else ctx.moveTo(s2[0], s2[1]); });
      ctx.closePath();
      var a1 = tela(PL(g, 0, ponta)), a2 = tela(PL(g, 0, fora));
      var gr = ctx.createLinearGradient(a1[0], a1[1], a2[0], a2[1]);
      gr.addColorStop(0, "rgba(236,241,246,.92)"); gr.addColorStop(.5, "rgba(190,200,210,.9)"); gr.addColorStop(1, "rgba(150,162,176,.9)");
      ctx.fillStyle = gr; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = lamina ? "rgba(31,138,91,.95)" : "rgba(40,50,62,.9)"; ctx.stroke();
      // texto gravado na lâmina
      var meioT = tela(PL(g, g.len / 2, base + g.corpo * 0.55)), ang = Math.atan2(g.uy, g.ux);
      if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      var fs = Math.max(10, Math.min(15, g.corpo * S() * 0.42));
      ctx.translate(meioT[0], meioT[1]); ctx.rotate(ang);
      ctx.font = "800 " + fs + "px Archivo, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(40,50,62,.85)";
      ctx.fillText(lamina ? lamina.texto : (n + " dentes"), 0, 0);
      ctx.restore();
    }

    /* ---- Pente automático: mede o passo dos filetes na própria imagem e encaixa a lâmina que serve ---- */
    var dadosImg = null;
    function pixels() {
      if (dadosImg) return dadosImg;
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      var cx = c.getContext("2d"); cx.drawImage(img, 0, 0);
      try { dadosImg = cx.getImageData(0, 0, W, H).data; } catch (e) { dadosImg = null; }
      c.width = c.height = 0;
      return dadosImg;
    }
    function brilho(x, y) {
      var d = pixels(); x = Math.round(x); y = Math.round(y);
      if (!d || x < 0 || y < 0 || x >= W || y >= H) return NaN;
      var i = (y * W + x) * 4; return 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    }
    // perfil de brilho ao longo do eixo (média numa faixa no meio da rosca)
    function perfil(ini, ux, uy, comp, larg) {
      var qx = -uy, qy = ux, out = [];
      for (var t = 0; t < comp; t++) {
        var soma = 0, cont = 0;
        for (var o = -larg; o <= larg; o += Math.max(1, larg / 8)) {
          var v = brilho(ini[0] + ux * t + qx * o, ini[1] + uy * t + qy * o);
          if (!isNaN(v)) { soma += v; cont++; }
        }
        out.push(cont ? soma / cont : 0);
      }
      return out;
    }
    function semTendencia(v, jan) {
      var out = [], acc = 0, q = [];
      for (var i = 0; i < v.length; i++) {
        var a = Math.max(0, i - jan), b = Math.min(v.length - 1, i + jan), s2 = 0;
        for (var k = a; k <= b; k++) s2 += v[k];
        out.push(v[i] - s2 / (b - a + 1));
      }
      return out;
    }
    function medirPasso() {
      var g = geoPente(), D = dist(h.a, h.b);
      // mede num trecho longo da rosca (mais filetes = passo mais preciso), centrado no pente
      var comp = Math.round(Math.max(g.len * 1.3, D * 1.4)), t0 = g.len / 2 - comp / 2, ini = PL(g, t0, 0);
      if (comp < 30) return null;
      // tira a variação lenta de brilho (reflexos) mantendo só a "ondinha" dos filetes (passo nunca passa de D/8)
      var v = semTendencia(perfil(ini, g.ux, g.uy, comp, Math.max(3, D * 0.18)), Math.max(4, Math.round(D / 10)));
      var ac0 = 0; v.forEach(function (x) { ac0 += x * x; });
      if (!ac0) return null;
      var melhor = 0, lagM = 0, minLag = 3, maxLag = Math.round(comp / 2.5);
      var ac = [];
      for (var lag = 0; lag <= maxLag; lag++) {
        var s2 = 0; for (var i = 0; i + lag < v.length; i++) s2 += v[i] * v[i + lag];
        ac.push(s2 / ac0);
      }
      // primeiro vale, depois o maior pico
      var z = minLag; while (z < maxLag && ac[z] > 0) z++;
      for (var L2 = z; L2 < maxLag; L2++) if (ac[L2] > melhor && ac[L2] >= ac[L2 - 1] && ac[L2] >= ac[L2 + 1]) { melhor = ac[L2]; lagM = L2; }
      if (!lagM) return null;
      var y0 = ac[lagM - 1], y1 = ac[lagM], y2 = ac[lagM + 1], den = y0 - 2 * y1 + y2;
      var fino = lagM + (den ? 0.5 * (y0 - y2) / den : 0);
      return { passo: fino, qualidade: melhor, perfil: v, ini: t0 };
    }
    function encaixarPente(silencioso) {
      var msg = $(".ed-auto-msg", ov), D = dist(h.a, h.b);
      var r = medirPasso();
      if (!r || r.qualidade < 0.12 || !opts.laminas) {
        lamina = null; desenhar();
        if (!silencioso) msg.innerHTML = "⚠️ Não consegui ver os filetes direito aqui. Coloque as <b>amarelas</b> nas bordas da rosca e o pente em cima dos filetes, ou aproxime a foto.";
        return false;
      }
      // compara com as lâminas reais (passo de cada rosca da tabela), aceitando o dobro/metade do passo medido
      var cand = opts.laminas(), melhor = null, est = Number(opts.estimado) || 0;
      cand.forEach(function (l) {
        var pp = D / l.razao, prior = est > 0 ? 0.25 * Math.abs(Math.log(est / l.diametro)) : 0;
        [[1, 0], [2, 0.1], [0.5, 0.1]].forEach(function (hx) {
          var e = Math.abs(r.passo * hx[0] - pp) / pp + hx[1] + prior;
          if (!melhor || e < melhor.e) melhor = { l: l, pp: pp, e: e };
        });
      });
      if (!melhor || melhor.e > 0.3) {
        lamina = null; desenhar();
        if (!silencioso) msg.innerHTML = "⚠️ Nenhuma lâmina encaixou bem. Confira as <b>amarelas</b> nas bordas da rosca.";
        return false;
      }
      // ajusta o pente: número de dentes e posição (fase) para os dentes caírem nos filetes
      var g = geoPente(), pp = melhor.pp, nn = Math.max(3, Math.round(g.len / pp));
      var melhorF = 0, melhorS = -Infinity;
      for (var f = 0; f < pp; f += Math.max(0.5, pp / 16)) {
        var soma = 0;
        for (var k = 0; k <= nn; k++) { var idx = Math.round(f + k * pp - r.ini); if (idx >= 0 && idx < r.perfil.length) soma += r.perfil[idx]; }
        if (soma > melhorS) { melhorS = soma; melhorF = f; }
      }
      var desloc = melhorF > pp / 2 ? melhorF - pp : melhorF;
      var novoC = [h.c[0] + g.ux * desloc, h.c[1] + g.uy * desloc];
      h.c = novoC; h.d = [novoC[0] + g.ux * nn * pp, novoC[1] + g.uy * nn * pp];
      n = nn; $("output", ov).textContent = n;
      var l = melhor.l;
      // a foto mostra o passo, não o ângulo: a lâmina mostra os passos das normas daquele tamanho (ex.: 19/18 fios)
      var fios = [];
      cand.forEach(function (x) { if (x.grupo === l.grupo) { var t = l.familia === "metrica" ? String(x.passo).replace(".", ",") : String(x.tpi).replace(".", ","); if (fios.indexOf(t) < 0) fios.push(t); } });
      lamina = { texto: fios.join("/") + (l.familia === "metrica" ? " mm" : " fios"), rotulo: l.rotulo };
      msg.innerHTML = "✅ Encaixou a lâmina de <b>" + lamina.texto + "</b> → <b>" + l.rotulo + "</b>";
      desenhar(); salvarRascunho();
      return true;
    }

    function lupaEm(p) {
      var L = 240, z = Math.max(2.5, 6 / zoom), s = L / z / S(); // região da foto mostrada na lupa
      lctx.clearRect(0, 0, L, L);
      lctx.save(); lctx.beginPath(); lctx.arc(L / 2, L / 2, L / 2 - 2, 0, 7); lctx.clip();
      lctx.fillStyle = "#000"; lctx.fillRect(0, 0, L, L);
      lctx.drawImage(img, p[0] - s / 2, p[1] - s / 2, s, s, 0, 0, L, L);
      lctx.restore();
      lctx.strokeStyle = "#F2C230"; lctx.lineWidth = 2;
      lctx.beginPath(); lctx.moveTo(L / 2 - 16, L / 2); lctx.lineTo(L / 2 + 16, L / 2); lctx.moveTo(L / 2, L / 2 - 16); lctx.lineTo(L / 2, L / 2 + 16); lctx.stroke();
      lctx.beginPath(); lctx.arc(L / 2, L / 2, L / 2 - 2, 0, 7); lctx.lineWidth = 4; lctx.strokeStyle = "#fff"; lctx.stroke();
      var sx = tela(p)[0];
      lupa.style.left = (sx < pw / 2 ? pw - 140 : 20) + "px";
      lupa.hidden = false;
    }
    function ponto(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    // distância (na tela) de um ponto até um segmento
    function distSeg(s, p, q) {
      var a = tela(p), b = tela(q), vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
      var t = L ? Math.max(0, Math.min(1, ((s[0] - a[0]) * vx + (s[1] - a[1]) * vy) / L)) : 0;
      return Math.hypot(s[0] - (a[0] + vx * t), s[1] - (a[1] + vy * t));
    }
    // o dedo está em cima do pente (qualquer tracinho azul ou entre eles)?
    function noPente(s) {
      var vx = h.d[0] - h.c[0], vy = h.d[1] - h.c[1], len = Math.hypot(vx, vy) || 1;
      var px = -vy / len, py = vx / len, meio = Math.max(dist(h.a, h.b) * 0.55, 12 / S());
      var f = foto(s[0], s[1]), rx = f[0] - h.c[0], ry = f[1] - h.c[1];
      var ao = (rx * vx + ry * vy) / len, lado = Math.abs(rx * px + ry * py), folga = 14 / S();
      var g = geoPente();
      return ao >= -folga - g.pp && ao <= len + folga + g.pp && lado <= Math.max(meio, g.borda + g.corpo + g.dente) + folga;
    }
    function alvoEm(s) {
      // 1) bolinhas e puxadores (área de toque grande)
      var melhor = null, md = 38;
      var chaves = ["a", "b", "c", "d", "m", "ma"].concat(sel.value !== "nenhuma" ? ["r1", "r2"] : []);
      chaves.forEach(function (k) {
        var q = tela(centro(k)), dd = Math.hypot(q[0] - s[0], q[1] - s[1]);
        if (dd < md) { md = dd; melhor = k; }
      });
      if (melhor) return melhor;
      // 2) linha amarela inteira → move o diâmetro; 3) pente inteiro → move o pente
      if (distSeg(s, h.a, h.b) < 22) return "ma";
      if (noPente(s)) return "m";
      if (sel.value !== "nenhuma" && distSeg(s, h.r1, h.r2) < 22) return null;
      return null;
    }
    ov._estado = function () { return { h: JSON.parse(JSON.stringify(h)), tx: tx, ty: ty, zoom: zoom }; }; // usado nos testes
    var travada = true; // foto travada: um dedo só ajusta; dois dedos aumentam e movem a foto
    cv.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      dedos[e.pointerId] = ponto(e);
      var ids = Object.keys(dedos);
      if (ids.length === 2) {
        // dois dedos: pinça para aumentar/diminuir (cancela o arraste)
        arrastando = null; pan = null; lupa.hidden = true;
        var a = dedos[ids[0]], b = dedos[ids[1]];
        pinca = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: zoom, c: foto((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
        return;
      }
      if (ids.length > 2) return;
      var s = dedos[e.pointerId], k = alvoEm(s);
      if (k) {
        var f = foto(s[0], s[1]), base0 = centro(k);
        arrastando = { k: k, dx: base0[0] - f[0], dy: base0[1] - f[1] };
        lupaEm(base0);
      } else {
        if (!travada) pan = { x: s[0], y: s[1], tx: tx, ty: ty };
        else pan = { x: s[0], y: s[1], tx: tx, ty: ty, parado: true }; // só para o toque duplo
      }
    });
    cv.addEventListener("pointermove", function (e) {
      if (!dedos[e.pointerId]) return;
      dedos[e.pointerId] = ponto(e);
      var ids = Object.keys(dedos);
      if (pinca && ids.length >= 2) {
        var a = dedos[ids[0]], b = dedos[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        zoom = Math.max(1, Math.min(ZMAX, pinca.z * d / pinca.d));
        tx = mx - pinca.c[0] * S(); ty = my - pinca.c[1] * S();
        limitar(); desenhar(); mostraZoom();
        return;
      }
      var s = dedos[e.pointerId];
      if (arrastando) {
        var f = foto(s[0], s[1]), nx = Math.max(0, Math.min(W, f[0] + arrastando.dx)), ny = Math.max(0, Math.min(H, f[1] + arrastando.dy));
        if (PARES[arrastando.k]) {
          var par = PARES[arrastando.k], m0 = centro(arrastando.k), ddx = nx - m0[0], ddy = ny - m0[1];
          h[par[0]] = [h[par[0]][0] + ddx, h[par[0]][1] + ddy]; h[par[1]] = [h[par[1]][0] + ddx, h[par[1]][1] + ddy];
          desenhar(); lupaEm(h[par[0]]);
        } else {
          h[arrastando.k] = [nx, ny];
          desenhar(); lupaEm(h[arrastando.k]);
        }
      } else if (pan && !pan.parado) {
        tx = pan.tx + s[0] - pan.x; ty = pan.ty + s[1] - pan.y;
        limitar(); desenhar();
      }
    });
    var ultimoToque = 0;
    function solta(e) {
      var s = dedos[e.pointerId], eraPan = pan && s && Math.hypot(s[0] - pan.x, s[1] - pan.y) < 8;
      delete dedos[e.pointerId];
      if (pinca && Object.keys(dedos).length < 2) { pinca = null; trazerSeSumiram(); }
      if (!Object.keys(dedos).length) {
        if (arrastando) { if (arrastando.k !== "m" && arrastando.k !== "ma") { lamina = null; $(".ed-auto-msg", ov).innerHTML = ""; } salvarRascunho(); desenhar(); }
        arrastando = null; pan = null; lupa.hidden = true;
      }
      // toque duplo na foto (fora das bolinhas): aumenta 2x ali, ou volta se já estiver bem perto
      if (e.type === "pointerup" && eraPan) {
        var agora = Date.now();
        if (agora - ultimoToque < 320) { zoomEm(zoom >= ZMAX * 0.7 ? 1 : zoom * 2, s[0], s[1]); ultimoToque = 0; }
        else ultimoToque = agora;
      }
    }
    cv.addEventListener("pointerup", solta); cv.addEventListener("pointercancel", solta);
    cv.addEventListener("wheel", function (e) { e.preventDefault(); var s = ponto(e); zoomEm(zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), s[0], s[1]); }, { passive: false });
    lupa.hidden = true;

    ov.querySelectorAll("[data-z]").forEach(function (b) {
      b.onclick = function () {
        var z = b.dataset.z;
        if (z === "in") { zoomEm(zoom * 1.6, pw / 2, ph / 2); trazerSeSumiram(); }
        else if (z === "out") zoomEm(zoom / 1.6, pw / 2, ph / 2);
        else if (z === "rosca") irRosca();
        else if (z === "trazer") trazer();
        else if (z === "trava") {
          travada = !travada;
          b.textContent = travada ? "🔒" : "🔓";
          b.setAttribute("aria-label", travada ? "Foto travada: toque para soltar" : "Foto solta: toque para travar");
          var dica = $(".ed-zoom-tag", ov); dica.textContent = travada ? "Foto travada" : "Foto solta: um dedo arrasta a foto";
          setTimeout(mostraZoom, 1600);
        }
        else { zoom = 1; limitar(); desenhar(); mostraZoom(); }
      };
    });
    $(".ed-auto", ov).onclick = function () { encaixarPente(false); };
    ov.querySelectorAll("[data-n]").forEach(function (b) {
      b.onclick = function () { n = Math.max(1, Math.min(40, n + Number(b.dataset.n))); $("output", ov).textContent = n; lamina = null; $(".ed-auto-msg", ov).innerHTML = ""; desenhar(); };
    });
    sel.onchange = function () {
      if (sel.value === "outra") {
        var v = parseFloat(String(prompt("Quanto mede a referência, em mm?", refOutra || "") || "").replace(",", "."));
        if (v > 0) refOutra = v; else sel.value = "nenhuma";
      }
      ref = sel.value;
      $(".ed-ref-dica", ov).hidden = sel.value === "nenhuma";
      desenhar();
    };
    $(".ed-ref-dica", ov).hidden = sel.value === "nenhuma";
    function fechar(viaVoltar) {
      if (!ov.parentNode) return;
      salvarRascunho();
      window.removeEventListener("resize", layout); ov.remove(); document.body.style.overflow = "";
      if (viaVoltar !== true) desempilhar(fechar);
    }
    function normal(p) { return [+(p[0] / W).toFixed(4), +(p[1] / H).toFixed(4)]; }
    function salvarRascunho() {
      if (!opts.salvar) return;
      opts.salvar({ diam_a: normal(h.a), diam_b: normal(h.b), fil_ini: normal(h.c), fil_fim: normal(h.d), n_intervalos: n,
        ref_a: sel.value !== "nenhuma" ? normal(h.r1) : null, ref_b: sel.value !== "nenhuma" ? normal(h.r2) : null, ref_tipo: sel.value });
    }
    empilhar(fechar);
    $(".ed-x", ov).onclick = fechar; $(".ed-cancelar", ov).onclick = fechar;
    $(".ed-ok", ov).onclick = function () {
      var m = medida();
      var possivel = m.tem_referencia || (m.razao >= 7.5 && m.razao <= 55);
      if (!possivel) {
        var pv = $(".ed-previa", ov);
        pv.innerHTML = "⚠️ Essa marcação não bate com nenhuma rosca. Confira: <b>amarelas</b> nas duas bordas da rosca e <b>azuis</b> em cima dos picos dos filetes, com o número certo de filetes entre elas.";
        pv.style.background = "var(--warnbg)"; pv.style.color = "var(--warn)";
        setTimeout(function () { pv.style.background = ""; pv.style.color = ""; desenhar(); }, 4500);
        return;
      }
      fechar(); opts.pronto(m);
    };
    window.addEventListener("resize", layout);
    requestAnimationFrame(function () {
      layout();
      if (opts.pontos) irRosca(); // a IA já marcou: abre aproximado na rosca
      if (opts.pontos && opts.autoPente !== false) setTimeout(function () { encaixarPente(false); }, 60);
    });
  }

  /* =================================================================
     2) PENTE DE ROSCA NA TELA
     ================================================================= */
  function pxPorMm() { var v = Number(lsGet("rf-pxmm")); return v > 0 ? v : 0; }

  function calibrar(depois) {
    var lado = Math.min(screen.width, screen.height);
    var k = pxPorMm() || (lado < 520 ? lado / 68 : 96 / 25.4); // ponto de partida: celular comum tem ~68 mm de largura
    var ov = document.createElement("div");
    ov.className = "editor calib";
    ov.innerHTML =
      '<div class="ed-topo"><button type="button" class="ed-x" aria-label="Fechar">✕</button><b>Calibrar a tela</b><span></span></div>' +
      '<div class="cal-palco"><div class="cal-cartao"><span>Encoste um cartão de banco aqui, em pé</span></div></div>' +
      '<div class="ed-painel"><p class="ed-dica">Faça só uma vez neste celular. Encoste um cartão de banco na tela, em pé, no canto de cima à esquerda, ' +
      'e aumente ou diminua até o retângulo ficar <b>do tamanho exato do cartão</b>.</p>' +
      '<div class="cal-ctrl"><button type="button" data-d="-1" aria-label="Diminuir">−</button><input type="range" min="2" max="12" step="0.01" aria-label="Tamanho"><button type="button" data-d="1" aria-label="Aumentar">+</button></div>' +
      '<div class="ed-acoes"><button type="button" class="btn sec ed-cancelar">Cancelar</button><button type="button" class="btn ed-ok">Pronto, está igual</button></div></div>';
    document.body.appendChild(ov); document.body.style.overflow = "hidden";
    var cartao = $(".cal-cartao", ov), rg = $("input", ov);
    function aplica() { cartao.style.width = 53.98 * k + "px"; cartao.style.height = 85.6 * k + "px"; rg.value = k; }
    rg.oninput = function () { k = Number(rg.value); aplica(); };
    ov.querySelectorAll("[data-d]").forEach(function (b) { b.onclick = function () { k = Math.max(2, Math.min(12, k + Number(b.dataset.d) * 0.02)); aplica(); }; });
    function fechar(viaVoltar) {
      if (!ov.parentNode) return;
      ov.remove(); document.body.style.overflow = "";
      if (viaVoltar !== true) desempilhar(fechar);
    }
    empilhar(fechar);
    $(".ed-x", ov).onclick = fechar; $(".ed-cancelar", ov).onclick = fechar;
    $(".ed-ok", ov).onclick = function () { lsSet("rf-pxmm", String(k)); fechar(); if (depois) depoisDeFechar(depois); };
    aplica();
  }

  /* desenha um pente (perfil de filete) vertical em tamanho real */
  function pente(canvas, l, k, cor) {
    var dpr = window.devicePixelRatio || 1, Hc = canvas.clientHeight, Wc = canvas.clientWidth;
    canvas.width = Math.round(Wc * dpr); canvas.height = Math.round(Hc * dpr);
    var c = canvas.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, Wc, Hc);
    var p = l.passo * k, prof = Math.min(Wc * 0.45, (l.angulo === 55 ? 0.6403 : 0.6134) * l.passo * k * 1.15);
    var base = Wc - 2;
    c.beginPath(); c.moveTo(base, 0);
    for (var y = 0; y <= Hc + p; y += p) { c.lineTo(base - prof, y + p / 2); c.lineTo(base, y + p); }
    c.lineTo(0, Hc); c.lineTo(0, 0); c.closePath();
    c.fillStyle = cor; c.fill();
    c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 1; c.stroke();
    // marcas de 1 polegada
    c.fillStyle = "rgba(255,255,255,.9)"; c.font = "700 10px Archivo, sans-serif";
    for (var i = 1; i * 25.4 * k < Hc; i++) { var yy = i * 25.4 * k; c.fillRect(0, yy - 1, Wc * 0.35, 2); c.fillText(i + "\"", 3, yy - 4); }
  }

  function abrirPente(candidatos, tipo) {
    // candidatos: lista de linhas (Roscas.linhas) em ordem; mostra o escolhido ao lado do rival
    if (!pxPorMm()) { calibrar(function () { abrirPente(candidatos, tipo); }); return; }
    if (!candidatos || !candidatos.length) return;
    var i = 0, k = pxPorMm();
    var ov = document.createElement("div");
    ov.className = "editor pente-tela";
    ov.innerHTML =
      '<div class="ed-topo"><button type="button" class="ed-x" aria-label="Fechar">✕</button><b>Pente na tela</b><button type="button" class="ed-cal">Calibrar</button></div>' +
      '<div class="pt-palco">' +
      '<div class="pt-col"><canvas class="pt-a"></canvas><div class="pt-rot a"></div></div>' +
      '<div class="pt-meio"><div class="pt-diam"><i></i><span></span></div><p>Encoste os filetes da peça nos dentes. O que encaixar sem "andar" ao longo do comprimento é a rosca certa.</p></div>' +
      '<div class="pt-col"><canvas class="pt-b"></canvas><div class="pt-rot b"></div></div>' +
      '</div>' +
      '<div class="ed-painel pt-painel"><button type="button" class="btn sec" data-i="-1">‹ Anterior</button><span class="pt-qual"></span><button type="button" class="btn sec" data-i="1">Próxima ›</button></div>';
    document.body.appendChild(ov); document.body.style.overflow = "hidden";
    function rival(l) {
      // outra rosca de tamanho parecido mas passo diferente (ex.: BSP 19 x NPT 18)
      var outros = candidatos.filter(function (x) { return x !== l && Math.abs(x.passo - l.passo) > 0.005; });
      outros.sort(function (a, b) { return Math.abs(a.diametro - l.diametro) - Math.abs(b.diametro - l.diametro); });
      return outros[0] || null;
    }
    function rot(l) { return "<b>" + l.rotulo + "</b> " + l.nome + "<br>" + fmt(l.tpi, l.tpi % 1 ? 1 : 0) + " fios/pol · passo " + fmt(l.passo, 2) + " mm · filete " + l.angulo + "°"; }
    function mostra() {
      var l = candidatos[i], r = rival(l);
      pente($(".pt-a", ov), l, k, "#2B6CB0");
      $(".pt-rot.a", ov).innerHTML = rot(l);
      if (r) { $(".pt-b", ov).hidden = false; pente($(".pt-b", ov), r, k, "#B7791F"); $(".pt-rot.b", ov).innerHTML = rot(r); }
      else { $(".pt-b", ov).hidden = true; $(".pt-rot.b", ov).innerHTML = ""; }
      var bar = $(".pt-diam i", ov); bar.style.width = l.diametro * k + "px";
      $(".pt-diam span", ov).textContent = (tipo === "femea" ? "furo " : "diâmetro ") + fmt(l.diametro, 1) + " mm";
      $(".pt-qual", ov).textContent = (i + 1) + " de " + candidatos.length;
    }
    ov.querySelectorAll("[data-i]").forEach(function (b) { b.onclick = function () { i = (i + Number(b.dataset.i) + candidatos.length) % candidatos.length; mostra(); }; });
    function fechar(viaVoltar) {
      if (!ov.parentNode) return;
      window.removeEventListener("resize", mostra); ov.remove(); document.body.style.overflow = "";
      if (viaVoltar !== true) desempilhar(fechar);
    }
    empilhar(fechar);
    $(".ed-x", ov).onclick = fechar;
    $(".ed-cal", ov).onclick = function () { fechar(); depoisDeFechar(function () { calibrar(function () { abrirPente(candidatos, tipo); }); }); };
    window.addEventListener("resize", mostra);
    requestAnimationFrame(mostra);
  }


  /* =================================================================
     3) CÂMERA DENTRO DO APP
     A câmera roda na própria página, então o celular não fecha o navegador
     por falta de memória (como acontece ao abrir o app de câmera).
     ================================================================= */
  function abrirCamera(opts) {
    var ov = document.createElement("div");
    ov.className = "editor camera";
    ov.innerHTML =
      '<div class="ed-topo"><button type="button" class="ed-x" aria-label="Fechar">✕</button><b>Foto da rosca</b><button type="button" class="cam-ext">Câmera do celular</button></div>' +
      '<div class="cam-palco"><video playsinline muted autoplay></video>' +
      '<div class="cam-dicas"><span>📏 <b>Bem perto:</b> a rosca enchendo a moldura</span><span>↔️ <b>De lado:</b> com os filetes aparecendo</span>' +
      '<span>💡 <b>Claro:</b> use a lanterna 🔦 se precisar</span><span>✋ <b>Parado:</b> espere ficar nítido</span></div>' +
      '<div class="cam-guia"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><span>Coloque a rosca aqui</span></div>' +
      '<div class="cam-msg"><p>Abrindo a câmera…</p><button type="button" class="btn cam-plan" hidden>📷 Abrir a câmera do celular</button></div>' +
      '<div class="cam-zoom" hidden><span>1x</span><input type="range" aria-label="Zoom da câmera"><span class="cam-zv"></span></div>' +
      '<div class="cam-flash"></div></div>' +
      '<div class="cam-barra"><div class="lado"><button type="button" class="cam-luz" hidden aria-pressed="false" aria-label="Lanterna">🔦</button></div>' +
      '<button type="button" class="cam-disparo" aria-label="Tirar foto" disabled></button>' +
      '<div class="lado"><button type="button" class="cam-virar" aria-label="Trocar câmera">🔄</button></div></div>';
    document.body.appendChild(ov); document.body.style.overflow = "hidden";
    var video = $("video", ov), msg = $(".cam-msg", ov), msgTxt = $(".cam-msg p", ov), plan = $(".cam-plan", ov), disparo = $(".cam-disparo", ov);
    var espera = null;
    // se a câmera do app não abrir, mostra um botão (o toque do dedo é necessário para abrir a câmera do celular)
    function planoB(texto) {
      clearTimeout(espera);
      msg.hidden = false; msgTxt.textContent = texto; plan.hidden = false; disparo.disabled = true;
    }
    plan.onclick = function () { fechar(); if (opts.externa) opts.externa(); };
    var stream = null, track = null, frente = false, luz = false;

    function parar() { clearTimeout(espera); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; track = null; }
    function fechar(viaVoltar) {
      if (!ov.parentNode) return;
      parar(); ov.remove(); document.body.style.overflow = "";
      if (viaVoltar !== true) desempilhar(fechar);
    }
    empilhar(fechar);

    function iniciar() {
      parar();
      msg.hidden = false; msgTxt.textContent = "Abrindo a câmera…"; plan.hidden = true; disparo.disabled = true;
      clearTimeout(espera);
      espera = setTimeout(function () { planoB("A câmera do app está demorando para abrir neste celular."); }, 7000);
      var c = { audio: false, video: { facingMode: frente ? "user" : { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } } };
      navigator.mediaDevices.getUserMedia(c).then(function (st) {
        stream = st; track = st.getVideoTracks()[0];
        video.srcObject = st;
        var p = video.play(); if (p && p.catch) p.catch(function () {});
        video.onloadedmetadata = function () { clearTimeout(espera); msg.hidden = true; disparo.disabled = false; };
        recursos();
      }).catch(function (err) {
        var negado = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
        planoB(negado ? "O app não tem permissão para usar a câmera. Toque abaixo para usar a câmera do celular, ou libere a câmera nas permissões do site."
                      : "Não foi possível abrir a câmera do app neste celular.");
      });
    }
    // zoom da câmera e lanterna, quando o celular permite
    function recursos() {
      var cap = track && track.getCapabilities ? track.getCapabilities() : {};
      var zbox = $(".cam-zoom", ov), rg = $("input", zbox);
      if (cap.zoom && cap.zoom.max > cap.zoom.min) {
        zbox.hidden = false; rg.min = cap.zoom.min; rg.max = Math.min(cap.zoom.max, 8); rg.step = cap.zoom.step || 0.1;
        rg.value = (track.getSettings && track.getSettings().zoom) || cap.zoom.min;
        $(".cam-zv", zbox).textContent = Number(rg.value).toFixed(1).replace(".", ",") + "x";
        rg.oninput = function () {
          $(".cam-zv", zbox).textContent = Number(rg.value).toFixed(1).replace(".", ",") + "x";
          track.applyConstraints({ advanced: [{ zoom: Number(rg.value) }] }).catch(function () {});
        };
      } else zbox.hidden = true;
      var bl = $(".cam-luz", ov);
      bl.hidden = !cap.torch;
      bl.onclick = function () {
        luz = !luz; bl.setAttribute("aria-pressed", luz);
        track.applyConstraints({ advanced: [{ torch: luz }] }).catch(function () { luz = false; bl.setAttribute("aria-pressed", "false"); });
      };
      // foco contínuo, se disponível
      if (cap.focusMode && cap.focusMode.indexOf("continuous") >= 0) track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(function () {});
    }

    disparo.onclick = function () {
      var w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return;
      // recorta só a região da moldura amarela (com folga): foto mais leve e rosca maior para a IA
      var palcoEl = $(".cam-palco", ov), guia = $(".cam-guia", ov);
      var PW = palcoEl.clientWidth, PH = palcoEl.clientHeight, esc = Math.max(PW / w, PH / h);
      var offX = (PW - w * esc) / 2, offY = (PH - h * esc) / 2;
      var gr = guia.getBoundingClientRect(), pr = palcoEl.getBoundingClientRect();
      var gx = gr.left - pr.left, gy = gr.top - pr.top, gw = gr.width, gh = gr.height;
      var folga = 0.35;
      var sx = Math.max(0, (gx - gw * folga - offX) / esc), sy = Math.max(0, (gy - gh * folga - offY) / esc);
      var sw = Math.min(w - sx, gw * (1 + 2 * folga) / esc), sh = Math.min(h - sy, gh * (1 + 2 * folga) / esc);
      if (!(sw > 50 && sh > 50)) { sx = 0; sy = 0; sw = w; sh = h; }
      var max = 1280, k = Math.min(1, max / Math.max(sw, sh));
      var c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      c.getContext("2d").drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
      var fl = $(".cam-flash", ov); fl.classList.add("on"); setTimeout(function () { fl.classList.remove("on"); }, 60);
      var dataUrl = c.toDataURL("image/jpeg", 0.88);
      c.width = c.height = 0;
      var im = new Image();
      im.onload = function () { fechar(); depoisDeFechar(function () { opts.pronto({ dataUrl: dataUrl, img: im }); }); };
      im.src = dataUrl;
    };
    $(".cam-virar", ov).onclick = function () { frente = !frente; iniciar(); };
    $(".ed-x", ov).onclick = fechar;
    $(".cam-ext", ov).onclick = function () { fechar(); depoisDeFechar(function () { if (opts.externa) opts.externa(); }); };
    iniciar();
  }

  raiz.Medir = { abrirEditor: abrirEditor, abrirCamera: abrirCamera, abrirPente: abrirPente, calibrar: calibrar, pxPorMm: pxPorMm, aoVoltar: null,
    telaAberta: function () { return pilha.length > 0; } };
})(this);
