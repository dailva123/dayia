/* =====================================================================
   DIVULGA FÁCIL by DayIA  ·  servidor (Google Apps Script)
   ---------------------------------------------------------------------
   UMA planilha só para todos os clientes. Cada cliente cria a própria
   conta no app (e-mail + senha) e ganha 7 dias grátis.
   Você controla tudo pela aba "Clientes" (coluna situacao):
     teste     → funciona até a data da coluna teste_ate
     ativo     → cliente pagante, funciona normalmente
     cortesia  → funciona sempre, sem cobrança e sem aviso
     suspenso  → o app mostra "fale com a DayIA"
   As postagens, mensagens e links de cada cliente ficam na aba "Dados"
   (não precisa mexer nela).

   Instalação (uma vez só):
   1. Crie uma planilha Google em branco chamada "Divulga Fácil".
   2. Extensões > Apps Script. Apague o que estiver lá e cole este arquivo.
   3. Selecione a função "configurar" e clique em Executar (autorize).
   4. Implantar > Nova implantação > App da Web
        Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
   5. Copie o endereço que termina em /exec e mande para a DayIA.
   ===================================================================== */

var VERSAO_SISTEMA = "1.0";
var PARTES = 20, TAM_PARTE = 45000;
var ABAS = {
  Clientes: ["id", "empresa", "nome", "whatsapp", "email", "senha", "situacao", "teste_ate", "criado", "ultimo_acesso", "observacao"],
  Dados: ["id", "atualizado"].concat((function () { var a = []; for (var i = 1; i <= PARTES; i++) a.push("parte" + i); return a; })()),
  Config: ["chave", "valor", "explicacao"]
};
var MIN = 60000, DIA = 86400000;

/* ---------------- instalação (uma vez só) ---------------- */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Abra este script a partir da planilha (Extensões > Apps Script).");
  PropertiesService.getScriptProperties().setProperty("PLANILHA", ss.getId());
  Object.keys(ABAS).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (sh.getLastRow() === 0) {
      sh.appendRow(ABAS[nome]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, ABAS[nome].length).setFontWeight("bold").setBackground("#0E2238").setFontColor("#FFFFFF");
    }
  });
  var cfg = ss.getSheetByName("Config");
  var padrao = [
    ["dias_teste", "7", "Quantos dias de teste grátis cada cliente novo ganha"],
    ["cadastro_aberto", "SIM", "SIM = qualquer pessoa pode criar a conta pelo app · NÃO = só você cadastra"],
    ["email_admin", "", "Seu e-mail: recebe aviso a cada cliente novo"],
    ["whatsapp_dayia", "5519999389118", "WhatsApp que aparece para quem estiver com o teste vencido ou suspenso"],
    ["fuso_minutos", "-180", "Fuso horário (Brasília = -180). Não mexa."]
  ];
  var tem = cfg.getDataRange().getValues().map(function (r) { return r[0]; });
  padrao.forEach(function (p) { if (tem.indexOf(p[0]) < 0) cfg.appendRow([p[0], txt_(p[1]), p[2]]); });
  cfg.autoResizeColumns(1, 3);
  var sobra = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
  if (sobra && sobra.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(sobra);
  MailApp.getRemainingDailyQuota();
  return "Pronto! Agora faça a implantação como App da Web.";
}

/* ---------------- entrada ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.acao) return responder_(executar_(p));
  return ContentService.createTextOutput("Divulga Fácil by DayIA · servidor funcionando (versão " + VERSAO_SISTEMA + ").");
}
function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents || "{}"); } catch (x) { return responder_({ erro: "Pedido inválido." }); }
  return responder_(executar_(d));
}
function responder_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function executar_(d) {
  try { var f = ACOES[d.acao]; if (!f) return { erro: "Ação desconhecida." }; return f(d); }
  catch (x) { return { erro: String(x && x.message || x) }; }
}

var ACOES = {
  ping: function () { return { ok: true, versao: VERSAO_SISTEMA, cadastro: sim_(cfgVal_("cadastro_aberto")) }; },

  cadastro: function (d) {
    if (!sim_(cfgVal_("cadastro_aberto"))) throw new Error("O cadastro está fechado no momento. Fale com a DayIA pelo WhatsApp.");
    var c = d.dados || {};
    var empresa = lim_(c.empresa, 60), nome = lim_(c.nome, 60), email = lim_(c.email, 120).toLowerCase(), senha = String(c.senha || "");
    var zap = lim_(c.whatsapp, 30);
    if (!empresa) throw new Error("Coloque o nome da sua empresa.");
    if (!nome) throw new Error("Coloque o seu nome.");
    if (zap.replace(/\D/g, "").length < 10) throw new Error("Coloque o seu WhatsApp com DDD.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Coloque um e-mail válido.");
    if (senha.length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres.");
    return comTrava_(function () {
      if (clientePorEmail_(email)) throw new Error("Já existe uma conta com este e-mail. Toque em \"Já tenho conta\" para entrar.");
      var id = novoId_(empresa), dias = Number(cfgVal_("dias_teste")) || 7;
      inserir_("Clientes", { id: id, empresa: empresa, nome: nome, whatsapp: zap, email: email, senha: hash_(senha), situacao: "teste",
        teste_ate: legivel_(Date.now() + dias * DIA).slice(0, 10), criado: legivel_(Date.now()), ultimo_acesso: legivel_(Date.now()), observacao: "" });
      gravarDados_(id, inicial_(empresa, nome, zap));
      var adm = cfgVal_("email_admin");
      if (/@/.test(adm)) enviar_(adm, "🎉 Novo cliente no Divulga Fácil: " + empresa,
        "<p><b>" + esc_(empresa) + "</b> criou uma conta.</p><p>Responsável: " + esc_(nome) + "<br>WhatsApp: " + esc_(zap) + "<br>E-mail: " + esc_(email) +
        "</p><p>Situação: teste por " + dias + " dias. Para mudar, use a aba Clientes da planilha.</p>");
      return { ok: true, token: novoToken_(id), empresa: empresa, dias_teste: dias };
    });
  },

  login: function (d) {
    var C = clientePorEmail_(lim_(d.email, 120).toLowerCase());
    if (!C || !confereSenha_(C, String(d.senha || ""))) throw new Error("E-mail ou senha incorretos.");
    atualizarCli_(C.id, { ultimo_acesso: legivel_(Date.now()) });
    return { ok: true, token: novoToken_(C.id), empresa: String(C.empresa) };
  },

  sair: function (d) { encerrarSessao_(d.token); return { ok: true }; },

  /* carrega tudo (ou nada, se não mudou desde a última vez) */
  dados: function (d) {
    var id = sessao_(d), C = cliente_(id), lib = liberado_(C), reg = lerDados_(id);
    var info = { empresa: String(C.empresa), nome: String(C.nome), email: String(C.email), whatsapp: String(C.whatsapp) };
    if (d.v && Number(d.v) === reg.v) return { ok: true, mudou: false, v: reg.v, licenca: lib, conta: info };
    return { ok: true, mudou: true, v: reg.v, licenca: lib, conta: info, dados: reg.dados };
  },

  /* junta o que veio do aparelho com o que está salvo (item por item, o mais novo ganha) */
  salvar: function (d) {
    var id = sessao_(d), C = cliente_(id);
    if (!liberado_(C).ok) throw new Error("Seu acesso está pausado. Fale com a DayIA para continuar.");
    return comTrava_(function () {
      var reg = lerDados_(id), junto = juntar_(reg.dados, d.dados || {});
      var v = gravarDados_(id, junto);
      return { ok: true, v: v, dados: junto };
    });
  },

  conta: function (d) {
    var id = sessao_(d), C = cliente_(id), c = d.dados || {}, m = {};
    if (c.empresa !== undefined) m.empresa = lim_(c.empresa, 60) || C.empresa;
    if (c.nome !== undefined) m.nome = lim_(c.nome, 60) || C.nome;
    if (c.whatsapp !== undefined) m.whatsapp = lim_(c.whatsapp, 30);
    if (c.senha) { if (String(c.senha).length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres."); m.senha = hash_(c.senha); }
    atualizarCli_(id, m);
    return { ok: true };
  }
};

/* ---------------- conta inicial (já vem com exemplos para a pessoa entender) ---------------- */
function inicial_(empresa, nome, zap) {
  var t = Date.now(), hoje = legivel_(t).slice(0, 10).split("/").reverse().join("-");
  var em = String(empresa);
  return {
    posts: [
      { id: "p1", t: "Exemplo: apresente a sua empresa", tit: "Conheça a " + em, d: hoje, fmt: "v", video: "", redes: ["ig", "fb", "tt", "wa", "yt", "li"], feito: {}, u: t,
        leg: "Prazer, somos a " + em + "! 👋\n\nConte aqui em poucas palavras o que você faz e por que o cliente vai gostar.\n\n💬 Chame no WhatsApp: " + zap + "\n\n#" + em.replace(/[^A-Za-zÀ-ÿ0-9]/g, "") }
    ],
    msgs: [
      { id: "m1", t: "Saudação", m: "Olá! Obrigada por falar com a " + em + " 😊\n\nJá vamos te responder. Como podemos te ajudar?", u: t },
      { id: "m2", t: "Enviar orçamento", m: "Olá, tudo bem? 😊\n\nSegue o orçamento que você pediu. Qualquer dúvida, é só me chamar por aqui.\n\nFico à disposição!", u: t },
      { id: "m3", t: "Pedir avaliação", m: "Olá, tudo bem? 😊\n\nSe você gostou do nosso atendimento, poderia deixar uma avaliação rapidinha no Google? Leva menos de 1 minuto e ajuda muito.\n\nObrigada pelo apoio! 🙏", u: t },
      { id: "m4", t: "Cliente sumido", m: "Olá, tudo bem? 😊\n\nFaz um tempinho que você não aparece por aqui e sentimos sua falta! Temos novidades que acho que você vai gostar.\n\nPosso te mostrar?", u: t },
      { id: "m5", t: "Agradecer a compra", m: "Olá! Muito obrigada pela sua compra 💙\n\nQualquer coisa que precisar, conte com a gente.", u: t }
    ],
    links: [
      { id: "l1", nome: "WhatsApp", valor: zap, u: t },
      { id: "l2", nome: "Instagram", valor: "", u: t },
      { id: "l3", nome: "Site", valor: "", u: t }
    ]
  };
}

/* ---------------- juntar alterações de vários aparelhos ---------------- */
function juntar_(velho, novo) {
  var out = {};
  ["posts", "msgs", "links"].forEach(function (k) {
    var m = {}, ordem = [];
    (velho[k] || []).forEach(function (x) { if (x && x.id) { m[x.id] = x; ordem.push(x.id); } });
    (novo[k] || []).slice(0, 2000).forEach(function (x) {
      if (!x || !x.id) return;
      x = limpar_(k, x);
      if (!m[x.id]) { m[x.id] = x; ordem.push(x.id); }
      else if ((Number(x.u) || 0) >= (Number(m[x.id].u) || 0)) m[x.id] = x;
    });
    var corte = Date.now() - 60 * DIA; // itens apagados somem de vez depois de 60 dias
    out[k] = ordem.map(function (id) { return m[id]; }).filter(function (x) { return !(x.del && Number(x.u) < corte); });
  });
  return out;
}
function limpar_(k, x) {
  var u = Math.min(Number(x.u) || Date.now(), Date.now() + 5 * MIN), id = lim_(x.id, 40);
  if (x.del) return { id: id, del: true, u: u };
  if (k === "posts") {
    var redes = (Array.isArray(x.redes) ? x.redes : []).filter(function (r) { return ["ig", "fb", "tt", "wa", "yt", "li"].indexOf(r) >= 0; });
    var feito = {}; redes.forEach(function (r) { if (x.feito && x.feito[r]) feito[r] = true; });
    return { id: id, t: lim_(x.t, 120), tit: lim_(x.tit, 150), leg: lim_(x.leg, 5000), d: lim_(x.d, 10), fmt: x.fmt === "h" ? "h" : "v",
      video: lim_(x.video, 600), redes: redes, feito: feito, u: u };
  }
  if (k === "msgs") return { id: id, t: lim_(x.t, 80), m: lim_(x.m, 3000), u: u };
  return { id: id, nome: lim_(x.nome, 60), valor: lim_(x.valor, 300), u: u };
}

/* ---------------- dados guardados na aba "Dados" (em partes, cabe bastante coisa) ---------------- */
function lerDados_(id) {
  var sh = aba_("Dados"), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === id) {
    var txt = v[i].slice(2).join("");
    try { return { v: Number(v[i][1]) || 1, dados: JSON.parse(txt || "{}") }; } catch (x) { return { v: Number(v[i][1]) || 1, dados: {} }; }
  }
  return { v: 1, dados: { posts: [], msgs: [], links: [] } };
}
function gravarDados_(id, dados) {
  var txt = JSON.stringify(dados), partes = [];
  if (txt.length > PARTES * TAM_PARTE) throw new Error("Seu painel ficou muito grande. Apague postagens antigas que já foram feitas.");
  for (var p = 0; p < PARTES; p++) partes.push(txt.slice(p * TAM_PARTE, (p + 1) * TAM_PARTE));
  var v = Date.now(), linha = [id, v].concat(partes.map(function (s) { return s ? "'" + s : ""; }));
  var sh = aba_("Dados"), vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) if (String(vals[i][0]) === id) { sh.getRange(i + 1, 1, 1, linha.length).setValues([linha]); return v; }
  sh.getRange(sh.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);
  return v;
}

/* ---------------- clientes e licença ---------------- */
function cliente_(id) {
  var C = linhas_("Clientes").filter(function (x) { return String(x.id) === id; })[0];
  if (!C) throw new Error("SESSAO");
  return C;
}
function clientePorEmail_(email) {
  if (!email) return null;
  return linhas_("Clientes").filter(function (x) { return String(x.email).toLowerCase().trim() === email; })[0] || null;
}
function novoId_(empresa) {
  var base = slug_(empresa) || "cliente", ids = linhas_("Clientes").map(function (x) { return String(x.id); }), id = base, i = 2;
  while (ids.indexOf(id) >= 0) id = base + "-" + (i++);
  return id;
}
function liberado_(C) {
  var s = String(C.situacao || "").toLowerCase().trim(), zap = cfgVal_("whatsapp_dayia");
  if (s === "cortesia" || s === "ativo") return { ok: true, situacao: s };
  if (s === "suspenso") return { ok: false, situacao: s, whatsapp: zap };
  var ate = dataDe_(C.teste_ate);
  if (ate && Date.now() > ate + DIA) return { ok: false, situacao: "teste_vencido", whatsapp: zap };
  return { ok: true, situacao: "teste", dias_restantes: ate ? Math.max(0, Math.floor((ate + DIA - Date.now()) / DIA)) : null, whatsapp: zap };
}
function dataDe_(v) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  var m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]) - fuso_() * MIN;
  var t = Date.parse(v); return isNaN(t) ? 0 : t;
}
function confereSenha_(C, senha) {
  var s = String(C.senha || "");
  if (/^[0-9a-f]{64}$/.test(s)) return hash_(senha) === s;
  // senha digitada direto na planilha (ex.: você trocou para ajudar o cliente): aceita e já guarda protegida
  if (s !== "" && s === senha) { atualizarCli_(C.id, { senha: hash_(senha) }); return true; }
  return false;
}
function hash_(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "divulgafacil:" + String(s), Utilities.Charset.UTF_8);
  return b.map(function (x) { return ("0" + ((x + 256) % 256).toString(16)).slice(-2); }).join("");
}
function atualizarCli_(id, campos) {
  var sh = aba_("Clientes"), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) {
    Object.keys(campos).forEach(function (c) { var col = ABAS.Clientes.indexOf(c); if (col >= 0) sh.getRange(i + 1, col + 1).setValue(txt_(campos[c])); });
    return;
  }
}

/* ---------------- e-mail ---------------- */
function enviar_(para, assunto, html) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return;
    MailApp.sendEmail({ to: para, subject: assunto, htmlBody: "<div style='font-family:Arial,sans-serif;color:#0E2238;font-size:14px'>" + html + "</div>", name: "Divulga Fácil" });
  } catch (x) { console.log("e-mail não enviado: " + x); }
}

/* ---------------- planilha ---------------- */
function planilha_() { var id = PropertiesService.getScriptProperties().getProperty("PLANILHA"); return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); }
function aba_(n) { var sh = planilha_().getSheetByName(n); if (!sh) throw new Error("A aba " + n + " não existe. Rode a função configurar."); return sh; }
function linhas_(n) {
  var v = aba_(n).getDataRange().getValues(), cab = v.shift();
  return v.filter(function (r) { return r.join("") !== ""; }).map(function (r) { var o = {}; cab.forEach(function (c, i) { o[c] = r[i]; }); return o; });
}
function inserir_(n, o) { aba_(n).appendRow(txtRow_(ABAS[n].map(function (c) { return o[c] === undefined ? "" : o[c]; }))); }
function cfgVal_(k) { var r = linhas_("Config").filter(function (x) { return x.chave === k; })[0]; return r ? String(r.valor) : ""; }
var FUSO_CACHE = null;
function fuso_() { if (FUSO_CACHE === null) FUSO_CACHE = Number(cfgVal_("fuso_minutos")) || -180; return FUSO_CACHE; }
function legivel_(t) {
  var d = new Date(t + fuso_() * MIN), p = function (n) { return (n < 10 ? "0" : "") + n; };
  return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear() + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
}
function slug_(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); }

/* ---------------- sessão (fica conectado por 30 dias) e trava ---------------- */
var SESSAO_DIAS = 30;
function novoToken_(id) { var t = Utilities.getUuid(); guardarSessao_(t, id); return t; }
function sessao_(d) {
  var id = lerSessao_(d.token, function (v) { return linhas_("Clientes").some(function (x) { return String(x.id) === v; }); });
  if (!id) throw new Error("SESSAO");
  return id;
}
function guardarSessao_(token, valor) {
  CacheService.getScriptCache().put("tk_" + token, valor, 21600);
  PropertiesService.getScriptProperties().setProperty("SS_" + token, JSON.stringify({ v: valor, exp: Date.now() + SESSAO_DIAS * DIA }));
  if (Math.random() < 0.05) limparSessoes_();
}
function lerSessao_(token, valida) {
  token = String(token || "");
  if (!token) return null;
  var c = CacheService.getScriptCache(), v = c.get("tk_" + token);
  if (v) return v;
  var P = PropertiesService.getScriptProperties(), raw = P.getProperty("SS_" + token);
  if (!raw) return null;
  try {
    var o = JSON.parse(raw);
    if (!(o.exp > Date.now()) || (valida && !valida(o.v))) { P.deleteProperty("SS_" + token); return null; }
    P.setProperty("SS_" + token, JSON.stringify({ v: o.v, exp: Date.now() + SESSAO_DIAS * DIA }));
    c.put("tk_" + token, o.v, 21600);
    return o.v;
  } catch (x) { return null; }
}
function encerrarSessao_(token) {
  token = String(token || "");
  if (!token) return;
  try { CacheService.getScriptCache().remove("tk_" + token); } catch (x) {}
  PropertiesService.getScriptProperties().deleteProperty("SS_" + token);
}
function limparSessoes_() {
  try {
    var P = PropertiesService.getScriptProperties(), tudo = P.getProperties(), agora = Date.now();
    Object.keys(tudo).forEach(function (k) {
      if (k.indexOf("SS_") !== 0) return;
      try { if (!(JSON.parse(tudo[k]).exp > agora)) P.deleteProperty(k); } catch (x) { P.deleteProperty(k); }
    });
  } catch (x) {}
}
function comTrava_(fn) {
  var l = LockService.getScriptLock();
  if (!l.tryLock(20000)) throw new Error("O sistema está ocupado agora. Tente de novo em alguns segundos.");
  try { return fn(); } finally { SpreadsheetApp.flush(); l.releaseLock(); }
}

/* ---------------- utilidades ---------------- */
// o apóstrofo faz a planilha guardar como texto: telefone não vira número e nada vira fórmula
function txt_(v) { return (typeof v === "string" && v !== "") ? "'" + v : v; }
function txtRow_(r) { return r.map(txt_); }
function sim_(v) { return /^s/i.test(String(v).trim()); }
function lim_(v, n) { return String(v === undefined || v === null ? "" : v).trim().slice(0, n); }
function esc_(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
