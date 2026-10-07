/* =====================================================================
   AGENDA ONLINE by DayIA  ·  servidor (Google Apps Script)
   ---------------------------------------------------------------------
   Guarda agendamentos, serviços, equipe e bloqueios numa planilha Google.
   A página de agendamento e o painel ficam no site e conversam com este
   script pela internet.

   Instalação resumida:
   1. Crie uma planilha Google em branco.
   2. Extensões > Apps Script. Apague o que estiver lá e cole este arquivo.
   3. Selecione a função "configurar" e clique em Executar (autorize).
   4. Implantar > Nova implantação > App da Web
        Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
   5. Copie o endereço que termina em /exec.
   ===================================================================== */

var VERSAO_SISTEMA = "1.0";
var ABAS = {
  Agendamentos: ["id","criado","ini","fim","quando","cliente","tel","email","pet","servico","servico_nome","prof","prof_nome","preco","status","origem","obs","conversa","recado_novo","chave"],
  Servicos:     ["id","nome","minutos","preco","ativo"],
  Equipe:       ["id","nome","ativo"],
  Bloqueios:    ["id","prof","ini","fim","quando","motivo"],
  Config:       ["chave","valor","explicacao"]
};
var MIN = 60000, DIA = 86400000;

/* ---------------- instalação (já preenchida para a Ilumine-se) ---------------- */
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
  var sv = ss.getSheetByName("Servicos");
  if (sv.getLastRow() === 1) {
    [["s1","Manicure",40,35],["s2","Pedicure",50,40],["s3","Pé e mão",80,70],["s4","Esmaltação em gel",60,80],
     ["s5","Design de sobrancelhas",30,40],["s6","Sobrancelha com henna",40,50],["s7","Alongamento em fibra",150,180],["s8","Manutenção do alongamento",90,120]]
      .forEach(function (s) { sv.appendRow([s[0], s[1], s[2], s[3], "SIM"]); });
  }
  var eq = ss.getSheetByName("Equipe");
  if (eq.getLastRow() === 1) eq.appendRow(["p1", "Palmira Pastor", "SIM"]);
  var cfg = ss.getSheetByName("Config");
  var padrao = [
    ["negocio", "Ilumine-se", "Nome que aparece para as clientes"],
    ["segmento", "manicure", "manicure, estetica, medico, odonto, psico, salao, pet ou fisio"],
    ["telefone", "", "WhatsApp do negócio, ex.: (19) 99999-0000"],
    ["endereco", "", "Endereço que aparece para as clientes"],
    ["instagram", "", "Ex.: @iluminese"],
    ["email_aviso", "", "E-mail que recebe aviso de cada agendamento novo (pode deixar vazio)"],
    ["senha_painel", "1234", "Senha para entrar no painel. TROQUE!"],
    ["dias", "2,3,4,5,6", "Dias que atende: 0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sáb"],
    ["abre", "09:00", "Horário que abre"],
    ["fecha", "19:00", "Horário que fecha"],
    ["intervalo_ini", "12:00", "Início do almoço (vazio = sem intervalo)"],
    ["intervalo_fim", "13:00", "Fim do almoço"],
    ["passo", "15", "De quantos em quantos minutos aparecem os horários"],
    ["antecedencia", "60", "Antecedência mínima (minutos) para agendar online"],
    ["cancelar_ate", "120", "Até quantos minutos antes a cliente pode cancelar sozinha"],
    ["fuso_minutos", "-180", "Fuso horário (Brasília = -180). Não mexa."],
    ["proximo_id", "1", "Uso interno (não mexa)"],
    ["link_agenda", "", "Preenchido sozinho"]
  ];
  cfg.getRange("B:B").setNumberFormat("@");
  var tem = cfg.getDataRange().getValues().map(function (r) { return r[0]; });
  // o apóstrofo impede a planilha de transformar "09:00" em hora e "2,3,4" em número
  padrao.forEach(function (p) { if (tem.indexOf(p[0]) < 0) cfg.appendRow([p[0], txt_(p[1]), p[2]]); });
  cfg.autoResizeColumns(1, 3);
  var sobra = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
  if (sobra && sobra.getLastRow() === 0 && ss.getSheets().length > 5) ss.deleteSheet(sobra);
  MailApp.getRemainingDailyQuota();
  return "Pronto! Agora faça a implantação como App da Web.";
}

/* ---------------- entrada ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.acao) return responder_(executar_(p));
  return ContentService.createTextOutput("Agenda Online by DayIA · servidor funcionando (versão " + VERSAO_SISTEMA + ").");
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
  /* ======== PÁGINA DA CLIENTE ======== */
  info: function (d) {
    var C = config_(), agora = Date.now();
    var ocup = agendamentos_().filter(function (a) { return a.status !== "cancelado" && a.fim > agora - DIA && a.ini < agora + 45 * DIA; })
      .map(function (a) { return { prof: a.prof, ini: a.ini, fim: a.fim }; });
    var bloq = linhas_("Bloqueios").filter(function (b) { return Number(b.fim) > agora; }).map(function (b) { return { prof: b.prof, ini: Number(b.ini), fim: Number(b.fim) }; });
    return { ok: true, negocio: negocio_(C), segmento: C.segmento, horario: horario_(C), passo: Number(C.passo) || 15, antecedencia: Number(C.antecedencia) || 0,
      cancelar_ate: Number(C.cancelar_ate) || 0, servicos: servicos_(true), profs: equipe_(true), ocupados: ocup, bloq: bloq, v: versao_() };
  },

  agendar: function (d) {
    var c = d.dados || {};
    if (!lim_(c.nome, 80)) throw new Error("Coloque o seu nome.");
    if (String(c.tel || "").replace(/\D/g, "").length < 10) throw new Error("Coloque um WhatsApp com DDD.");
    var sv = servicos_(true).filter(function (s) { return s.id === c.servico; })[0];
    if (!sv) throw new Error("Serviço não encontrado.");
    var ini = Number(c.ini);
    if (!ini) throw new Error("Escolha um horário.");
    return comTrava_(function () {
      var C = config_(), H = horario_(C), ags = agendamentos_(), bl = bloqueios_();
      var profs = equipe_(true).map(function (p) { return p.id; });
      var candidatos = c.prof ? [c.prof] : profs;
      var livres = candidatos.filter(function (p) { return profs.indexOf(p) >= 0 && livre_(C, H, ags, bl, p, ini, sv.minutos, null, false); });
      if (!livres.length) return { ok: false, ocupado: true, erro: "Esse horário acabou de ser ocupado. Escolha outro, por favor." };
      var pid = livres[0];
      if (livres.length > 1) { // quem tem menos atendimentos no dia
        var d0 = inicioDia_(C, ini), cont = {};
        livres.forEach(function (p) { cont[p] = 0; });
        ags.forEach(function (a) { if (a.status !== "cancelado" && inicioDia_(C, a.ini) === d0 && cont[a.prof] !== undefined) cont[a.prof]++; });
        pid = livres.sort(function (a, b) { return cont[a] - cont[b]; })[0];
      }
      var id = Number(cfgVal_("proximo_id")) || 1;
      setCfg_("proximo_id", id + 1);
      if (d.base) setCfg_("link_agenda", String(d.base).split("#")[0]);
      var chave = Utilities.getUuid().replace(/-/g, "").slice(0, 10);
      var a = {
        id: id, criado: Date.now(), ini: ini, fim: ini + sv.minutos * MIN, quando: legivel_(C, ini), cliente: lim_(c.nome, 80), tel: lim_(c.tel, 30),
        email: lim_(c.email, 120), pet: lim_(c.pet, 40), servico: sv.id, servico_nome: sv.nome, prof: pid, prof_nome: nomeProf_(pid), preco: sv.preco,
        status: "pendente", origem: "online", obs: lim_(c.obs, 500), conversa: "[]", recado_novo: c.obs ? "SIM" : "", chave: chave
      };
      if (c.obs) a.conversa = JSON.stringify([{ de: "cli", x: lim_(c.obs, 500), t: Date.now() }]);
      inserir_("Agendamentos", a);
      mudou_();
      avisarNegocio_(a, C);
      emailCliente_(a, C, "novo");
      return { ok: true, agendamento: publico_(a, true), chave: chave };
    });
  },

  meus: function (d) {
    var lista = (d.lista || []).slice(0, 30), todos = agendamentos_(), C = config_();
    var out = [];
    lista.forEach(function (x) {
      var a = todos.filter(function (y) { return y.id === Number(x.id) && String(y.chave) === String(x.chave); })[0];
      if (a) out.push(publico_(a, true));
    });
    return { ok: true, agendamentos: out, negocio: negocio_(C), cancelar_ate: Number(C.cancelar_ate) || 0 };
  },

  cancelar: function (d) {
    return comTrava_(function () {
      var a = daCliente_(d), C = config_();
      if (a.status === "cancelado") return { ok: true };
      if (a.ini - Date.now() < (Number(C.cancelar_ate) || 0) * MIN) throw new Error("Falta pouco para o horário. Para cancelar, fale direto pelo WhatsApp.");
      var conv = conversa_(a); conv.push({ de: "sis", x: "Cancelado pela cliente.", t: Date.now() });
      atualizar_(a.id, { status: "cancelado", conversa: JSON.stringify(conv), recado_novo: "SIM" });
      mudou_();
      return { ok: true };
    });
  },

  recado: function (d) {
    var x = lim_(d.texto, 500);
    if (!x) throw new Error("Escreva o recado.");
    return comTrava_(function () {
      var a = daCliente_(d), conv = conversa_(a);
      conv.push({ de: "cli", x: x, t: Date.now() });
      atualizar_(a.id, { conversa: JSON.stringify(conv), recado_novo: "SIM" });
      mudou_();
      return { ok: true };
    });
  },

  /* ======== PAINEL DO NEGÓCIO ======== */
  login: function (d) {
    var C = config_();
    if (String(d.senha || "") !== String(C.senha_painel)) throw new Error("Senha incorreta.");
    var token = Utilities.getUuid();
    CacheService.getScriptCache().put("tk_" + token, "1", 21600);
    return { ok: true, token: token, negocio: negocio_(C) };
  },

  painel: function (d) {
    sessao_(d);
    var v = versao_();
    if (d.v && Number(d.v) === v) return { ok: true, mudou: false, v: v };
    var C = config_(), de = Date.now() - 400 * DIA;
    return { ok: true, mudou: true, v: v, negocio: negocio_(C), segmento: C.segmento, horario: horario_(C), passo: Number(C.passo) || 15,
      antecedencia: Number(C.antecedencia) || 0, cancelar_ate: Number(C.cancelar_ate) || 0, email_aviso: C.email_aviso || "",
      servicos: servicos_(false), profs: equipe_(false),
      ags: agendamentos_().filter(function (a) { return a.ini > de; }).map(function (a) { return publico_(a, false); }),
      bloq: bloqueios_().filter(function (b) { return b.fim > Date.now() - 7 * DIA; }) };
  },

  acao: function (d) {
    sessao_(d);
    return comTrava_(function () {
      var C = config_(), H = horario_(C), a, conv, agora = Date.now();
      switch (d.tipo) {
        case "status":
          a = achar_(d.id);
          if (["pendente", "confirmado", "concluido", "faltou", "cancelado"].indexOf(d.valor) < 0) throw new Error("Situação inválida.");
          conv = conversa_(a);
          var txt = { confirmado: "Horário confirmado.", cancelado: "Horário cancelado pelo negócio.", concluido: "Atendimento concluído.", faltou: "Marcado como falta.", pendente: "Voltou para aguardando confirmação." }[d.valor];
          if (d.valor === "confirmado" || d.valor === "cancelado") conv.push({ de: "sis", x: txt, t: agora });
          atualizar_(a.id, { status: d.valor, conversa: JSON.stringify(conv) });
          if (d.valor === "confirmado") emailCliente_(a, C, "confirmado");
          if (d.valor === "cancelado") emailCliente_(a, C, "cancelado");
          break;
        case "remarcar":
          a = achar_(d.id);
          var sv = servicoPorId_(a.servico) || { minutos: (a.fim - a.ini) / MIN };
          var ini = Number(d.ini), prof = d.prof || a.prof;
          if (!d.forcar && !livre_(C, H, agendamentos_(), bloqueios_(), prof, ini, sv.minutos, a.id, true)) return { ok: false, ocupado: true, erro: "Horário ocupado ou fora do expediente." };
          conv = conversa_(a);
          conv.push({ de: "sis", x: "Horário remarcado para " + legivel_(C, ini) + ".", t: agora });
          atualizar_(a.id, { ini: ini, fim: ini + sv.minutos * MIN, quando: legivel_(C, ini), prof: prof, prof_nome: nomeProf_(prof), status: a.status === "faltou" || a.status === "cancelado" ? "confirmado" : a.status, conversa: JSON.stringify(conv) });
          a.ini = ini; a.quando = legivel_(C, ini); a.prof_nome = nomeProf_(prof);
          emailCliente_(a, C, "remarcado");
          break;
        case "novo":
          var c = d.dados || {}, s2 = servicoPorId_(c.servico);
          if (!s2) throw new Error("Serviço não encontrado.");
          if (!lim_(c.nome, 80)) throw new Error("Coloque o nome.");
          var i2 = Number(c.ini);
          if (!d.forcar && !livre_(C, H, agendamentos_(), bloqueios_(), c.prof, i2, s2.minutos, null, true)) return { ok: false, ocupado: true, erro: "Horário ocupado ou fora do expediente." };
          var id = Number(cfgVal_("proximo_id")) || 1;
          setCfg_("proximo_id", id + 1);
          inserir_("Agendamentos", { id: id, criado: agora, ini: i2, fim: i2 + s2.minutos * MIN, quando: legivel_(C, i2), cliente: lim_(c.nome, 80), tel: lim_(c.tel, 30), email: lim_(c.email, 120),
            pet: lim_(c.pet, 40), servico: s2.id, servico_nome: s2.nome, prof: c.prof, prof_nome: nomeProf_(c.prof), preco: s2.preco, status: "confirmado", origem: "balcão",
            obs: lim_(c.obs, 500), conversa: "[]", recado_novo: "", chave: Utilities.getUuid().replace(/-/g, "").slice(0, 10) });
          break;
        case "responder":
          a = achar_(d.id);
          var x = lim_(d.texto, 500);
          if (!x) throw new Error("Escreva a resposta.");
          conv = conversa_(a); conv.push({ de: "neg", x: x, t: agora });
          atualizar_(a.id, { conversa: JSON.stringify(conv), recado_novo: "" });
          emailCliente_(a, C, "resposta", x);
          break;
        case "lido":
          a = achar_(d.id);
          atualizar_(a.id, { recado_novo: "" });
          break;
        case "bloquear":
          var bi = Number(d.ini), bf = Number(d.fim);
          if (!(bf > bi)) throw new Error("O horário final precisa ser depois do inicial.");
          inserir_("Bloqueios", { id: "b" + agora, prof: d.prof || "todos", ini: bi, fim: bf, quando: legivel_(C, bi) + " até " + legivel_(C, bf).slice(-5), motivo: lim_(d.motivo, 80) });
          break;
        case "desbloquear":
          apagarLinha_("Bloqueios", String(d.id));
          break;
        case "config":
          salvarConfig_(d);
          break;
        default: throw new Error("Ação desconhecida.");
      }
      mudou_();
      return { ok: true };
    });
  }
};

/* ---------------- disponibilidade ---------------- */
function livre_(C, H, ags, bl, pid, ini, minutos, ignorar, semAntecedencia) {
  var fim = ini + minutos * MIN, off = Number(C.fuso_minutos) || -180;
  var local = ini / MIN + off, minDia = ((local % 1440) + 1440) % 1440, dsem = (Math.floor(local / 1440) + 4) % 7;
  if (dsem < 0) dsem += 7;
  if (H.dias.indexOf(dsem) < 0) return false;
  var a = minDia, b = minDia + minutos;
  if (a < hm_(H.ini) || b > hm_(H.fim)) return false;
  if (H.almoco[0] && H.almoco[1] && a < hm_(H.almoco[1]) && b > hm_(H.almoco[0])) return false;
  if (!semAntecedencia && ini < Date.now() + (Number(C.antecedencia) || 0) * MIN) return false;
  for (var i = 0; i < ags.length; i++) { var x = ags[i]; if (x.prof !== pid || x.status === "cancelado" || x.id === ignorar) continue; if (ini < x.fim && fim > x.ini) return false; }
  for (var j = 0; j < bl.length; j++) { var k = bl[j]; if (k.prof !== pid && k.prof !== "todos") continue; if (ini < k.fim && fim > k.ini) return false; }
  return true;
}
function inicioDia_(C, t) { var off = (Number(C.fuso_minutos) || -180) * MIN; return Math.floor((t + off) / DIA) * DIA - off; }
function hm_(s) { var p = String(s || "0:0").split(":"); return Number(p[0]) * 60 + (Number(p[1]) || 0); }
function legivel_(C, t) {
  var off = (Number(C.fuso_minutos) || -180) * MIN, d = new Date(t + off);
  var p = function (n) { return (n < 10 ? "0" : "") + n; };
  return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear() + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
}

/* ---------------- configurações pelo painel ---------------- */
function salvarConfig_(d) {
  if (d.negocio) {
    setCfg_("negocio", lim_(d.negocio.nome, 80) || cfgVal_("negocio"));
    setCfg_("telefone", lim_(d.negocio.tel, 30)); setCfg_("endereco", lim_(d.negocio.end, 150)); setCfg_("instagram", lim_(d.negocio.insta, 60));
  }
  if (d.horario) {
    setCfg_("dias", (d.horario.dias || []).join(","));
    setCfg_("abre", d.horario.ini); setCfg_("fecha", d.horario.fim);
    setCfg_("intervalo_ini", (d.horario.almoco || [])[0] || ""); setCfg_("intervalo_fim", (d.horario.almoco || [])[1] || "");
  }
  if (d.antecedencia !== undefined) setCfg_("antecedencia", String(Number(d.antecedencia) || 0));
  if (d.senha) setCfg_("senha_painel", lim_(d.senha, 40));
  if (d.email_aviso !== undefined) setCfg_("email_aviso", lim_(d.email_aviso, 120));
  if (d.servicos) regravar_("Servicos", d.servicos.map(function (s, i) {
    return { id: s.id || "s" + Date.now() + i, nome: lim_(s.nome, 60) || "Serviço", minutos: Math.max(5, Number(s.min) || 30), preco: Math.max(0, Number(s.preco) || 0), ativo: s.ativo === false ? "NÃO" : "SIM" };
  }));
  if (d.profs) regravar_("Equipe", d.profs.map(function (p, i) { return { id: p.id || "p" + Date.now() + i, nome: lim_(p.nome, 60) || "Profissional", ativo: p.ativo === false ? "NÃO" : "SIM" }; }));
}
function regravar_(n, lista) {
  var sh = aba_(n), ult = sh.getLastRow();
  if (ult > 1) sh.getRange(2, 1, ult - 1, ABAS[n].length).clearContent();
  if (lista.length) sh.getRange(2, 1, lista.length, ABAS[n].length).setValues(lista.map(function (o) { return ABAS[n].map(function (c) { return txt_(o[c]); }); }));
}

/* ---------------- e-mails ---------------- */
function avisarNegocio_(a, C) {
  if (!/@/.test(C.email_aviso || "")) return;
  enviar_(C.email_aviso, "📅 Novo agendamento: " + a.cliente + " · " + a.quando,
    "<h2 style='margin:0 0 8px'>Novo agendamento online</h2><p><b>" + esc_(a.cliente) + "</b>" + (a.pet ? " · pet " + esc_(a.pet) : "") + "<br>" + esc_(a.servico_nome) + " com " + esc_(a.prof_nome) + "<br><b>" + esc_(a.quando) + "</b><br>WhatsApp: " + esc_(a.tel) + (a.obs ? "<br>Recado: " + esc_(a.obs) : "") + "</p>" +
    (C.link_agenda ? "<p><a href='" + C.link_agenda + "#painel' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Abrir o painel</a></p>" : ""), C.negocio);
}
function emailCliente_(a, C, tipo, texto) {
  if (!/@/.test(a.email || "")) return;
  var link = C.link_agenda ? C.link_agenda + (C.link_agenda.indexOf("?") < 0 ? "?" : "&") + "ag=" + a.id + "&k=" + a.chave : "";
  var tit = { novo: "Recebemos seu agendamento", confirmado: "Seu horário está confirmado", cancelado: "Seu horário foi cancelado", remarcado: "Seu horário foi remarcado", resposta: "Você recebeu uma resposta" }[tipo];
  enviar_(a.email, tit + " · " + C.negocio,
    "<p>Olá, " + esc_(String(a.cliente).split(" ")[0]) + "!</p><p><b>" + tit + "</b>.</p><p>" + esc_(a.servico_nome) + " com " + esc_(a.prof_nome) + "<br><b>" + esc_(a.quando) + "</b></p>" +
    (texto ? "<blockquote style='border-left:4px solid #8EC5E8;margin:0;padding:8px 12px;background:#F2F6FA'>" + esc_(texto) + "</blockquote>" : "") +
    (link ? "<p><a href='" + link + "' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Ver meu horário</a></p>" : "") +
    "<p style='color:#4A5B75'>" + esc_(C.negocio) + (C.endereco ? " · " + esc_(C.endereco) : "") + "</p>", C.negocio);
}
function enviar_(para, assunto, html, nome) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return;
    MailApp.sendEmail({ to: para, subject: assunto, htmlBody: "<div style='font-family:Arial,sans-serif;color:#0E2238;font-size:14px'>" + html + "</div>", name: nome || "Agenda Online" });
  } catch (x) { console.log("e-mail não enviado: " + x); }
}

/* ---------------- planilha ---------------- */
function planilha_() { var id = PropertiesService.getScriptProperties().getProperty("PLANILHA"); return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); }
function aba_(n) { var sh = planilha_().getSheetByName(n); if (!sh) throw new Error("A aba " + n + " não existe. Rode a função configurar."); return sh; }
function linhas_(n) {
  var v = aba_(n).getDataRange().getValues(), cab = v.shift();
  return v.filter(function (r) { return r.join("") !== ""; }).map(function (r) { var o = {}; cab.forEach(function (c, i) { o[c] = r[i]; }); return o; });
}
function inserir_(n, o) { aba_(n).appendRow(ABAS[n].map(function (c) { return txt_(o[c] === undefined ? "" : o[c]); })); }
function atualizar_(id, campos) {
  var sh = aba_("Agendamentos"), n = sh.getLastRow() - 1;
  if (n < 1) return;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (Number(ids[i][0]) === Number(id)) {
    Object.keys(campos).forEach(function (c) { var col = ABAS.Agendamentos.indexOf(c); if (col >= 0) sh.getRange(i + 2, col + 1).setValue(txt_(campos[c])); });
    return;
  }
}
function apagarLinha_(n, id) {
  var sh = aba_(n), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][0]) === id) { sh.deleteRow(i + 1); return; }
}
function agendamentos_() {
  return linhas_("Agendamentos").map(function (a) {
    a.id = Number(a.id); a.ini = Number(a.ini); a.fim = Number(a.fim); a.preco = Number(a.preco) || 0; a.criado = Number(a.criado);
    a.prof = String(a.prof); a.servico = String(a.servico); return a;
  });
}
function bloqueios_() { return linhas_("Bloqueios").map(function (b) { return { id: String(b.id), prof: String(b.prof), ini: Number(b.ini), fim: Number(b.fim), motivo: b.motivo }; }); }
function servicos_(soAtivos) {
  return linhas_("Servicos").filter(function (s) { return !soAtivos || sim_(s.ativo); }).map(function (s, i) { return { id: String(s.id), nome: String(s.nome), minutos: Number(s.minutos) || 30, min: Number(s.minutos) || 30, preco: Number(s.preco) || 0, ativo: sim_(s.ativo) }; });
}
function servicoPorId_(id) { return servicos_(false).filter(function (s) { return s.id === String(id); })[0]; }
function equipe_(soAtivos) { return linhas_("Equipe").filter(function (p) { return !soAtivos || sim_(p.ativo); }).map(function (p) { return { id: String(p.id), nome: String(p.nome), ativo: sim_(p.ativo) }; }); }
function nomeProf_(id) { var p = equipe_(false).filter(function (x) { return x.id === String(id); })[0]; return p ? p.nome : ""; }
function achar_(id) { var a = agendamentos_().filter(function (x) { return x.id === Number(id); })[0]; if (!a) throw new Error("Agendamento não encontrado."); return a; }
function daCliente_(d) { var a = achar_(d.id); if (!d.chave || String(a.chave) !== String(d.chave)) throw new Error("Agendamento não encontrado."); return a; }
function conversa_(a) { try { var c = JSON.parse(a.conversa || "[]"); return Array.isArray(c) ? c : []; } catch (x) { return []; } }
function config_() { var o = {}; linhas_("Config").forEach(function (r) { o[r.chave] = String(r.valor); }); return o; }
function cfgVal_(k) { return config_()[k] || ""; }
function setCfg_(k, v) {
  var sh = aba_("Config"), v0 = sh.getDataRange().getValues();
  for (var i = 1; i < v0.length; i++) if (v0[i][0] === k) { sh.getRange(i + 1, 2).setValue(txt_(String(v))); return; }
  sh.appendRow([k, txt_(String(v)), ""]);
}
function negocio_(C) { return { nome: C.negocio, tel: C.telefone, end: C.endereco, insta: C.instagram }; }
function horario_(C) {
  return { dias: String(C.dias || "").split(",").filter(function (x) { return x !== ""; }).map(Number), ini: C.abre || "09:00", fim: C.fecha || "18:00", almoco: [C.intervalo_ini || "", C.intervalo_fim || ""] };
}
function publico_(a, paraCliente) {
  var o = { id: a.id, ini: a.ini, fim: a.fim, cli: a.cliente, tel: a.tel, email: a.email, pet: a.pet, serv: a.servico, servico_nome: a.servico_nome, prof: a.prof, prof_nome: a.prof_nome,
    preco: a.preco, status: a.status, origem: a.origem, obs: a.obs, conversa: conversa_(a), recado_novo: sim_(a.recado_novo), criado: a.criado };
  if (paraCliente) { o.chave = a.chave; delete o.recado_novo; }
  return o;
}

/* ---------------- sessão, versão e trava ---------------- */
function sessao_(d) { var c = CacheService.getScriptCache(), k = "tk_" + String(d.token || ""); if (!c.get(k)) throw new Error("SESSAO"); c.put(k, "1", 21600); }
function versao_() { return Number(PropertiesService.getScriptProperties().getProperty("VERSAO") || 1); }
function mudou_() { PropertiesService.getScriptProperties().setProperty("VERSAO", String(Date.now())); }
function comTrava_(fn) {
  var l = LockService.getScriptLock();
  if (!l.tryLock(20000)) throw new Error("Muita gente agendando agora. Tente de novo em alguns segundos.");
  try { return fn(); } finally { SpreadsheetApp.flush(); l.releaseLock(); }
}

/* ---------------- utilidades ---------------- */
// o apóstrofo faz a planilha guardar como texto: telefone não vira número e nada vira fórmula
function txt_(v) { return (typeof v === "string" && v !== "") ? "'" + v : v; }
function sim_(v) { return /^s/i.test(String(v).trim()); }
function lim_(v, n) { return String(v === undefined || v === null ? "" : v).trim().slice(0, n); }
function esc_(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
