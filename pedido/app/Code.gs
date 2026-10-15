/* =====================================================================
   PEDIDO FÁCIL by DayIA  ·  servidor (Google Apps Script)
   ---------------------------------------------------------------------
   Cardápio online com pedido, Pix e comprovante. UMA planilha para
   todos os restaurantes. Cada restaurante tem o próprio link e painel.
   Aba "Negocios", coluna situacao:
     teste · ativo · cortesia · suspenso   (igual à Agenda Fácil)

   Instalação (uma vez só):
   1. Crie uma planilha Google em branco chamada "Pedido Fácil".
   2. Extensões > Apps Script. Apague o que estiver lá e cole este arquivo.
   3. Selecione a função "configurar" e clique em Executar (autorize).
   4. Implantar > Nova implantação > App da Web
        Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
   5. Copie o endereço que termina em /exec e mande para a DayIA.
   6. Aba Config, linha push_chave: cole a mesma chave do OneSignal da
      Agenda Fácil (começa com os_v2_) e rode a função testarAviso.
   ===================================================================== */

var VERSAO_SISTEMA = "1.0";
var ABAS = {
  Negocios: ["n","nome","situacao","teste_ate","criado","dono","whatsapp","email_aviso","senha","telefone","endereco","instagram","logo",
             "pix_chave","pix_nome","pix_banco","taxa_entrega","entrega_obs","retirada","entrega","pagar_na_hora","dias","abre","fecha","tempo","pedido_minimo","aviso","cardapio"],
  Pedidos:  ["negocio","id","num","criado","quando","cliente","tel","email","tipo","endereco","itens","resumo","subtotal","taxa","total",
             "pagamento","comprovante","pago","status","obs","chave","historico"],
  Config:   ["chave","valor","explicacao"]
};
var MIN = 60000, DIA = 86400000;
var STATUS = { novo: "Recebido", confirmado: "Confirmado", preparo: "Em preparo", pronto: "Pronto para retirar", saiu: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };

/* ---------------- instalação ---------------- */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Abra este script a partir da planilha (Extensões > Apps Script).");
  PropertiesService.getScriptProperties().setProperty("PLANILHA", ss.getId());
  Object.keys(ABAS).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (sh.getLastRow() === 0) { sh.appendRow(ABAS[nome]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, ABAS[nome].length).setFontWeight("bold").setBackground("#0E2238").setFontColor("#FFFFFF"); }
  });
  var cfg = ss.getSheetByName("Config"), tem = cfg.getDataRange().getValues().map(function (r) { return r[0]; });
  [["dias_teste", "30", "Dias de teste grátis para restaurante novo"],
   ["email_admin", "", "Seu e-mail (opcional): recebe aviso de problemas"],
   ["whatsapp_dayia", "5519999389118", "WhatsApp que aparece quando o teste vence ou o restaurante está suspenso"],
   ["fuso_minutos", "-180", "Fuso horário (Brasília = -180). Não mexa."],
   ["proximo_id", "1", "Uso interno (não mexa)"],
   ["link_base", "", "Preenchido sozinho"],
   ["pasta_comprovantes", "", "Preenchido sozinho (pasta do Drive com os comprovantes)"],
   ["push_chave", "", "Chave do OneSignal (a mesma da Agenda Fácil, começa com os_v2_)"]
  ].forEach(function (p) { if (tem.indexOf(p[0]) < 0) cfg.appendRow([p[0], txt_(p[1]), p[2]]); });
  cfg.autoResizeColumns(1, 3);
  if (!negocio_("la-vecchi", true)) criarLaVecchi_();
  var sobra = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
  if (sobra && sobra.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(sobra);
  pasta_();
  MailApp.getRemainingDailyQuota();
  return "Pronto! Agora faça a implantação como App da Web.";
}
function criarLaVecchi_() {
  inserir_("Negocios", {
    n: "la-vecchi", nome: "La Vecchi Cozinha e Confeitaria", situacao: "teste", teste_ate: legivel_(Date.now() + (Number(cfgVal_("dias_teste")) || 30) * DIA).slice(0, 10),
    criado: legivel_(Date.now()), dono: "La Vecchi", whatsapp: "5519997576919", email_aviso: "", senha: hash_("1234"), telefone: "(19) 99757-6919",
    endereco: "", instagram: "", logo: "", pix_chave: "49.939.307/0001-41", pix_nome: "Paulo Henrique da Silva Refeições", pix_banco: "Banco do Brasil",
    taxa_entrega: 3.5, entrega_obs: "", retirada: "SIM", entrega: "SIM", pagar_na_hora: "NÃO", dias: "1,2,3,4,5,6", abre: "08:00", fecha: "14:00",
    tempo: "40 a 60 min", pedido_minimo: 0, aviso: "", cardapio: JSON.stringify(CARDAPIO_LA_VECCHI)
  });
}
var CARDAPIO_LA_VECCHI = {
  acomp: { titulo: "Acompanhamento", opcoes: ["Fritas", "Purê", "Legumes", "Batata sauté"] },
  grupos: [
    { id: "exec", nome: "Marmita Executiva", desc: "Arroz, feijão e mais um acompanhamento à sua escolha.", tamanhos: [],
      pratos: [
        { id: "e1", nome: "Filé de frango com creme de milho", preco: 35, dias: [4] },
        { id: "e2", nome: "Contrafilé à parmegiana", preco: 42, dias: [4] },
        { id: "e3", nome: "Filé de frango grelhado", preco: 32, dias: [1,2,3,4,5,6] },
        { id: "e4", nome: "Filé de peixe ao molho branco", preco: 39, dias: [4] },
        { id: "e5", nome: "Talharim com sobrecoxa de frango", preco: 37, dias: [4], variacoes: { titulo: "Molho", opcoes: ["Sugo", "Bolonhesa", "Branco"] }, semAcomp: true }
      ] },
    { id: "pm", nome: "Marmita Pequena ou Média", desc: "Arroz, feijão e mais um acompanhamento à sua escolha.", tamanhos: [{ id: "p", nome: "Pequena", preco: 24 }, { id: "m", nome: "Média", preco: 27 }],
      pratos: [
        { id: "p1", nome: "Peixe empanado", dias: [4] },
        { id: "p2", nome: "Filé de frango com creme de milho", dias: [4] },
        { id: "p3", nome: "Coxa assada", dias: [4] }
      ] }
  ]
};

/* ---------------- entrada ---------------- */
function doGet(e) { var p = (e && e.parameter) || {}; if (p.acao) return responder_(executar_(p)); return ContentService.createTextOutput("Pedido Fácil by DayIA · servidor funcionando (versão " + VERSAO_SISTEMA + ")."); }
function doPost(e) { var d = {}; try { d = JSON.parse(e.postData.contents || "{}"); } catch (x) { return responder_({ erro: "Pedido inválido." }); } return responder_(executar_(d)); }
function responder_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function executar_(d) { try { var f = ACOES[d.acao]; if (!f) return { erro: "Ação desconhecida." }; return f(d); } catch (x) { return { erro: String(x && x.message || x) }; } }

var ACOES = {
  ping: function () { return { ok: true, versao: VERSAO_SISTEMA }; },

  /* ======== PÁGINA DO CLIENTE ======== */
  info: function (d) {
    var N = negocio_(d.n), L = liberado_(N);
    if (!L.ok) return { ok: true, bloqueado: true, negocio: { nome: String(N.nome) }, whatsapp: L.whatsapp };
    return { ok: true, negocio: publicoNeg_(N), cardapio: cardapio_(N), agora: Date.now(), fuso: fuso_() };
  },
  pedir: function (d) {
    var N = negocio_(d.n);
    if (!liberado_(N).ok) throw new Error("Os pedidos online estão indisponíveis no momento.");
    var c = d.dados || {};
    if (!lim_(c.nome, 80)) throw new Error("Coloque o seu nome.");
    if (soDig_(c.tel).length < 10) throw new Error("Coloque um WhatsApp com DDD.");
    var tipo = c.tipo === "entrega" ? "entrega" : "retirada";
    if (tipo === "entrega" && !sim_(N.entrega)) throw new Error("Este restaurante não está fazendo entrega.");
    if (tipo === "retirada" && !sim_(N.retirada)) throw new Error("Este restaurante não está fazendo retirada.");
    if (tipo === "entrega" && lim_(c.endereco, 300).length < 8) throw new Error("Coloque o endereço completo para a entrega.");
    if (!aberto_(N)) throw new Error("O restaurante está fechado agora. " + horarioTxt_(N));
    var calc = calcular_(N, c.itens || []);
    if (!calc.itens.length) throw new Error("Escolha pelo menos um prato.");
    var minimo = Number(N.pedido_minimo) || 0;
    if (minimo && calc.subtotal < minimo) throw new Error("O pedido mínimo é " + brl_(minimo) + ".");
    var taxa = tipo === "entrega" ? (Number(N.taxa_entrega) || 0) : 0, total = Math.round((calc.subtotal + taxa) * 100) / 100;
    var pag = c.pagamento === "na_hora" && sim_(N.pagar_na_hora) ? "na_hora" : "pix";
    return comTrava_(function () {
      var id = proximoId_(), agora = Date.now();
      var p = { negocio: N.n, id: id, num: numDia_(N.n, agora), criado: agora, quando: legivel_(agora), cliente: lim_(c.nome, 80), tel: lim_(c.tel, 30), email: lim_(c.email, 120),
        tipo: tipo, endereco: tipo === "entrega" ? lim_(c.endereco, 300) : "", itens: JSON.stringify(calc.itens), resumo: calc.resumo, subtotal: calc.subtotal, taxa: taxa, total: total,
        pagamento: pag, comprovante: "", pago: "", status: "novo", obs: lim_(c.obs, 400), chave: Utilities.getUuid().replace(/-/g, "").slice(0, 10), historico: JSON.stringify([{ s: "novo", t: agora }]) };
      if (c.arquivo && c.arquivo.dados) p.comprovante = salvarComprovante_(N, p, c.arquivo);
      inserir_("Pedidos", p);
      if (d.base) setCfg_("link_base", String(d.base).split("?")[0].split("#")[0]);
      mudou_(N.n);
      avisarNegocio_(N, p);
      emailCliente_(N, p, "novo");
      push_(["N_" + N.n], "🛎️ Pedido #" + p.num + " · " + p.cliente, brl_(total) + " · " + (tipo === "entrega" ? "Entrega" : "Retirada") + " · " + p.resumo, linkPainel_(N));
      return { ok: true, pedido: publico_(p), chave: p.chave };
    });
  },
  comprovante: function (d) { // cliente manda o comprovante depois
    var N = negocio_(d.n), p = doCliente_(N, d);
    if (!d.arquivo || !d.arquivo.dados) throw new Error("Escolha a foto ou o PDF do comprovante.");
    var id = salvarComprovante_(N, p, d.arquivo);
    atualizarPed_(p.id, { comprovante: id }); mudou_(N.n);
    push_(["N_" + N.n], "🧾 Comprovante do pedido #" + p.num, p.cliente + " mandou o comprovante · " + brl_(p.total), linkPainel_(N));
    return { ok: true };
  },
  meus: function (d) {
    var N = negocio_(d.n), out = [];
    (d.lista || []).slice(0, 15).forEach(function (x) { try { out.push(publico_(doCliente_(N, x))); } catch (e) {} });
    return { ok: true, pedidos: out };
  },
  pushReg: function (d) {
    if (d.token) pushGuardar_("N_" + sessao_(d), d.sub);
    else { var N = negocio_(d.n); (d.lista || []).slice(0, 10).forEach(function (x) { try { var p = doCliente_(N, x); pushGuardar_("C_" + N.n + "_" + p.id, d.sub); } catch (e) {} }); }
    return { ok: true, ativo: !!pushChave_() };
  },

  /* ======== PAINEL DO RESTAURANTE ======== */
  entrar: function (d) {
    var N = negocio_(d.n);
    if (!confereSenha_(N, String(d.senha || ""))) throw new Error("Senha incorreta.");
    return { ok: true, token: novoToken_(N.n) };
  },
  sair: function (d) { encerrarSessao_(d.token); return { ok: true }; },
  versao: function (d) { var n = sessao_(d); return { ok: true, v: versao_(n) }; },
  painel: function (d) {
    var n = sessao_(d), N = negocio_(n), desde = Date.now() - (Number(d.dias) || 2) * DIA;
    var lista = pedidos_(n).filter(function (p) { return p.criado >= desde || ["novo", "confirmado", "preparo", "pronto", "saiu"].indexOf(p.status) >= 0; });
    return { ok: true, v: versao_(n), negocio: completoNeg_(N), cardapio: cardapio_(N), pedidos: lista.map(function (p) { return publico_(p, true); }), licenca: liberado_(N), resumo: resumo_(n) };
  },
  status: function (d) {
    var n = sessao_(d), N = negocio_(n);
    return comTrava_(function () {
      var p = pedidos_(n).filter(function (x) { return x.id === Number(d.id); })[0];
      if (!p) throw new Error("Pedido não encontrado.");
      var campos = {};
      if (d.status && STATUS[d.status]) { campos.status = d.status; var h = hist_(p); h.push({ s: d.status, t: Date.now() }); campos.historico = JSON.stringify(h); }
      if (d.pago !== undefined) campos.pago = d.pago ? "SIM" : "";
      atualizarPed_(p.id, campos); mudou_(n);
      if (campos.status) {
        Object.keys(campos).forEach(function (k) { p[k] = campos[k]; });
        push_(["C_" + n + "_" + p.id], N.nome, avisoCli_(p), linkCli_(N, p));
        if (["confirmado", "saiu", "pronto", "cancelado"].indexOf(d.status) >= 0) emailCliente_(N, p, d.status);
      }
      return { ok: true };
    });
  },
  verComprovante: function (d) {
    var n = sessao_(d), p = pedidos_(n).filter(function (x) { return x.id === Number(d.id); })[0];
    if (!p || !p.comprovante) throw new Error("Este pedido não tem comprovante.");
    var f = DriveApp.getFileById(String(p.comprovante)), b = f.getBlob();
    return { ok: true, tipo: b.getContentType(), dados: Utilities.base64Encode(b.getBytes()), nome: f.getName() };
  },
  salvarCardapio: function (d) {
    var n = sessao_(d), c = d.cardapio || {};
    if (!c.grupos || !c.grupos.length) throw new Error("O cardápio precisa ter pelo menos um grupo.");
    var s = JSON.stringify(c); if (s.length > 45000) throw new Error("Cardápio grande demais.");
    atualizarNeg_(n, { cardapio: s }); mudou_(n);
    return { ok: true };
  },
  salvarAjustes: function (d) {
    var n = sessao_(d), a = d.ajustes || {}, m = {};
    ["nome", "telefone", "endereco", "instagram", "pix_chave", "pix_nome", "pix_banco", "entrega_obs", "abre", "fecha", "tempo", "aviso", "email_aviso", "whatsapp"].forEach(function (k) { if (a[k] !== undefined) m[k] = lim_(a[k], 200); });
    ["taxa_entrega", "pedido_minimo"].forEach(function (k) { if (a[k] !== undefined) m[k] = Math.max(0, Number(String(a[k]).replace(",", ".")) || 0); });
    ["retirada", "entrega", "pagar_na_hora"].forEach(function (k) { if (a[k] !== undefined) m[k] = a[k] ? "SIM" : "NÃO"; });
    if (a.dias) m.dias = a.dias.map(Number).filter(function (x) { return x >= 0 && x <= 6; }).join(",");
    if (a.logo !== undefined) { if (String(a.logo).length > 40000) throw new Error("Logo grande demais."); m.logo = String(a.logo); }
    if (a.senha) { if (String(a.senha).length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres."); m.senha = hash_(a.senha); }
    atualizarNeg_(n, m); mudou_(n);
    return { ok: true };
  }
};

/* ---------------- regras ---------------- */
function cardapio_(N) { try { var c = JSON.parse(N.cardapio || "{}"); return c && c.grupos ? c : { grupos: [] }; } catch (x) { return { grupos: [] }; } }
function calcular_(N, itens) {
  var C = cardapio_(N), out = [], sub = 0, wd = diaSemana_(Date.now());
  itens.slice(0, 40).forEach(function (it) {
    var g = (C.grupos || []).filter(function (x) { return x.id === it.g; })[0]; if (!g) return;
    var p = (g.pratos || []).filter(function (x) { return x.id === it.p; })[0]; if (!p || p.esgotado || p.ativo === false) return;
    if (p.dias && p.dias.length && p.dias.indexOf(wd) < 0) return;
    var preco = Number(p.preco) || 0, tam = "";
    if (g.tamanhos && g.tamanhos.length) { var t = g.tamanhos.filter(function (x) { return x.id === it.t; })[0] || g.tamanhos[0]; preco = Number(t.preco) || 0; tam = t.nome; }
    var q = Math.max(1, Math.min(50, Number(it.q) || 1));
    var ac = !p.semAcomp && C.acomp && (C.acomp.opcoes || []).indexOf(it.a) >= 0 ? it.a : "";
    var va = p.variacoes && (p.variacoes.opcoes || []).indexOf(it.v) >= 0 ? it.v : "";
    out.push({ grupo: g.nome, prato: p.nome, tam: tam, acomp: ac, var: va, obs: lim_(it.obs, 160), q: q, unit: preco, total: Math.round(preco * q * 100) / 100 });
    sub += preco * q;
  });
  return { itens: out, subtotal: Math.round(sub * 100) / 100, resumo: out.map(function (i) { return i.q + "× " + (i.tam ? i.tam + " " : "") + i.prato; }).join(", ") };
}
function aberto_(N) {
  var wd = diaSemana_(Date.now()), dias = String(N.dias || "").split(",").map(Number);
  if (dias.indexOf(wd) < 0) return false;
  var m = minutosHoje_(Date.now());
  return m >= hm_(hmTxt_(N.abre)) && m < hm_(hmTxt_(N.fecha));
}
function horarioTxt_(N) { return "Pedidos das " + hmTxt_(N.abre) + " às " + hmTxt_(N.fecha) + "."; }
function numDia_(n, agora) { var d0 = inicioDia_(agora); return pedidos_(n).filter(function (p) { return p.criado >= d0; }).length + 1; }
function resumo_(n) {
  var hoje = inicioDia_(Date.now()), sem = hoje - 6 * DIA, ok = pedidos_(n).filter(function (p) { return p.status !== "cancelado"; });
  var soma = function (l) { return Math.round(l.reduce(function (a, p) { return a + Number(p.total || 0); }, 0) * 100) / 100; };
  var lh = ok.filter(function (p) { return p.criado >= hoje; }), ls = ok.filter(function (p) { return p.criado >= sem; });
  var cont = {}; ls.forEach(function (p) { try { JSON.parse(p.itens).forEach(function (i) { cont[i.prato] = (cont[i.prato] || 0) + i.q; }); } catch (e) {} });
  var top = Object.keys(cont).map(function (k) { return [k, cont[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
  var dias = []; for (var i = 6; i >= 0; i--) { var a = hoje - i * DIA; dias.push([a, soma(ok.filter(function (p) { return p.criado >= a && p.criado < a + DIA; }))]); }
  return { hoje: { n: lh.length, total: soma(lh) }, semana: { n: ls.length, total: soma(ls) }, top: top, dias: dias };
}
function avisoCli_(p) {
  return { confirmado: "✅ Seu pedido #" + p.num + " foi confirmado", preparo: "👩‍🍳 Seu pedido #" + p.num + " está sendo preparado", pronto: "🛍️ Seu pedido #" + p.num + " está pronto para retirar",
    saiu: "🛵 Seu pedido #" + p.num + " saiu para entrega", entregue: "🎉 Pedido #" + p.num + " entregue. Bom apetite!", cancelado: "❌ Seu pedido #" + p.num + " foi cancelado" }[p.status] || "Seu pedido foi atualizado";
}

/* ---------------- comprovante no Drive ---------------- */
function pasta_() {
  var id = cfgVal_("pasta_comprovantes");
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var f = DriveApp.createFolder("Pedido Fácil · Comprovantes"); setCfg_("pasta_comprovantes", f.getId()); return f;
}
function salvarComprovante_(N, p, arq) {
  var tipo = String(arq.tipo || "image/jpeg");
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(tipo)) throw new Error("Mande o comprovante em foto ou PDF.");
  var bytes = Utilities.base64Decode(String(arq.dados).replace(/^data:[^,]+,/, ""));
  if (bytes.length > 6 * 1024 * 1024) throw new Error("Arquivo grande demais (máximo 6 MB).");
  var ext = tipo === "application/pdf" ? ".pdf" : (tipo === "image/png" ? ".png" : ".jpg");
  var f = pasta_().createFile(Utilities.newBlob(bytes, tipo, N.n + "_pedido" + p.id + "_" + soDig_(legivel_(Date.now())) + ext));
  return f.getId();
}

/* ---------------- e-mails ---------------- */
function itensHtml_(p) {
  var l = []; try { l = JSON.parse(p.itens); } catch (x) {}
  return "<table style='border-collapse:collapse;width:100%;max-width:520px'>" + l.map(function (i) {
    return "<tr><td style='padding:6px 0;border-bottom:1px solid #eee'><b>" + i.q + "× " + esc_((i.tam ? i.tam + " · " : "") + i.prato) + "</b>" +
      [i.var && "Molho: " + i.var, i.acomp && "Acomp.: " + i.acomp, i.obs].filter(Boolean).map(function (x) { return "<br><span style='color:#555'>" + esc_(x) + "</span>"; }).join("") +
      "</td><td style='text-align:right;border-bottom:1px solid #eee'>" + brl_(i.total) + "</td></tr>"; }).join("") +
    (Number(p.taxa) ? "<tr><td style='padding:6px 0'>Taxa de entrega</td><td style='text-align:right'>" + brl_(p.taxa) + "</td></tr>" : "") +
    "<tr><td style='padding:6px 0'><b>Total</b></td><td style='text-align:right'><b>" + brl_(p.total) + "</b></td></tr></table>";
}
function avisarNegocio_(N, p) {
  if (!/@/.test(N.email_aviso || "")) return;
  var lk = linkPainel_(N);
  enviar_(String(N.email_aviso), "🛎️ Pedido #" + p.num + " · " + p.cliente + " · " + brl_(p.total),
    "<h2 style='margin:0 0 8px'>Novo pedido #" + p.num + "</h2><p><b>" + esc_(p.cliente) + "</b> · WhatsApp " + esc_(p.tel) + "<br>" +
    (p.tipo === "entrega" ? "🛵 Entrega: " + esc_(p.endereco) : "🛍️ Retirada no local") + "<br>Pagamento: " + (p.pagamento === "pix" ? "Pix" + (p.comprovante ? " · comprovante enviado ✅" : " · aguardando comprovante") : "na entrega/retirada") +
    (p.obs ? "<br>Recado: " + esc_(p.obs) : "") + "</p>" + itensHtml_(p) +
    (lk ? "<p><a href='" + lk + "' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Abrir o painel</a></p>" : ""), String(N.nome));
}
function emailCliente_(N, p, tipo) {
  if (!/@/.test(p.email || "")) return;
  var tit = { novo: "Recebemos seu pedido #" + p.num, confirmado: "Pedido #" + p.num + " confirmado", saiu: "Pedido #" + p.num + " saiu para entrega", pronto: "Pedido #" + p.num + " pronto para retirar", cancelado: "Pedido #" + p.num + " cancelado" }[tipo] || "Pedido #" + p.num;
  var lk = linkCli_(N, p);
  enviar_(p.email, tit + " · " + N.nome,
    "<p>Olá, " + esc_(String(p.cliente).split(" ")[0]) + "!</p><p><b>" + tit + "</b>.</p>" + itensHtml_(p) +
    "<p>" + (p.tipo === "entrega" ? "🛵 Entrega em: " + esc_(p.endereco) : "🛍️ Retirada no local" + (N.endereco ? ": " + esc_(N.endereco) : "")) + "</p>" +
    (lk ? "<p><a href='" + lk + "' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Acompanhar meu pedido</a></p>" : "") +
    "<p style='color:#4A5B75'>" + esc_(N.nome) + (N.telefone ? " · " + esc_(N.telefone) : "") + "</p>", String(N.nome));
}
function enviar_(para, assunto, html, nome) {
  try { if (MailApp.getRemainingDailyQuota() < 1) return; MailApp.sendEmail({ to: para, subject: assunto, htmlBody: "<div style='font-family:Arial,sans-serif;color:#0E2238;font-size:14px'>" + html + "</div>", name: nome || "Pedido Fácil" }); }
  catch (x) { console.log("e-mail não enviado: " + x); }
}

/* ---------------- negócio e licença ---------------- */
function negocio_(n, semErro) {
  n = String(n || "").toLowerCase().trim();
  var N = linhas_("Negocios").filter(function (x) { return String(x.n).toLowerCase() === n; })[0];
  if (!N && !semErro) throw new Error("Restaurante não encontrado. Confira o link.");
  if (N) N.n = String(N.n).toLowerCase();
  return N || null;
}
function liberado_(N) {
  var s = String(N.situacao || "").toLowerCase().trim();
  if (s === "cortesia" || s === "ativo") return { ok: true, situacao: s };
  if (s === "suspenso") return { ok: false, situacao: s, whatsapp: cfgVal_("whatsapp_dayia") };
  var ate = dataDe_(N.teste_ate);
  if (ate && Date.now() > ate + DIA) return { ok: false, situacao: "teste_vencido", whatsapp: cfgVal_("whatsapp_dayia") };
  return { ok: true, situacao: "teste", dias_restantes: ate ? Math.max(0, Math.floor((ate + DIA - Date.now()) / DIA)) : null, whatsapp: cfgVal_("whatsapp_dayia") };
}
function publicoNeg_(N) {
  return { n: N.n, nome: String(N.nome), tel: String(N.telefone || ""), whats: soDig_(N.whatsapp), end: String(N.endereco || ""), insta: String(N.instagram || ""), logo: String(N.logo || ""),
    pix_chave: String(N.pix_chave || ""), pix_nome: String(N.pix_nome || ""), pix_banco: String(N.pix_banco || ""), taxa: Number(N.taxa_entrega) || 0, entrega_obs: String(N.entrega_obs || ""),
    retirada: sim_(N.retirada), entrega: sim_(N.entrega), na_hora: sim_(N.pagar_na_hora), dias: String(N.dias || "").split(",").filter(String).map(Number),
    abre: hmTxt_(N.abre), fecha: hmTxt_(N.fecha), tempo: String(N.tempo || ""), minimo: Number(N.pedido_minimo) || 0, aviso: String(N.aviso || ""), aberto: aberto_(N) };
}
function completoNeg_(N) { var o = publicoNeg_(N); o.email_aviso = String(N.email_aviso || ""); o.whatsapp = String(N.whatsapp || ""); return o; }
function confereSenha_(N, senha) {
  var s = String(N.senha || "");
  if (/^[0-9a-f]{64}$/.test(s)) return hash_(senha) === s;
  if (s !== "" && s === senha) { atualizarNeg_(N.n, { senha: hash_(senha) }); return true; }
  return false;
}
function hash_(s) { var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "pedidofacil:" + String(s), Utilities.Charset.UTF_8); return b.map(function (x) { return ("0" + ((x + 256) % 256).toString(16)).slice(-2); }).join(""); }

/* ---------------- pedidos ---------------- */
function pedidos_(n) {
  return linhas_("Pedidos").filter(function (p) { return String(p.negocio).toLowerCase() === n; }).map(function (p) {
    p.id = Number(p.id); p.num = Number(p.num); p.criado = Number(p.criado); p.total = Number(p.total); p.subtotal = Number(p.subtotal); p.taxa = Number(p.taxa); p.status = String(p.status); return p; });
}
function doCliente_(N, x) { var p = pedidos_(N.n).filter(function (y) { return y.id === Number(x.id); })[0]; if (!p || !x.chave || String(p.chave) !== String(x.chave)) throw new Error("Pedido não encontrado."); return p; }
function hist_(p) { try { return JSON.parse(p.historico || "[]"); } catch (x) { return []; } }
function publico_(p, painel) {
  var o = { id: p.id, num: p.num, criado: p.criado, cliente: String(p.cliente), tipo: String(p.tipo), endereco: String(p.endereco || ""), itens: (function () { try { return JSON.parse(p.itens); } catch (x) { return []; } })(),
    subtotal: p.subtotal, taxa: p.taxa, total: p.total, pagamento: String(p.pagamento), comprovante: !!p.comprovante, pago: sim_(p.pago), status: p.status, obs: String(p.obs || ""), historico: hist_(p) };
  if (painel) { o.tel = String(p.tel); o.email = String(p.email || ""); }
  return o;
}
function atualizarPed_(id, campos) { atualizarPor_("Pedidos", 1, Number(id), campos); }
function atualizarNeg_(n, campos) { atualizarPor_("Negocios", 0, n, campos); }
function linkNeg_(N) { var b = cfgVal_("link_base"); return b ? b + "?n=" + encodeURIComponent(N.n) : ""; }
function linkPainel_(N) { var l = linkNeg_(N); return l ? l + "#painel" : ""; }
function linkCli_(N, p) { var l = linkNeg_(N); return l ? l + "&p=" + p.id + "&k=" + p.chave : ""; }

/* ---------------- planilha ---------------- */
function planilha_() { var id = PropertiesService.getScriptProperties().getProperty("PLANILHA"); return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); }
function aba_(n) { var sh = planilha_().getSheetByName(n); if (!sh) throw new Error("A aba " + n + " não existe. Rode a função configurar."); return sh; }
function linhas_(n) { var v = aba_(n).getDataRange().getValues(), cab = v.shift(); return v.filter(function (r) { return r.join("") !== ""; }).map(function (r) { var o = {}; cab.forEach(function (c, i) { o[c] = r[i]; }); return o; }); }
var CAB_ = {};
function cab_(n) { if (!CAB_[n]) { var sh = aba_(n); CAB_[n] = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String); } return CAB_[n]; }
function inserir_(n, o) { aba_(n).appendRow(txtRow_(cab_(n).map(function (c) { return o[c] === undefined || o[c] === null ? "" : o[c]; }))); }
function atualizarPor_(aba, col0, chave, campos) {
  var sh = aba_(aba), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    var k = v[i][col0];
    if ((typeof chave === "number" && Number(k) === chave) || (typeof chave === "string" && String(k).toLowerCase() === chave)) {
      var cab = cab_(aba); Object.keys(campos).forEach(function (c) { var col = cab.indexOf(c); if (col >= 0) sh.getRange(i + 1, col + 1).setValue(txt_(campos[c])); }); return;
    }
  }
}
function cfgVal_(k) { var r = linhas_("Config").filter(function (x) { return x.chave === k; })[0]; return r ? String(r.valor) : ""; }
function setCfg_(k, v) {
  var sh = aba_("Config"), d = sh.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) if (d[i][0] === k) { sh.getRange(i + 1, 2).setValue(txt_(String(v))); return; }
  sh.appendRow([k, txt_(String(v)), ""]);
}
function proximoId_() { var id = Number(cfgVal_("proximo_id")) || 1; setCfg_("proximo_id", id + 1); return id; }

/* ---------------- tempo ---------------- */
var FUSO_CACHE = null;
function fuso_() { if (FUSO_CACHE === null) FUSO_CACHE = Number(cfgVal_("fuso_minutos")) || -180; return FUSO_CACHE; }
function inicioDia_(t) { var off = fuso_() * MIN; return Math.floor((t + off) / DIA) * DIA - off; }
function diaSemana_(t) { return new Date(t + fuso_() * MIN).getUTCDay(); }
function minutosHoje_(t) { return Math.floor((t - inicioDia_(t)) / MIN); }
function hm_(s) { var p = String(s || "0:0").split(":"); return Number(p[0]) * 60 + (Number(p[1]) || 0); }
function hmTxt_(v) { if (v instanceof Date) return ("0" + v.getHours()).slice(-2) + ":" + ("0" + v.getMinutes()).slice(-2); return String(v || "").trim(); }
function legivel_(t) { var d = new Date(t + fuso_() * MIN); var z = function (x) { return ("0" + x).slice(-2); }; return z(d.getUTCDate()) + "/" + z(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear() + " " + z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()); }
function dataDe_(v) {
  if (!v) return 0; if (v instanceof Date) return v.getTime();
  var m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]) - fuso_() * MIN;
  var t = Date.parse(v); return isNaN(t) ? 0 : t;
}

/* ---------------- sessão, versão e trava ---------------- */
var SESSAO_DIAS = 60;
function novoToken_(n) { var t = Utilities.getUuid(); PropertiesService.getScriptProperties().setProperty("SS_" + t, JSON.stringify({ v: n, exp: Date.now() + SESSAO_DIAS * DIA })); return t; }
function sessao_(d) {
  var t = String(d.token || ""), raw = t && PropertiesService.getScriptProperties().getProperty("SS_" + t);
  if (!raw) throw new Error("SESSAO");
  var o = JSON.parse(raw); if (!(o.exp > Date.now())) throw new Error("SESSAO");
  return o.v;
}
function encerrarSessao_(t) { if (t) PropertiesService.getScriptProperties().deleteProperty("SS_" + t); }
function versao_(n) { return Number(PropertiesService.getScriptProperties().getProperty("V_" + n) || 1); }
function mudou_(n) { PropertiesService.getScriptProperties().setProperty("V_" + n, String(Date.now())); }
function comTrava_(fn) { var l = LockService.getScriptLock(); if (!l.tryLock(20000)) throw new Error("Muitos pedidos agora. Tente de novo em alguns segundos."); try { return fn(); } finally { SpreadsheetApp.flush(); l.releaseLock(); } }

/* ---------------- avisos no celular (OneSignal, o mesmo app da Agenda Fácil) ---------------- */
var ONESIGNAL_APP = "7a1178de-2e8b-4205-aeb9-8171f97fb614";
function pushGuardar_(chave, sub) {
  sub = String(sub || "").trim(); if (!/^[0-9a-zA-Z-]{20,80}$/.test(sub)) throw new Error("Aparelho inválido.");
  var P = PropertiesService.getScriptProperties(), k = "PS_" + chave, o = { s: [] };
  try { o = JSON.parse(P.getProperty(k) || '{"s":[]}'); } catch (x) {}
  var l = (o.s || []).filter(function (s) { return s !== sub; }); l.push(sub);
  P.setProperty(k, JSON.stringify({ s: l.slice(-5), t: Date.now() }));
}
function pushChave_() { return String(cfgVal_("push_chave") || "").trim(); }
function push_(chaves, titulo, texto, url) {
  try {
    var key = pushChave_(); if (!key) return;
    var subs = []; chaves.forEach(function (c) { try { (JSON.parse(PropertiesService.getScriptProperties().getProperty("PS_" + c) || '{"s":[]}').s || []).forEach(function (s) { if (subs.indexOf(s) < 0) subs.push(s); }); } catch (x) {} });
    if (!subs.length) return;
    var corpo = { app_id: ONESIGNAL_APP, target_channel: "push", include_subscription_ids: subs, headings: { en: String(titulo).slice(0, 80) }, contents: { en: String(texto).slice(0, 200) },
      chrome_web_icon: "https://dayia.com.br/pedido/icon-192.png", ttl: 86400 };
    if (url) corpo.url = url;
    var r = UrlFetchApp.fetch("https://api.onesignal.com/notifications?c=push", { method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { Authorization: (/^os_v2_/.test(key) ? "Key " : "Basic ") + key }, payload: JSON.stringify(corpo) });
    if (r.getResponseCode() >= 300) console.log("aviso push recusado: " + r.getResponseCode() + " " + r.getContentText().slice(0, 300));
  } catch (x) { console.log("aviso push não enviado: " + x); }
}
function testarAviso() {
  var key = pushChave_(); if (!key) return "Falta colar a chave do OneSignal na aba Config (linha push_chave).";
  var r = UrlFetchApp.fetch("https://api.onesignal.com/notifications?c=push", { method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { Authorization: (/^os_v2_/.test(key) ? "Key " : "Basic ") + key }, payload: JSON.stringify({ app_id: ONESIGNAL_APP, target_channel: "push", include_subscription_ids: ["00000000-0000-0000-0000-000000000000"], contents: { en: "teste" } }) });
  var c = r.getResponseCode(), msg = (c === 401 || c === 403) ? "❌ A chave não foi aceita (" + c + "). Confira se copiou inteira." : "✅ Chave do OneSignal funcionando!";
  console.log(msg); return msg;
}

/* ---------------- utilidades ---------------- */
function txt_(v) { return (typeof v === "string" && v !== "") ? "'" + v : v; }
function txtRow_(r) { return r.map(txt_); }
function sim_(v) { return /^s/i.test(String(v).trim()); }
function lim_(v, n) { return String(v === undefined || v === null ? "" : v).trim().slice(0, n); }
function soDig_(t) { return String(t || "").replace(/\D/g, ""); }
function brl_(v) { return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ","); }
function esc_(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
