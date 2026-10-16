/* =====================================================================
   CATÁLOGO FÁCIL by DayIA  ·  servidor (Google Apps Script)
   ---------------------------------------------------------------------
   Catálogo digital com pedido pelo WhatsApp, painel da artesã,
   encomendas, clientes e promoções. UMA planilha para todas as
   lojas. Cada loja tem o próprio link e o próprio painel.
   Aba "Negocios", coluna situacao:
     teste · ativo · cortesia · suspenso   (igual à Agenda Fácil)
   Colunas plano / valor / vence / link_pagto: o plano de cada loja
   (aparece em "Meu plano" no painel dela).

   Instalação (uma vez só):
   1. Crie uma planilha Google em branco chamada "Catálogo Fácil"
      (na conta da DayIA: dayaraujoia@gmail.com).
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
  Negocios:  ["n","nome","situacao","teste_ate","criado","dono","whatsapp","email_aviso","senha","telefone","logo","titulo","subtitulo","aviso",
              "cats","faixas","brinde","redes","tipos","mkt","plano","valor","vence","link_pagto"],
  Pecas:     ["negocio","id","ordem","nome","cat","preco","desc","fotos","videos","campos","ativo","shopee","tiktok","criado"],
  Pedidos:   ["negocio","id","num","criado","quando","cliente_id","cliente","tel","email","aniv","tipo","entrega","itens","resumo","total","sinal","pago",
              "status","obs","anot","origem","chave","historico"],
  Clientes:  ["negocio","id","nome","tel","email","aniv","obs","origem","criado"],
  Promocoes: ["negocio","id","titulo","desc","alvo","ate","ativa"],
  Config:    ["chave","valor","explicacao"]
};
var MIN = 60000, DIA = 86400000;
var STATUS = { novo: "Recebido", sinal: "Sinal pago", producao: "Produzindo", acabamento: "Finalizando", pronto: "Pronto", entregue: "Entregue", cancelado: "Cancelado" };
var ABERTOS = ["novo", "sinal", "producao", "acabamento", "pronto"];
var FAIXAS_PADRAO = [{ min: 1, desc: 0 }, { min: 30, desc: 0.10 }, { min: 50, desc: 0.15 }, { min: 100, desc: 0.20 }];
var MKT_PADRAO = { limite: 20, hIni: 9, hFim: 19, descAniv: 10,
  msgAniv: "Olá, {nome}! 🎉 A {loja} deseja um feliz aniversário! Para comemorar, você ganha {desconto}% de desconto na sua próxima peça. É só me chamar aqui 💛" };

/* ---------------- instalação ---------------- */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Abra este script a partir da planilha (Extensões > Apps Script).");
  PropertiesService.getScriptProperties().setProperty("PLANILHA", ss.getId());
  Object.keys(ABAS).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (sh.getLastRow() === 0) { sh.appendRow(ABAS[nome]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, ABAS[nome].length).setFontWeight("bold").setBackground("#4E3D31").setFontColor("#FFFFFF"); }
  });
  var cfg = ss.getSheetByName("Config"), tem = cfg.getDataRange().getValues().map(function (r) { return r[0]; });
  [["dias_teste", "30", "Dias de teste grátis para loja nova"],
   ["email_admin", "", "Seu e-mail (opcional): recebe aviso de problemas"],
   ["whatsapp_dayia", "5519999389118", "WhatsApp que aparece quando o teste vence ou a loja está suspensa"],
   ["fuso_minutos", "-180", "Fuso horário (Brasília = -180). Não mexa."],
   ["proximo_id", "1", "Uso interno (não mexa)"],
   ["link_base", "", "Preenchido sozinho"],
   ["pasta_midia", "", "Preenchido sozinho (pasta do Drive com as fotos e vídeos)"],
   ["push_chave", "", "Chave do OneSignal (a mesma da Agenda Fácil, começa com os_v2_)"]
  ].forEach(function (p) { if (tem.indexOf(p[0]) < 0) cfg.appendRow([p[0], txt_(p[1]), p[2]]); });
  cfg.autoResizeColumns(1, 3);
  if (!negocio_("bab-atelie", true)) criarBab_();
  var sobra = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
  if (sobra && sobra.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(sobra);
  pasta_();
  MailApp.getRemainingDailyQuota();
  return "Pronto! Agora faça a implantação como App da Web.";
}
var FOTOS_BASE = "https://dailva123.github.io/dayia/catalogo/app/";
var CATS_BAB = [["lacos", "Laços e tiaras"], ["canetas", "Canetas"], ["topos", "Topos de bolo"], ["cadernetas", "Cadernetas"], ["documentos", "Porta-documentos"], ["bolsas", "Bolsas"]];
var PECAS_BAB = [{"id": "laco-trio", "ordem": 1, "nome": "Trio de laços", "cat": "lacos", "preco": 35, "desc": "Trio encantador e básico. Você escolhe a cor principal.", "fotos": ["demo/laco-trio.jpg"], "videos": [], "campos": {"cor": 1}}, {"id": "tiara-encantada", "ordem": 2, "nome": "Tiara encantada", "cat": "lacos", "preco": 45, "desc": "Tiara com borboleta e florzinhas. Um encanto!", "fotos": ["demo/tiara1.jpg", "demo/tiara3.jpg"], "videos": ["demo/tiara.mp4"], "campos": {}}, {"id": "laco-organza", "ordem": 3, "nome": "Laço de organza preto", "cat": "lacos", "preco": 29, "desc": "Elegância que encanta em cada detalhe.", "fotos": ["demo/laco-preto.jpg"], "videos": [], "campos": {}}, {"id": "kit-lacos", "ordem": 4, "nome": "Kit de laços temático", "cat": "lacos", "preco": 39, "desc": "3 laços com cartela temática. Lindo para presentear.", "fotos": ["demo/kit-criancas.jpg"], "videos": [], "campos": {"cor": 1, "tema": 1, "lembr": 1}}, {"id": "caneta", "ordem": 5, "nome": "Caneta pompom personalizada", "cat": "canetas", "preco": 15, "desc": "Com o nome em letrinhas e pompom. A queridinha das lembrancinhas!", "fotos": ["demo/caneta.jpg", "demo/caneta2.jpg"], "videos": [], "campos": {"nome": 1, "cor": 1, "lembr": 1}}, {"id": "topo", "ordem": 6, "nome": "Topo de bolo personalizado", "cat": "topos", "preco": 45, "desc": "Com o nome, a idade e o tema da festa.", "fotos": ["demo/topo-alice.jpg", "demo/topo-stitch.jpg"], "videos": [], "campos": {"nome": 1, "idade": 1, "tema": 1}}, {"id": "cad-safari", "ordem": 7, "nome": "Caderneta de saúde · Safari", "cat": "cadernetas", "preco": 65, "desc": "Capa dura com o nome do bebê e os bichinhos do safari.", "fotos": ["demo/cad-oliver.jpg"], "videos": [], "campos": {"nome": 1}}, {"id": "cad-floral", "ordem": 8, "nome": "Caderneta de saúde · Floral", "cat": "cadernetas", "preco": 65, "desc": "Capa dura floral com coração e o nome do bebê.", "fotos": ["demo/cad-rebeca.jpg"], "videos": [], "campos": {"nome": 1}}, {"id": "cad-cereja", "ordem": 9, "nome": "Caderneta · Cerejinha", "cat": "cadernetas", "preco": 65, "desc": "Estampa cerejinha com o nome.", "fotos": ["demo/cad-livia.jpg"], "videos": [], "campos": {"nome": 1}}, {"id": "cad-carrinho", "ordem": 10, "nome": "Caderneta de saúde · Carrinho", "cat": "cadernetas", "preco": 65, "desc": "Delicada, com carrinho de bebê.", "fotos": ["demo/cad-carrinho.jpg"], "videos": [], "campos": {"nome": 1}}, {"id": "bolsa-bege", "ordem": 11, "nome": "Bolsa na tela · Bege", "cat": "bolsas", "preco": 189, "desc": "Feita à mão, com alça de mão e corrente dourada. Estilo e elegância para o dia a dia.", "fotos": ["demo/bolsa-bege1.jpg", "demo/bolsa-bege2.jpg"], "videos": [], "campos": {}}, {"id": "bolsa-preta", "ordem": 12, "nome": "Bolsa na tela · Preta", "cat": "bolsas", "preco": 189, "desc": "Feita à mão, com fecho dourado e alça trançada.", "fotos": ["demo/bolsa-preta.jpg"], "videos": [], "campos": {}}, {"id": "bolsa-rose", "ordem": 13, "nome": "Bolsa na tela · Rosê", "cat": "bolsas", "preco": 179, "desc": "Feita à mão, com corrente dourada.", "fotos": ["demo/bolsa-rose.jpg"], "videos": [], "campos": {}}, {"id": "bolsa-bordo", "ordem": 14, "nome": "Bolsa na tela · Bordô e dourada", "cat": "bolsas", "preco": 199, "desc": "Feita à mão, com corrente e fecho dourados.", "fotos": ["demo/bolsa-bordo.jpg"], "videos": [], "campos": {}}, {"id": "bolsa-vermelha", "ordem": 15, "nome": "Bolsa na tela · Vermelha com alça", "cat": "bolsas", "preco": 189, "desc": "Feita à mão, com alça trançada e corrente dourada.", "fotos": ["demo/b-vermelha.jpg"], "videos": [], "campos": {}}, {"id": "bolsa-nude", "ordem": 16, "nome": "Bolsa na tela · Nude e branca", "cat": "bolsas", "preco": 179, "desc": "Feita à mão, em zigue-zague, com corrente dourada.", "fotos": ["demo/b-nude.jpg"], "videos": [], "campos": {}}, {"id": "bolsa-royal", "ordem": 17, "nome": "Bolsa na tela · Azul royal", "cat": "bolsas", "preco": 199, "desc": "Feita à mão, com alça trançada e corrente prateada.", "fotos": ["demo/b-azul.jpg"], "videos": [], "campos": {}}, {"id": "bolsa-pink", "ordem": 18, "nome": "Bolsa na tela · Pink", "cat": "bolsas", "preco": 179, "desc": "Feita à mão, com corrente dourada.", "fotos": ["demo/b-pink.jpg"], "videos": [], "campos": {}}, {"id": "bolsa-verm-zig", "ordem": 19, "nome": "Bolsa na tela · Vermelha e branca", "cat": "bolsas", "preco": 179, "desc": "Feita à mão, em zigue-zague, com corrente dourada.", "fotos": ["demo/b-verm-zig.jpg"], "videos": [], "campos": {}}, {"id": "porta-doc", "ordem": 20, "nome": "Porta-documentos personalizado", "cat": "documentos", "preco": 55, "desc": "Para guardar os documentos com o nome e o tema que você escolher.", "fotos": ["demo/porta-pedro.jpg"], "videos": [], "campos": {"nome": 1, "tema": 1}}];
function criarBab_() {
  inserir_("Negocios", {
    n: "bab-atelie", nome: "B.A.B Ateliê", situacao: "teste", teste_ate: legivel_(Date.now() + (Number(cfgVal_("dias_teste")) || 30) * DIA).slice(0, 10),
    criado: legivel_(Date.now()), dono: "B.A.B Ateliê", whatsapp: "5519996977016", email_aviso: "", senha: hash_("1234"), telefone: "(19) 99697-7016",
    logo: "", titulo: "Laços, tiaras, bolsas e papelaria personalizada ✨", subtitulo: "Escolha, personalize do seu jeito e envie o pedido prontinho pelo WhatsApp.",
    aviso: "", cats: JSON.stringify(CATS_BAB), faixas: JSON.stringify(FAIXAS_PADRAO),
    brinde: JSON.stringify({ cada: 100, txt: "maleta para guardar seus laços", txtPl: "maletas para guardar seus laços", img: FOTOS_BASE + "demo/maleta.jpg" }),
    redes: JSON.stringify({ instagram: "https://www.instagram.com/bab.atelie" }), tipos: "Retirada,Entrega,Correios", mkt: JSON.stringify(MKT_PADRAO),
    plano: "", valor: "", vence: "", link_pagto: ""
  });
  var agora = Date.now();
  PECAS_BAB.forEach(function (p, i) {
    inserir_("Pecas", { negocio: "bab-atelie", id: p.id, ordem: i + 1, nome: p.nome, cat: p.cat, preco: p.preco, desc: p.desc,
      fotos: JSON.stringify(p.fotos.map(function (f) { return FOTOS_BASE + f; })), videos: JSON.stringify((p.videos || []).map(function (f) { return FOTOS_BASE + f; })),
      campos: JSON.stringify(p.campos || {}), ativo: "SIM", shopee: "", tiktok: "", criado: agora + i });
  });
}

/* ---------------- entrada ---------------- */
function doGet(e) { var p = (e && e.parameter) || {}; if (p.acao) return responder_(executar_(p)); return ContentService.createTextOutput("Catálogo Fácil by DayIA · servidor funcionando (versão " + VERSAO_SISTEMA + ")."); }
function doPost(e) { var d = {}; try { d = JSON.parse(e.postData.contents || "{}"); } catch (x) { return responder_({ erro: "Pedido inválido." }); } return responder_(executar_(d)); }
function responder_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function executar_(d) { try { var f = ACOES[d.acao]; if (!f) return { erro: "Ação desconhecida." }; return f(d); } catch (x) { return { erro: String(x && x.message || x) }; } }

var ACOES = {
  ping: function () { return { ok: true, versao: VERSAO_SISTEMA }; },

  /* ======== CATÁLOGO DA CLIENTE ======== */
  info: function (d) {
    var N = negocio_(d.n), L = liberado_(N);
    if (!L.ok) return { ok: true, bloqueado: true, negocio: { nome: String(N.nome), logo: String(N.logo || "") }, whatsapp: L.whatsapp };
    return { ok: true, negocio: publicoNeg_(N), pecas: pecas_(N.n).filter(function (p) { return p.ativo; }), promos: promosAtivas_(N.n), agora: Date.now(), fuso: fuso_() };
  },
  pedir: function (d) {
    var N = negocio_(d.n);
    if (!liberado_(N).ok) throw new Error("Os pedidos pelo catálogo estão indisponíveis no momento.");
    var c = d.dados || {};
    if (!lim_(c.nome, 80)) throw new Error("Coloque o seu nome.");
    if (soDig_(c.tel).length < 10) throw new Error("Coloque o seu WhatsApp com DDD.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lim_(c.email, 120))) throw new Error("Coloque um e-mail válido para receber a confirmação.");
    var calc = calcular_(N, c.itens || []);
    if (!calc.itens.length) throw new Error("Escolha pelo menos uma peça.");
    return comTrava_(function () {
      var id = proximoId_(), agora = Date.now();
      calc.itens.forEach(function (it, i) { var orig = (c.itens || [])[it._i] || {}; if (orig.foto && orig.foto.dados) it.foto_id = salvarArquivo_(N, orig.foto, "pedido" + id + "_" + (i + 1), false); delete it._i; });
      var cli = clienteUpsert_(N.n, { nome: c.nome, tel: c.tel, email: c.email, aniv: anivDe_(c.aniv) }, "pedido");
      var p = { negocio: N.n, id: id, num: proximoNum_(N.n), criado: agora, quando: legivel_(agora), cliente_id: cli.id, cliente: lim_(c.nome, 80), tel: lim_(c.tel, 30), email: lim_(c.email, 120),
        aniv: anivDe_(c.aniv), tipo: lim_(c.tipo, 30) || "Retirada", entrega: dataIso_(c.entrega), itens: JSON.stringify(calc.itens), resumo: calc.resumo, total: calc.total, sinal: 0, pago: "",
        status: "novo", obs: lim_(c.obs, 400), anot: "", origem: "catalogo", chave: Utilities.getUuid().replace(/-/g, "").slice(0, 10), historico: JSON.stringify([{ s: "novo", t: agora }]) };
      inserir_("Pedidos", p);
      if (d.base) setCfg_("link_base", String(d.base).split("?")[0].split("#")[0]);
      mudou_(N.n);
      avisarNegocio_(N, p);
      emailCliente_(N, p, "novo");
      push_(["N_" + N.n], "🛎️ Pedido novo #" + p.num + " · " + p.cliente, brl_(p.total) + " · " + p.resumo, linkPainel_(N));
      return { ok: true, pedido: publico_(p), chave: p.chave };
    });
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

  /* ======== PAINEL DA ARTESÃ ======== */
  entrar: function (d) {
    var N = negocio_(d.n);
    if (!confereSenha_(N, String(d.senha || ""))) throw new Error("Senha incorreta.");
    return { ok: true, token: novoToken_(N.n) };
  },
  sair: function (d) { encerrarSessao_(d.token); return { ok: true }; },
  versao: function (d) { var n = sessao_(d); return { ok: true, v: versao_(n) }; },
  painel: function (d) {
    var n = sessao_(d), N = negocio_(n), desde = Date.now() - 400 * DIA;
    var lista = pedidos_(n).filter(function (p) { return p.criado >= desde || ABERTOS.indexOf(p.status) >= 0; });
    return { ok: true, v: versao_(n), negocio: completoNeg_(N), pecas: pecas_(n), pedidos: lista.map(function (p) { return publico_(p, true); }),
      clientes: clientes_(n), promos: promos_(n), envios: envioEstado_(n, N), licenca: liberado_(N), hoje: hojeIso_() };
  },
  status: function (d) {
    var n = sessao_(d), N = negocio_(n);
    return comTrava_(function () {
      var p = pedidos_(n).filter(function (x) { return x.id === Number(d.id); })[0];
      if (!p) throw new Error("Encomenda não encontrada.");
      var campos = {};
      if (d.status && STATUS[d.status] && d.status !== p.status) { campos.status = d.status; var h = hist_(p); h.push({ s: d.status, t: Date.now() }); campos.historico = JSON.stringify(h); if (d.status === "entregue") campos.pago = "SIM"; }
      if (d.pago !== undefined) campos.pago = d.pago ? "SIM" : "";
      if (d.sinal !== undefined) campos.sinal = num_(d.sinal);
      if (d.total !== undefined && num_(d.total) > 0) campos.total = num_(d.total);
      if (d.entrega !== undefined) campos.entrega = dataIso_(d.entrega);
      if (d.tipo !== undefined) campos.tipo = lim_(d.tipo, 30);
      if (d.anot !== undefined) campos.anot = lim_(d.anot, 600);
      atualizar_("Pedidos", function (o) { return Number(o.id) === p.id; }, campos); mudou_(n);
      if (campos.status) {
        Object.keys(campos).forEach(function (k) { p[k] = campos[k]; });
        push_(["C_" + n + "_" + p.id], String(N.nome), avisoCli_(p), linkCli_(N, p));
        if (["sinal", "pronto", "entregue", "cancelado"].indexOf(campos.status) >= 0) emailCliente_(N, p, campos.status);
      }
      return { ok: true };
    });
  },
  novaEncomenda: function (d) {
    var n = sessao_(d), e = d.dados || {};
    if (!lim_(e.nome, 80)) throw new Error("Coloque o nome da cliente.");
    if (!lim_(e.itens, 400)) throw new Error("Escreva o que ela pediu.");
    var total = num_(e.total); if (!(total > 0)) throw new Error("Coloque o valor da encomenda.");
    return comTrava_(function () {
      var cli = clienteUpsert_(n, { nome: e.nome, tel: e.tel }, "manual"), agora = Date.now(), sinal = num_(e.sinal), st = sinal > 0 ? "sinal" : "novo";
      var p = { negocio: n, id: proximoId_(), num: proximoNum_(n), criado: agora, quando: legivel_(agora), cliente_id: cli.id, cliente: lim_(e.nome, 80), tel: lim_(e.tel, 30), email: "", aniv: "",
        tipo: lim_(e.tipo, 30) || "Retirada", entrega: dataIso_(e.entrega), itens: JSON.stringify([{ nome: lim_(e.itens, 400), q: 1, total: total }]), resumo: lim_(e.itens, 120), total: total, sinal: sinal, pago: "",
        status: st, obs: "", anot: "", origem: "whatsapp", chave: Utilities.getUuid().replace(/-/g, "").slice(0, 10), historico: JSON.stringify([{ s: st, t: agora }]) };
      inserir_("Pedidos", p); mudou_(n);
      return { ok: true, id: p.id };
    });
  },
  verFoto: function (d) {
    var n = sessao_(d), p = pedidos_(n).filter(function (x) { return x.id === Number(d.id); })[0];
    var it = p && itens_(p)[Number(d.i)];
    if (!it || !it.foto_id) throw new Error("Esta peça não tem foto da cliente.");
    var f = DriveApp.getFileById(String(it.foto_id)), b = f.getBlob();
    return { ok: true, tipo: b.getContentType(), dados: Utilities.base64Encode(b.getBytes()), nome: f.getName() };
  },
  subirMidia: function (d) {
    var n = sessao_(d), N = negocio_(n), a = d.arquivo || {};
    var video = /^video\//.test(String(a.tipo || ""));
    var id = salvarArquivo_(N, a, (video ? "video_" : "foto_") + soDig_(legivel_(Date.now())), true);
    return { ok: true, ref: "d:" + id };
  },
  salvarPeca: function (d) {
    var n = sessao_(d), x = d.peca || {};
    var nome = lim_(x.nome, 80); if (!nome) throw new Error("Coloque o nome da peça.");
    var preco = num_(x.preco); if (!(preco > 0)) throw new Error("Coloque o preço da peça.");
    var fotos = (x.fotos || []).map(function (f) { return lim_(f, 400); }).filter(String).slice(0, 30);
    if (!fotos.length) throw new Error("Coloque pelo menos uma foto.");
    var campos = {}; ["nome", "cor", "tema", "idade", "data", "foto", "glitter", "lembr", "modelo"].forEach(function (k) { if (x.campos && x.campos[k]) campos[k] = 1; });
    var o = { nome: nome, cat: lim_(x.cat, 40), preco: preco, desc: lim_(x.desc, 300), fotos: JSON.stringify(fotos),
      videos: JSON.stringify((x.videos || []).map(function (f) { return lim_(f, 400); }).filter(String).slice(0, 6)), campos: JSON.stringify(campos),
      ativo: x.ativo === false ? "NÃO" : "SIM", shopee: url_(x.shopee), tiktok: url_(x.tiktok) };
    return comTrava_(function () {
      var existe = x.id && pecas_(n).filter(function (p) { return p.id === String(x.id); })[0];
      if (existe) atualizar_("Pecas", function (r) { return String(r.negocio).toLowerCase() === n && String(r.id) === existe.id; }, o);
      else { o.negocio = n; o.id = "p" + uid_(); o.ordem = 0; o.criado = Date.now(); inserir_("Pecas", o); }
      mudou_(n); return { ok: true };
    });
  },
  esconderPeca: function (d) {
    var n = sessao_(d);
    atualizar_("Pecas", function (r) { return String(r.negocio).toLowerCase() === n && String(r.id) === String(d.id); }, { ativo: d.ativo ? "SIM" : "NÃO" }); mudou_(n);
    return { ok: true };
  },
  excluirPeca: function (d) {
    var n = sessao_(d);
    excluir_("Pecas", function (r) { return String(r.negocio).toLowerCase() === n && String(r.id) === String(d.id); }); mudou_(n);
    return { ok: true };
  },
  salvarCliente: function (d) {
    var n = sessao_(d), c = d.cliente || {};
    if (!lim_(c.nome, 80)) throw new Error("Coloque o nome.");
    var o = { nome: lim_(c.nome, 80), tel: telNorm_(c.tel), email: lim_(c.email, 120), aniv: anivDe_(c.aniv), obs: lim_(c.obs, 400) };
    return comTrava_(function () {
      if (c.id) { atualizar_("Clientes", function (r) { return String(r.negocio).toLowerCase() === n && String(r.id) === String(c.id); }, o);
        atualizar_("Pedidos", function (r) { return String(r.negocio).toLowerCase() === n && String(r.cliente_id) === String(c.id); }, { cliente: o.nome, tel: o.tel }); }
      else { o.negocio = n; o.id = "c" + uid_(); o.origem = "manual"; o.criado = Date.now(); inserir_("Clientes", o); }
      mudou_(n); return { ok: true };
    });
  },
  excluirCliente: function (d) {
    var n = sessao_(d);
    excluir_("Clientes", function (r) { return String(r.negocio).toLowerCase() === n && String(r.id) === String(d.id); }); mudou_(n);
    return { ok: true };
  },
  importarClientes: function (d) {
    var n = sessao_(d), lista = (d.lista || []).slice(0, 2000);
    return comTrava_(function () {
      var atuais = clientes_(n), tels = {}, novos = 0, rep = 0, agora = Date.now();
      atuais.forEach(function (c) { if (c.tel) tels[c.tel] = 1; });
      var linhas = [];
      lista.forEach(function (x) {
        var nome = lim_(x.nome, 80), tel = telNorm_(x.tel); if (!nome && !tel) return;
        if (tel && tels[tel]) { rep++; return; }
        if (tel) tels[tel] = 1; novos++;
        linhas.push({ negocio: n, id: "c" + uid_(), nome: nome || tel, tel: tel, email: "", aniv: anivDe_(x.aniv), obs: "", origem: "importado", criado: agora });
      });
      inserirVarios_("Clientes", linhas); mudou_(n);
      return { ok: true, novos: novos, repetidos: rep };
    });
  },
  salvarPromo: function (d) {
    var n = sessao_(d), x = d.promo || {};
    var t = lim_(x.titulo, 60), ds = Math.round(num_(x.desc)), ate = dataIso_(x.ate);
    if (!t || ds < 1 || ds > 90 || !ate) throw new Error("Preencha o nome, um desconto entre 1% e 90% e a data.");
    var o = { titulo: t, desc: ds, alvo: lim_(x.alvo, 40) || "todas", ate: ate, ativa: x.ativa === false ? "NÃO" : "SIM" };
    if (x.id) atualizar_("Promocoes", function (r) { return String(r.negocio).toLowerCase() === n && String(r.id) === String(x.id); }, o);
    else { o.negocio = n; o.id = "r" + uid_(); inserir_("Promocoes", o); }
    mudou_(n); return { ok: true };
  },
  excluirPromo: function (d) {
    var n = sessao_(d);
    excluir_("Promocoes", function (r) { return String(r.negocio).toLowerCase() === n && String(r.id) === String(d.id); }); mudou_(n);
    return { ok: true };
  },
  envio: function (d) {
    var n = sessao_(d), N = negocio_(n), m = mkt_(N), P = PropertiesService.getScriptProperties();
    return comTrava_(function () {
      var e = envioRaw_(n), hoje = hojeIso_(), hr = Math.floor(minutosHoje_(Date.now()) / 60);
      if (e.dia !== hoje) { e.dia = hoje; e.n = 0; }
      if (e.n >= m.limite) throw new Error("Você chegou ao limite de " + m.limite + " mensagens de hoje. Continue amanhã: isso protege o seu WhatsApp.");
      if (hr < m.hIni || hr >= m.hFim) throw new Error("Fora do horário de envio (" + m.hIni + "h às " + m.hFim + "h).");
      if (Date.now() - (e.ultimo || 0) < 15000) throw new Error("Aguarde alguns segundos antes do próximo envio.");
      var k = lim_(d.chave, 40) + "|" + lim_(d.cliente, 20);
      if (e.env[k]) throw new Error("Essa mensagem já foi enviada para essa cliente.");
      e.n++; e.ultimo = Date.now(); e.env[k] = hoje;
      var ks = Object.keys(e.env); if (ks.length > 800) ks.slice(0, ks.length - 800).forEach(function (x) { delete e.env[x]; });
      P.setProperty("EV_" + n, JSON.stringify(e));
      return { ok: true, envios: envioEstado_(n, N) };
    });
  },
  salvarAjustes: function (d) {
    var n = sessao_(d), a = d.ajustes || {}, m = {};
    ["nome", "titulo", "subtitulo", "aviso", "telefone", "email_aviso"].forEach(function (k) { if (a[k] !== undefined) m[k] = lim_(a[k], 200); });
    if (a.whatsapp !== undefined) m.whatsapp = soDig_(a.whatsapp);
    if (a.tipos !== undefined) m.tipos = (a.tipos || []).map(function (t) { return lim_(t, 30).replace(/,/g, " "); }).filter(String).join(",");
    if (a.cats !== undefined) { var cs = (a.cats || []).map(function (c) { return [lim_(c[0], 30) || uid_(), lim_(c[1], 40)]; }).filter(function (c) { return c[1]; }); if (!cs.length) throw new Error("Deixe pelo menos uma categoria."); m.cats = JSON.stringify(cs); }
    if (a.faixas !== undefined) m.faixas = JSON.stringify(faixasLimpa_(a.faixas));
    if (a.brinde !== undefined) { var b = a.brinde || {}; m.brinde = JSON.stringify({ cada: Math.max(0, num_(b.cada)), txt: lim_(b.txt, 80), txtPl: lim_(b.txtPl || b.txt, 80), img: lim_(b.img, 400) }); }
    if (a.redes !== undefined) { var r = {}; Object.keys(a.redes || {}).forEach(function (k) { var u = url_(a.redes[k]); if (u) r[lim_(k, 20)] = u; }); m.redes = JSON.stringify(r); }
    if (a.mkt !== undefined) { var x = a.mkt || {}, o = mkt_({});
      o.limite = Math.min(30, Math.max(5, Math.round(num_(x.limite)) || 20)); o.hIni = Math.min(12, Math.max(6, Math.round(num_(x.hIni)) || 9)); o.hFim = Math.min(22, Math.max(14, Math.round(num_(x.hFim)) || 19));
      o.descAniv = Math.min(90, Math.max(0, Math.round(num_(x.descAniv)))); o.msgAniv = lim_(x.msgAniv, 500) || MKT_PADRAO.msgAniv; m.mkt = JSON.stringify(o); }
    if (a.logo !== undefined) { if (String(a.logo).length > 45000) throw new Error("Logo grande demais."); m.logo = String(a.logo); }
    if (a.senha) { if (String(a.senha).length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres."); m.senha = hash_(a.senha); }
    atualizar_("Negocios", function (r) { return String(r.n).toLowerCase() === n; }, m); mudou_(n);
    return { ok: true };
  }
};

/* ---------------- regras de preço (iguais às do app) ---------------- */
function faixa_(F, q) { var f = { min: 1, desc: 0 }; (F || []).forEach(function (x) { if (q >= x.min) f = x; }); return f; }
function promoDe_(promos, p) { var best = null; (promos || []).forEach(function (r) { if ((r.alvo === "todas" || r.alvo === p.cat || r.alvo === p.id) && (!best || r.desc > best.desc)) best = r; }); return best; }
function precoItem_(p, q, F, promos) {
  var d = p.campos.lembr ? faixa_(F, q).desc : 0, pr = promoDe_(promos, p);
  return Math.round(p.preco * q * (1 - d) * (1 - (pr ? pr.desc / 100 : 0)) * 100) / 100;
}
function calcular_(N, itens) {
  var P = pecas_(N.n).filter(function (p) { return p.ativo; }), F = j_(N.faixas, FAIXAS_PADRAO), pr = promosAtivas_(N.n), out = [], tot = 0;
  itens.slice(0, 40).forEach(function (it, i) {
    var p = P.filter(function (x) { return x.id === String(it.id); })[0]; if (!p) return;
    var q = Math.max(1, Math.min(2000, Math.round(Number(it.q) || 1))), c = p.campos, v = precoItem_(p, q, F, pr);
    var o = { id: p.id, nome: p.nome, q: q, total: v, _i: i };
    if (c.nome) o.texto = lim_(it.texto, 60);
    if (c.idade) o.idade = lim_(it.idade, 6);
    if (c.tema) o.tema = lim_(it.tema, 60);
    if (c.data) o.data = lim_(it.data, 20);
    if (c.modelo) o.modelo = lim_(it.modelo, 40);
    if (c.cor) o.cor = lim_(it.cor, 30);
    if (c.glitter) o.glitter = lim_(it.glitter, 20);
    o.obs = lim_(it.obs, 200);
    if (c.foto && !(it.foto && it.foto.dados)) throw new Error("Falta a foto da peça " + p.nome + ".");
    out.push(o); tot += v;
  });
  return { itens: out, total: Math.round(tot * 100) / 100, resumo: out.map(function (i) { return i.q + "× " + i.nome; }).join(", ").slice(0, 300) };
}
function faixasLimpa_(F) {
  var l = (F || []).map(function (f) { return { min: Math.max(1, Math.round(num_(f.min))), desc: Math.min(0.9, Math.max(0, num_(f.desc))) }; }).sort(function (a, b) { return a.min - b.min; });
  if (!l.length || l[0].min !== 1) l.unshift({ min: 1, desc: 0 });
  return l.slice(0, 6);
}
function avisoCli_(p) {
  return { sinal: "✅ Sua encomenda #" + p.num + " foi confirmada", producao: "✂️ Sua encomenda #" + p.num + " está sendo produzida", acabamento: "✨ Sua encomenda #" + p.num + " está nos detalhes finais",
    pronto: "🎁 Sua encomenda #" + p.num + " está pronta!", entregue: "💛 Encomenda #" + p.num + " entregue. Obrigada!", cancelado: "❌ Sua encomenda #" + p.num + " foi cancelada" }[p.status] || "Sua encomenda foi atualizada";
}

/* ---------------- arquivos no Drive ---------------- */
function pasta_() {
  var id = cfgVal_("pasta_midia");
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var f = DriveApp.createFolder("Catálogo Fácil · Fotos e vídeos"); setCfg_("pasta_midia", f.getId()); return f;
}
function salvarArquivo_(N, arq, nome, publico) {
  var tipo = String(arq.tipo || "image/jpeg");
  if (!/^(image\/(jpeg|png|webp)|video\/(mp4|quicktime|webm|3gpp))$/.test(tipo)) throw new Error("Mande uma foto ou um vídeo.");
  var bytes = Utilities.base64Decode(String(arq.dados).replace(/^data:[^,]+,/, ""));
  var max = /^video/.test(tipo) ? 30 : 8;
  if (bytes.length > max * 1024 * 1024) throw new Error(/^video/.test(tipo) ? "Vídeo grande demais (máximo 30 MB, uns 40 segundos)." : "Foto grande demais.");
  var ext = { "image/png": ".png", "image/webp": ".webp", "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "video/3gpp": ".3gp" }[tipo] || ".jpg";
  var f = pasta_().createFile(Utilities.newBlob(bytes, tipo, N.n + "_" + nome + ext));
  if (publico) { try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) { console.log("compartilhar: " + x); } }
  return f.getId();
}

/* ---------------- e-mails ---------------- */
function itemDet_(i) { return [i.texto && "Nome: " + i.texto, i.idade && "Idade: " + i.idade, i.tema && "Tema: " + i.tema, i.data && "Data: " + i.data, i.cor && "Cor: " + i.cor + (i.glitter ? " (" + i.glitter + ")" : ""), i.modelo && "Celular: " + i.modelo, i.foto_id && "Foto enviada ✅", i.obs].filter(Boolean); }
function itensHtml_(p) {
  return "<table style='border-collapse:collapse;width:100%;max-width:520px'>" + itens_(p).map(function (i) {
    return "<tr><td style='padding:6px 0;border-bottom:1px solid #eee'><b>" + i.q + "× " + esc_(i.nome) + "</b>" + itemDet_(i).map(function (x) { return "<br><span style='color:#6b5d52'>" + esc_(x) + "</span>"; }).join("") +
      "</td><td style='text-align:right;border-bottom:1px solid #eee'>" + brl_(i.total) + "</td></tr>"; }).join("") +
    "<tr><td style='padding:6px 0'><b>Total estimado</b></td><td style='text-align:right'><b>" + brl_(p.total) + "</b></td></tr></table>";
}
function avisarNegocio_(N, p) {
  if (!/@/.test(N.email_aviso || "")) return;
  var lk = linkPainel_(N);
  enviar_(String(N.email_aviso), "🛎️ Pedido novo #" + p.num + " · " + p.cliente + " · " + brl_(p.total),
    "<h2 style='margin:0 0 8px'>Pedido novo #" + p.num + "</h2><p><b>" + esc_(p.cliente) + "</b> · WhatsApp " + esc_(p.tel) + "<br>E-mail: " + esc_(p.email) + "<br>Receber por: " + esc_(p.tipo) +
    (p.entrega ? "<br>Precisa para: " + dataBr_(p.entrega) : "") + (p.obs ? "<br>Recado: " + esc_(p.obs) : "") + "</p>" + itensHtml_(p) +
    (lk ? "<p><a href='" + lk + "' style='background:#4E3D31;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Abrir o painel</a></p>" : ""), String(N.nome));
}
function emailCliente_(N, p, tipo) {
  if (!/@/.test(p.email || "")) return;
  var tit = { novo: "Recebemos seu pedido #" + p.num + " 💛", sinal: "Sua encomenda #" + p.num + " foi confirmada", pronto: "Sua encomenda #" + p.num + " está pronta!", entregue: "Obrigada pela compra!", cancelado: "Encomenda #" + p.num + " cancelada" }[tipo] || "Encomenda #" + p.num;
  var txt = { novo: "A " + N.nome + " recebeu o seu pedido. Em breve ela confirma o valor final e o prazo pelo WhatsApp.", pronto: "Sua encomenda está prontinha. Combine a " + (/retir/i.test(p.tipo) ? "retirada" : "entrega") + " pelo WhatsApp." }[tipo] || "";
  var lk = linkCli_(N, p);
  enviar_(p.email, tit + " · " + N.nome,
    "<p>Olá, " + esc_(String(p.cliente).split(" ")[0]) + "!</p><p><b>" + esc_(tit) + "</b>" + (txt ? "<br>" + esc_(txt) : "") + "</p>" + itensHtml_(p) +
    (lk ? "<p><a href='" + lk + "' style='background:#4E3D31;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Acompanhar meu pedido</a></p>" : "") +
    "<p style='color:#8A7A6E'>" + esc_(N.nome) + (N.telefone ? " · " + esc_(N.telefone) : "") + "<br>Obrigada!</p>", String(N.nome));
}
function enviar_(para, assunto, html, nome) {
  try { if (MailApp.getRemainingDailyQuota() < 1) return; MailApp.sendEmail({ to: para, subject: assunto, htmlBody: "<div style='font-family:Arial,sans-serif;color:#3E322A;font-size:14px'>" + html + "</div>", name: nome || "Catálogo Fácil" }); }
  catch (x) { console.log("e-mail não enviado: " + x); }
}

/* ---------------- negócio e licença ---------------- */
function negocio_(n, semErro) {
  n = String(n || "").toLowerCase().trim();
  var N = linhas_("Negocios").filter(function (x) { return String(x.n).toLowerCase() === n; })[0];
  if (!N && !semErro) throw new Error("Catálogo não encontrado. Confira o link.");
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
function mkt_(N) { var m = j_(N.mkt, {}), o = {}; Object.keys(MKT_PADRAO).forEach(function (k) { o[k] = m[k] !== undefined && m[k] !== "" ? m[k] : MKT_PADRAO[k]; }); return o; }
function publicoNeg_(N) {
  return { n: N.n, nome: String(N.nome), whats: soDig_(N.whatsapp), tel: String(N.telefone || ""), logo: String(N.logo || ""), titulo: String(N.titulo || ""), subtitulo: String(N.subtitulo || ""),
    aviso: String(N.aviso || ""), cats: j_(N.cats, []), faixas: j_(N.faixas, FAIXAS_PADRAO), brinde: j_(N.brinde, {}), redes: j_(N.redes, {}),
    tipos: String(N.tipos || "Retirada,Entrega").split(",").map(function (s) { return s.trim(); }).filter(String) };
}
function completoNeg_(N) {
  var o = publicoNeg_(N); o.email_aviso = String(N.email_aviso || ""); o.whatsapp = String(N.whatsapp || ""); o.mkt = mkt_(N);
  o.plano = { plano: String(N.plano || ""), valor: String(N.valor || ""), vence: N.vence ? dataBr_(dataIso_(N.vence) || String(N.vence)) : "", link: String(N.link_pagto || ""), situacao: String(N.situacao || ""), teste_ate: N.teste_ate ? String(legivel_(dataDe_(N.teste_ate))).slice(0, 10) : "" };
  return o;
}
function confereSenha_(N, senha) {
  var s = String(N.senha || "");
  if (/^[0-9a-f]{64}$/.test(s)) return hash_(senha) === s;
  if (s !== "" && s === senha) { atualizar_("Negocios", function (r) { return String(r.n).toLowerCase() === N.n; }, { senha: hash_(senha) }); return true; }
  return false;
}
function hash_(s) { var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "catalogofacil:" + String(s), Utilities.Charset.UTF_8); return b.map(function (x) { return ("0" + ((x + 256) % 256).toString(16)).slice(-2); }).join(""); }

/* ---------------- peças, clientes, promoções ---------------- */
function pecas_(n) {
  return linhas_("Pecas").filter(function (p) { return String(p.negocio).toLowerCase() === n; }).map(function (p) {
    return { id: String(p.id), ordem: Number(p.ordem) || 0, nome: String(p.nome), cat: String(p.cat), preco: Number(p.preco) || 0, desc: String(p.desc || ""), fotos: j_(p.fotos, []), videos: j_(p.videos, []),
      campos: j_(p.campos, {}), ativo: !/^n/i.test(String(p.ativo)), shopee: String(p.shopee || ""), tiktok: String(p.tiktok || ""), criado: Number(p.criado) || 0 };
  }).sort(function (a, b) { return (a.ordem || 9999) - (b.ordem || 9999) || b.criado - a.criado; });
}
function clientes_(n) {
  return linhas_("Clientes").filter(function (c) { return String(c.negocio).toLowerCase() === n; }).map(function (c) {
    return { id: String(c.id), nome: String(c.nome), tel: soDig_(c.tel), email: String(c.email || ""), aniv: String(c.aniv || ""), obs: String(c.obs || ""), origem: String(c.origem || ""), criado: Number(c.criado) || 0 };
  });
}
function clienteUpsert_(n, c, origem) {
  var tel = telNorm_(c.tel), nome = lim_(c.nome, 80);
  var l = clientes_(n), x = l.filter(function (y) { return (tel && y.tel === tel) || (!tel && y.nome.toLowerCase() === nome.toLowerCase()); })[0];
  if (x) {
    var m = {}; if (tel) m.tel = tel; if (c.email) m.email = lim_(c.email, 120); if (c.aniv) m.aniv = c.aniv; if (nome && /^\d+$/.test(x.nome)) m.nome = nome;
    if (Object.keys(m).length) atualizar_("Clientes", function (r) { return String(r.negocio).toLowerCase() === n && String(r.id) === x.id; }, m);
    return x;
  }
  var o = { negocio: n, id: "c" + uid_(), nome: nome, tel: tel, email: lim_(c.email, 120), aniv: c.aniv || "", obs: "", origem: origem, criado: Date.now() };
  inserir_("Clientes", o); return o;
}
function promos_(n) {
  return linhas_("Promocoes").filter(function (r) { return String(r.negocio).toLowerCase() === n; }).map(function (r) {
    return { id: String(r.id), titulo: String(r.titulo), desc: Number(r.desc) || 0, alvo: String(r.alvo || "todas"), ate: dataIso_(r.ate), ativa: !/^n/i.test(String(r.ativa)) };
  });
}
function promosAtivas_(n) { var h = hojeIso_(); return promos_(n).filter(function (r) { return r.ativa && r.ate >= h; }); }
function envioRaw_(n) { var e = {}; try { e = JSON.parse(PropertiesService.getScriptProperties().getProperty("EV_" + n) || "{}"); } catch (x) {} e.env = e.env || {}; e.n = e.n || 0; return e; }
function envioEstado_(n, N) {
  var e = envioRaw_(n), m = mkt_(N), hoje = hojeIso_(), hr = Math.floor(minutosHoje_(Date.now()) / 60);
  return { n: e.dia === hoje ? e.n : 0, limite: m.limite, hIni: m.hIni, hFim: m.hFim, noHorario: hr >= m.hIni && hr < m.hFim, ultimo: e.ultimo || 0, env: e.env };
}

/* ---------------- pedidos ---------------- */
function pedidos_(n) {
  return linhas_("Pedidos").filter(function (p) { return String(p.negocio).toLowerCase() === n; }).map(function (p) {
    p.id = Number(p.id); p.num = Number(p.num); p.criado = Number(p.criado); p.total = Number(p.total) || 0; p.sinal = Number(p.sinal) || 0; p.status = String(p.status); return p; });
}
function itens_(p) { try { return JSON.parse(p.itens || "[]"); } catch (x) { return []; } }
function proximoNum_(n) { var mx = 100; pedidos_(n).forEach(function (p) { if (p.num > mx) mx = p.num; }); return mx + 1; }
function doCliente_(N, x) { var p = pedidos_(N.n).filter(function (y) { return y.id === Number(x.id); })[0]; if (!p || !x.chave || String(p.chave) !== String(x.chave)) throw new Error("Pedido não encontrado."); return p; }
function hist_(p) { try { return JSON.parse(p.historico || "[]"); } catch (x) { return []; } }
function publico_(p, painel) {
  var its = itens_(p).map(function (i) { var o = JSON.parse(JSON.stringify(i)); o.foto = !!o.foto_id; delete o.foto_id; return o; });
  var o = { id: p.id, num: p.num, criado: p.criado, cliente: String(p.cliente), tipo: String(p.tipo), entrega: dataIso_(p.entrega), itens: its, total: p.total, sinal: p.sinal,
    pago: sim_(p.pago), status: p.status, obs: String(p.obs || ""), historico: hist_(p), origem: String(p.origem || "") };
  if (painel) { o.tel = soDig_(p.tel); o.email = String(p.email || ""); o.aniv = String(p.aniv || ""); o.anot = String(p.anot || ""); o.cliente_id = String(p.cliente_id || ""); }
  return o;
}
function linkNeg_(N) { var b = cfgVal_("link_base"); return b ? b + "?n=" + encodeURIComponent(N.n) : ""; }
function linkPainel_(N) { var l = linkNeg_(N); return l ? l + "#painel" : ""; }
function linkCli_(N, p) { var l = linkNeg_(N); return l ? l + "&p=" + p.id + "&k=" + p.chave : ""; }

/* ---------------- planilha ---------------- */
function planilha_() { var id = PropertiesService.getScriptProperties().getProperty("PLANILHA"); return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); }
function aba_(n) { var sh = planilha_().getSheetByName(n); if (!sh) throw new Error("A aba " + n + " não existe. Rode a função configurar."); return sh; }
var LIN_ = {};
function linhas_(n) {
  if (LIN_[n]) return LIN_[n].map(function (o) { return Object.assign({}, o); });
  var v = aba_(n).getDataRange().getValues(), cab = v.shift();
  LIN_[n] = v.filter(function (r) { return r.join("") !== ""; }).map(function (r) { var o = {}; cab.forEach(function (c, i) { o[c] = r[i]; }); return o; });
  return LIN_[n].map(function (o) { return Object.assign({}, o); });
}
var CAB_ = {};
function cab_(n) { if (!CAB_[n]) { var sh = aba_(n); CAB_[n] = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String); } return CAB_[n]; }
function inserir_(n, o) { delete LIN_[n]; aba_(n).appendRow(txtRow_(cab_(n).map(function (c) { return o[c] === undefined || o[c] === null ? "" : o[c]; }))); }
function inserirVarios_(n, lista) {
  if (!lista.length) return; delete LIN_[n];
  var cab = cab_(n), sh = aba_(n), rows = lista.map(function (o) { return txtRow_(cab.map(function (c) { return o[c] === undefined || o[c] === null ? "" : o[c]; })); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, cab.length).setValues(rows);
}
function atualizar_(aba, filtro, campos) {
  if (!Object.keys(campos).length) return; delete LIN_[aba];
  var sh = aba_(aba), v = sh.getDataRange().getValues(), cab = v[0];
  for (var i = 1; i < v.length; i++) {
    var o = {}; cab.forEach(function (c, k) { o[c] = v[i][k]; });
    if (filtro(o)) Object.keys(campos).forEach(function (c) { var col = cab.indexOf(c); if (col >= 0) sh.getRange(i + 1, col + 1).setValue(txt_(campos[c])); });
  }
}
function excluir_(aba, filtro) {
  delete LIN_[aba];
  var sh = aba_(aba), v = sh.getDataRange().getValues(), cab = v[0];
  for (var i = v.length - 1; i >= 1; i--) { var o = {}; cab.forEach(function (c, k) { o[c] = v[i][k]; }); if (filtro(o)) sh.deleteRow(i + 1); }
}
function cfgVal_(k) { var r = linhas_("Config").filter(function (x) { return x.chave === k; })[0]; return r ? String(r.valor) : ""; }
function setCfg_(k, v) {
  delete LIN_.Config;
  var sh = aba_("Config"), d = sh.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) if (d[i][0] === k) { sh.getRange(i + 1, 2).setValue(txt_(String(v))); return; }
  sh.appendRow([k, txt_(String(v)), ""]);
}
function proximoId_() { var id = Number(cfgVal_("proximo_id")) || 1; setCfg_("proximo_id", id + 1); return id; }

/* ---------------- tempo ---------------- */
var FUSO_CACHE = null;
function fuso_() { if (FUSO_CACHE === null) FUSO_CACHE = Number(cfgVal_("fuso_minutos")) || -180; return FUSO_CACHE; }
function inicioDia_(t) { var off = fuso_() * MIN; return Math.floor((t + off) / DIA) * DIA - off; }
function minutosHoje_(t) { return Math.floor((t - inicioDia_(t)) / MIN); }
function hojeIso_() { return new Date(Date.now() + fuso_() * MIN).toISOString().slice(0, 10); }
function legivel_(t) { var d = new Date(t + fuso_() * MIN); var z = function (x) { return ("0" + x).slice(-2); }; return z(d.getUTCDate()) + "/" + z(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear() + " " + z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()); }
function dataDe_(v) {
  if (!v) return 0; if (v instanceof Date) return v.getTime();
  var m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]) - fuso_() * MIN;
  var t = Date.parse(v); return isNaN(t) ? 0 : t;
}
function dataIso_(v) {
  if (!v) return ""; if (v instanceof Date) return new Date(v.getTime() + fuso_() * MIN).toISOString().slice(0, 10);
  var s = String(v).trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  return "";
}
function dataBr_(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso || ""); }
function anivDe_(t) { t = String(t || ""); if (/^\d{2}-\d{2}$/.test(t)) return t; var m = t.match(/(\d{1,2})\D+(\d{1,2})/); if (!m) return ""; var d = +m[1], mo = +m[2]; if (d < 1 || d > 31 || mo < 1 || mo > 12) return ""; return ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2); }

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
function comTrava_(fn) { var l = LockService.getScriptLock(); if (!l.tryLock(20000)) throw new Error("Muitas pessoas usando agora. Tente de novo em alguns segundos."); try { return fn(); } finally { SpreadsheetApp.flush(); l.releaseLock(); } }

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
      chrome_web_icon: FOTOS_BASE + "icon-192.png", ttl: 86400 };
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
function telNorm_(t) { var n = soDig_(t).replace(/^0+/, ""); if (n.length === 10 || n.length === 11) n = "55" + n; return n.slice(0, 15); }
function num_(v) { var s = String(v === undefined || v === null ? "" : v).trim(); if (/,/.test(s)) s = s.replace(/\./g, "").replace(",", "."); return Number(s) || 0; }
function url_(u) { u = lim_(u, 400); if (!u || u === "#demo") return ""; return /^https?:\/\//i.test(u) ? u : "https://" + u; }
function uid_() { return Utilities.getUuid().replace(/-/g, "").slice(0, 8); }
function j_(s, def) { try { var v = JSON.parse(s); return v === null || v === undefined || v === "" ? def : v; } catch (x) { return def; } }
function brl_(v) { return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ","); }
function esc_(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
