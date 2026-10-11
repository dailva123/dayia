/* Rosca Fácil by DayIA · ferramentas de precisão
   1) Editor: ajustar a medida na foto com o dedo (marcadores + lupa + pente virtual)
   2) Pente na tela: filetes em tamanho real para encostar a peça (com calibração da tela) */
(function (raiz) {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function fmt(n, c) { return Number(n).toFixed(c === undefined ? 1 : c).replace(".", ","); }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
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
      '<div class="ed-palco"><canvas></canvas><canvas class="ed-lupa" width="240" height="240"></canvas></div>' +
      '<div class="ed-painel">' +
      '<p class="ed-dica"><span class="bol am"></span>Arraste as <b>amarelas</b> até as bordas da rosca (pico a pico). ' +
      '<span class="bol az"></span>Arraste as <b>azuis</b> até dois picos de filete e ajuste os tracinhos em cima dos filetes.</p>' +
      '<div class="ed-linha"><span>Filetes entre as azuis</span><div class="ed-n"><button type="button" data-n="-1" aria-label="Menos">−</button><output>' + n + '</output><button type="button" data-n="1" aria-label="Mais">+</button></div></div>' +
      '<div class="ed-linha"><span>Referência na foto</span><select aria-label="Referência na foto">' +
      '<option value="nenhuma">Nenhuma</option><option value="cartao_maior">Cartão · lado maior</option>' +
      '<option value="cartao_menor">Cartão · lado menor</option><option value="outra">Outra medida…</option></select></div>' +
      '<div class="ed-ref-dica" hidden><span class="bol vd"></span>Arraste as <b>verdes</b> até as pontas da referência.</div>' +
      '<div class="ed-previa" aria-live="polite"></div>' +
      '<div class="ed-acoes"><button type="button" class="btn sec ed-cancelar">Cancelar</button><button type="button" class="btn ed-ok">Usar esta medida</button></div>' +
      "</div>";
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    var cv = $(".ed-palco canvas", ov), ctx = cv.getContext("2d");
    var lupa = $(".ed-lupa", ov), lctx = lupa.getContext("2d");
    var sel = $("select", ov); sel.value = ref;
    var escala = 1, ox = 0, oy = 0, arrastando = null, dpr = window.devicePixelRatio || 1;

    function layout() {
      var palco = $(".ed-palco", ov), pw = palco.clientWidth, ph = palco.clientHeight;
      escala = Math.min(pw / W, ph / H);
      var cw = W * escala, ch = H * escala;
      cv.style.width = cw + "px"; cv.style.height = ch + "px";
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      ox = (pw - cw) / 2; oy = (ph - ch) / 2;
      cv.style.left = ox + "px"; cv.style.top = oy + "px";
      desenhar();
    }
    function tela(p) { return [p[0] * escala, p[1] * escala]; }
    function medida() {
      var dpx = dist(h.a, h.b), passoPx = dist(h.c, h.d) / n;
      var m = { razao: passoPx > 0 ? dpx / passoPx : 0, diametro_px: dpx, passo_px: passoPx, ajustada: true, certeza: 90, tem_referencia: false };
      var mmRef = ref === "outra" ? refOutra : REFS[ref];
      if (mmRef > 0) {
        var k = mmRef / dist(h.r1, h.r2);
        m.tem_referencia = true; m.diametro_mm = dpx * k; m.passo_mm = passoPx * k;
      }
      return m;
    }
    function bolinha(p, cor, rot) {
      var s = tela(p);
      ctx.beginPath(); ctx.arc(s[0], s[1], 11, 0, 7); ctx.fillStyle = cor; ctx.globalAlpha = .35; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(s[0], s[1], 5, 0, 7); ctx.fillStyle = cor; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
      if (rot) { ctx.font = "700 11px Archivo, sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(rot, s[0] + 13, s[1] - 9); }
    }
    function linha(p, q, cor, w) { var s = tela(p), t = tela(q); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(t[0], t[1]); ctx.strokeStyle = cor; ctx.lineWidth = w || 2; ctx.stroke(); }
    function desenhar() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, W * escala, H * escala);
      // pente virtual sobre os filetes
      var vx = h.d[0] - h.c[0], vy = h.d[1] - h.c[1], len = Math.hypot(vx, vy) || 1;
      var px = -vy / len, py = vx / len, meio = dist(h.a, h.b) * 0.35 || 20;
      ctx.lineCap = "round";
      for (var i = 0; i <= n; i++) {
        var t = i / n, cx = h.c[0] + vx * t, cy = h.c[1] + vy * t;
        linha([cx - px * meio, cy - py * meio], [cx + px * meio, cy + py * meio], "rgba(43,140,232,.95)", i === 0 || i === n ? 2.5 : 1.6);
      }
      linha(h.c, h.d, "rgba(43,140,232,.6)", 1.5);
      linha(h.a, h.b, "#F2C230", 2.5);
      bolinha(h.a, "#F2C230"); bolinha(h.b, "#F2C230", "diâmetro");
      bolinha(h.c, "#2B8CE8"); bolinha(h.d, "#2B8CE8", n + " filetes");
      if (sel.value !== "nenhuma") { linha(h.r1, h.r2, "#1F8A5B", 2.5); bolinha(h.r1, "#1F8A5B"); bolinha(h.r2, "#1F8A5B", "referência"); }
      var m = medida(), txt = opts.previa ? opts.previa(m) : "";
      $(".ed-previa", ov).innerHTML = "Proporção <b>" + fmt(m.razao) + "</b>" + (m.tem_referencia ? " · diâmetro <b>" + fmt(m.diametro_mm) + " mm</b>" : "") + (txt ? " → " + txt : "");
    }
    function lupaEm(p) {
      var z = 3, L = 240, s = L / z / escala; // região da imagem original
      lctx.clearRect(0, 0, L, L);
      lctx.save(); lctx.beginPath(); lctx.arc(L / 2, L / 2, L / 2 - 2, 0, 7); lctx.clip();
      lctx.fillStyle = "#000"; lctx.fillRect(0, 0, L, L);
      lctx.drawImage(img, p[0] - s / 2, p[1] - s / 2, s, s, 0, 0, L, L);
      lctx.restore();
      lctx.strokeStyle = "#F2C230"; lctx.lineWidth = 2;
      lctx.beginPath(); lctx.moveTo(L / 2 - 16, L / 2); lctx.lineTo(L / 2 + 16, L / 2); lctx.moveTo(L / 2, L / 2 - 16); lctx.lineTo(L / 2, L / 2 + 16); lctx.stroke();
      lctx.beginPath(); lctx.arc(L / 2, L / 2, L / 2 - 2, 0, 7); lctx.lineWidth = 4; lctx.strokeStyle = "#fff"; lctx.stroke();
      var sx = p[0] * escala + ox;
      lupa.style.left = (sx < ov.clientWidth / 2 ? ov.clientWidth - 140 : 20) + "px";
      lupa.hidden = false;
    }
    function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / escala, (e.clientY - r.top) / escala]; }
    cv.addEventListener("pointerdown", function (e) {
      var p = pos(e), melhor = null, md = 34 / escala;
      ["a", "b", "c", "d"].concat(sel.value !== "nenhuma" ? ["r1", "r2"] : []).forEach(function (k) {
        var dd = dist(p, h[k]); if (dd < md) { md = dd; melhor = k; }
      });
      if (!melhor) return;
      arrastando = { k: melhor, dx: h[melhor][0] - p[0], dy: h[melhor][1] - p[1] };
      cv.setPointerCapture(e.pointerId); lupaEm(h[melhor]); e.preventDefault();
    });
    cv.addEventListener("pointermove", function (e) {
      if (!arrastando) return;
      var p = pos(e);
      h[arrastando.k] = [Math.max(0, Math.min(W, p[0] + arrastando.dx)), Math.max(0, Math.min(H, p[1] + arrastando.dy))];
      desenhar(); lupaEm(h[arrastando.k]);
    });
    function solta() { arrastando = null; lupa.hidden = true; }
    cv.addEventListener("pointerup", solta); cv.addEventListener("pointercancel", solta);
    lupa.hidden = true;

    ov.querySelectorAll("[data-n]").forEach(function (b) {
      b.onclick = function () { n = Math.max(1, Math.min(40, n + Number(b.dataset.n))); $("output", ov).textContent = n; desenhar(); };
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
    function fechar() { window.removeEventListener("resize", layout); ov.remove(); document.body.style.overflow = ""; }
    $(".ed-x", ov).onclick = fechar; $(".ed-cancelar", ov).onclick = fechar;
    $(".ed-ok", ov).onclick = function () { var m = medida(); fechar(); opts.pronto(m); };
    window.addEventListener("resize", layout);
    requestAnimationFrame(layout);
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
    function fechar() { ov.remove(); document.body.style.overflow = ""; }
    $(".ed-x", ov).onclick = fechar; $(".ed-cancelar", ov).onclick = fechar;
    $(".ed-ok", ov).onclick = function () { lsSet("rf-pxmm", String(k)); fechar(); if (depois) depois(); };
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
    function fechar() { window.removeEventListener("resize", mostra); ov.remove(); document.body.style.overflow = ""; }
    $(".ed-x", ov).onclick = fechar;
    $(".ed-cal", ov).onclick = function () { fechar(); calibrar(function () { abrirPente(candidatos, tipo); }); };
    window.addEventListener("resize", mostra);
    requestAnimationFrame(mostra);
  }

  raiz.Medir = { abrirEditor: abrirEditor, abrirPente: abrirPente, calibrar: calibrar, pxPorMm: pxPorMm };
})(this);
