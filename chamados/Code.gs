/* =====================================================================
   ATENDE FÁCIL by DayIA  ·  servidor (Google Apps Script)
   ---------------------------------------------------------------------
   Guarda chamados, conversas, histórico e técnicos numa planilha Google.
   As telas (cliente, técnico e gestor) ficam no site e conversam com
   este script pela internet.

   Instalação resumida (passo a passo completo no arquivo de instruções):
   1. Crie uma planilha Google em branco.
   2. Extensões > Apps Script. Apague o que estiver lá e cole este arquivo.
   3. Selecione a função "configurar" e clique em Executar (autorize).
   4. Implantar > Nova implantação > App da Web
        Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
   5. Copie o código da implantação e coloque no link do sistema.
   ===================================================================== */

var VERSAO_SISTEMA = "1.4";
var ABAS = {
  Chamados:  ["id","criado","atualizado","nome","empresa","email","tel","setor","categoria","prioridade","assunto","descricao","patrimonio","app","rid","permite","anexo","status","tecnico","prazo","acesso","nota","minutos","resolvido","chave"],
  Mensagens: ["chamado","quando","de","autor","texto"],
  Historico: ["quando","chamado","quem","acao","detalhe"],
  Tecnicos:  ["nome","email","pin","gestor","ativo"],
  Config:    ["chave","valor","explicacao"]
};
var PRIO = {"Urgente":4,"Alta":8,"Média":24,"Baixa":72};
var STATUS = ["Aberto","Em atendimento","Aguardando cliente","Resolvido"];
var H = 3600000;

/* ---------------- instalação ---------------- */
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
  var tec = ss.getSheetByName("Tecnicos");
  if (tec.getLastRow() === 1) {
    tec.getRange(2, 1, 4, 5).setValues([
      ["Dono da empresa", "dono@suaempresa.com.br", "1234", "SIM", "SIM"],
      ["Técnico 1", "tecnico1@suaempresa.com.br", "1111", "NÃO", "SIM"],
      ["Técnico 2", "tecnico2@suaempresa.com.br", "2222", "NÃO", "SIM"],
      ["Técnico 3", "tecnico3@suaempresa.com.br", "3333", "NÃO", "SIM"]
    ]);
    tec.getRange("C:C").setNumberFormat("@");
  }
  var cfg = ss.getSheetByName("Config");
  var padrao = [
    ["empresa", "Minha Empresa de Suporte", "Nome que aparece para os clientes"],
    ["distribuicao", "fila", "fila = todos recebem e quem assumir fica com o chamado · rodizio = o sistema distribui entre os técnicos"],
    ["avisar_tecnicos_email", "SIM", "Mandar e-mail aos técnicos quando chegar chamado novo"],
    ["avisar_cliente_email", "SIM", "Mandar e-mail ao cliente quando o técnico responder"],
    ["proximo_id", "1001", "Número do próximo chamado (não mexa)"],
    ["rodizio_pos", "0", "Uso interno do rodízio (não mexa)"],
    ["link_sistema", "", "Preenchido sozinho quando o primeiro chamado for aberto"],
    ["push_chave", "", "Chave do OneSignal: avisos no celular mesmo com o app fechado (cole aqui a chave)"]
  ];
  var tem = cfg.getDataRange().getValues().map(function (r) { return r[0]; });
  padrao.forEach(function (p) { if (tem.indexOf(p[0]) < 0) cfg.appendRow(p); });
  cfg.autoResizeColumns(1, 3);
  ss.getSheetByName("Chamados").getRange("A:A").setNumberFormat("0");
  var sobra = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
  if (sobra && ss.getSheets().length > 5 && sobra.getLastRow() === 0) ss.deleteSheet(sobra);
  // pede as permissões de e-mail e Drive já na instalação
  MailApp.getRemainingDailyQuota();
  pastaAnexos_();
  return "Pronto! Agora faça a implantação como App da Web.";
}

/* ---------------- entrada ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.acao) return responder_(executar_(p));
  return ContentService.createTextOutput("Atende Fácil by DayIA · servidor funcionando (versão " + VERSAO_SISTEMA + ").");
}
function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents || "{}"); } catch (x) { return responder_({ erro: "Pedido inválido." }); }
  return responder_(executar_(d));
}
function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function executar_(d) {
  try {
    var f = ACOES[d.acao];
    if (!f) return { erro: "Ação desconhecida." };
    return f(d);
  } catch (x) {
    return { erro: String(x && x.message || x) };
  }
}

var ACOES = {
  ping: function () { return { ok: true, empresa: cfg_("empresa"), versao: VERSAO_SISTEMA, primeiro: !!linhaExemploGestor_() }; },
  sair: function (d) { encerrarSessao_(d.token); return { ok: true }; },

  /* primeiro acesso: o dono cria o próprio login, sem ninguém mexer na planilha */
  primeiroAcesso: function (d) {
    var nome = lim_(d.nome, 60), email = lim_(d.email, 120).toLowerCase(), senha = lim_(d.senha, 20), emp = lim_(d.empresa, 80);
    if (!nome) throw new Error("Coloque o seu nome.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Coloque um e-mail válido.");
    if (senha.length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres.");
    return comTrava_(function () {
      var linha = linhaExemploGestor_();
      if (!linha) throw new Error("O acesso de gestor já foi criado. Entre com o seu e-mail e senha.");
      var sh = aba_("Tecnicos"), v = sh.getDataRange().getValues();
      sh.getRange(linha, 1, 1, 5).setValues([[nome, email, "'" + senha, "SIM", "SIM"]]);
      for (var i = 1; i < v.length; i++) if (i + 1 !== linha && /@suaempresa\.com\.br$/i.test(String(v[i][1]).trim())) sh.getRange(i + 1, 5).setValue("NÃO");
      if (emp) setCfg_("empresa", emp);
      mudou_();
      var token = Utilities.getUuid();
      guardarSessao_(token, JSON.stringify({ nome: nome, email: email, gestor: true }));
      return { ok: true, token: token, nome: nome, gestor: true, empresa: cfg_("empresa"), distribuicao: cfg_("distribuicao") };
    });
  },

  /* guarda o aparelho para receber avisos com o app fechado */
  pushReg: function (d) {
    if (d.token) { var eu = sessao_(d); pushGuardar_("T_" + String(eu.email).trim().toLowerCase(), d.sub); }
    else { var t = chamadoCliente_(d); pushGuardar_("C_" + t.id, d.sub); }
    return { ok: true, ativo: !!pushChave_() };
  },

  /* ======== CLIENTE (sem login: usa o número do chamado + código secreto) ======== */
  abrir: function (d) {
    var c = d.dados || {};
    ["nome", "email", "assunto"].forEach(function (k) { if (!String(c[k] || "").trim()) throw new Error("Preencha o campo " + k + "."); });
    var prio = PRIO[c.prioridade] ? c.prioridade : "Média";
    var anexo = "";
    if (c.anexo && c.anexo.base64) anexo = salvarAnexo_(c.anexo);
    return comTrava_(function () {
      var id = Number(cfg_("proximo_id")) || 1001;
      setCfg_("proximo_id", id + 1);
      if (d.base) setCfg_("link_sistema", String(d.base).split("#")[0]);
      var agora = new Date(), chave = Utilities.getUuid().replace(/-/g, "").slice(0, 10);
      var tecnico = "";
      if (cfg_("distribuicao") === "rodizio") tecnico = proximoRodizio_();
      var t = {
        id: id, criado: agora, atualizado: agora, nome: lim_(c.nome, 80), empresa: lim_(c.empresa, 80), email: lim_(c.email, 120),
        tel: lim_(c.tel, 40), setor: lim_(c.setor, 60), categoria: lim_(c.categoria, 60), prioridade: prio, assunto: lim_(c.assunto, 150),
        descricao: lim_(c.descricao, 3000), patrimonio: lim_(c.patrimonio, 40), app: lim_(c.app, 30), rid: lim_(c.rid, 40),
        permite: c.permite ? "SIM" : "NÃO", anexo: anexo, status: "Aberto", tecnico: tecnico,
        prazo: new Date(agora.getTime() + PRIO[prio] * H), acesso: "", nota: "", minutos: "", resolvido: "", chave: chave
      };
      inserir_("Chamados", t);
      msg_(id, "sis", "", "Chamado aberto.");
      hist_(id, t.nome + " (cliente)", "abriu o chamado", t.assunto);
      if (tecnico) { msg_(id, "sis", "", "Chamado encaminhado para " + tecnico + "."); hist_(id, "Sistema", "encaminhou (rodízio)", "para " + tecnico); }
      mudou_();
      avisarNovo_(t);
      confirmarCliente_(t);
      push_(tecsPush_(tecnico ? function (r) { return r.nome === tecnico || sim_(r.gestor); } : null), "🔔 Novo chamado #" + id, (t.empresa ? t.empresa + " · " : "") + t.assunto + " (" + prio + ")", linkTec_());
      return { ok: true, id: id, chave: chave, empresa: cfg_("empresa") };
    });
  },

  ver: function (d) {
    var t = chamadoCliente_(d);
    var msgs = mensagens_(t.id).filter(function (m) { return m.de !== "int"; });
    return { ok: true, chamado: publico_(t, false), mensagens: msgs, empresa: cfg_("empresa"), v: versao_() };
  },

  clienteMsg: function (d) {
    var t = chamadoCliente_(d), x = lim_(d.texto, 2000);
    if (!x) throw new Error("Escreva a mensagem.");
    return comTrava_(function () {
      msg_(t.id, "cli", t.nome, x);
      var st = t.status === "Aguardando cliente" ? "Em atendimento" : (t.status === "Resolvido" ? "Em atendimento" : t.status);
      if (t.status === "Resolvido") hist_(t.id, t.nome + " (cliente)", "reabriu o chamado", "");
      atualizar_(t.id, { status: st, atualizado: new Date() });
      hist_(t.id, t.nome + " (cliente)", "respondeu", resumo_(x));
      mudou_();
      push_(tecsPush_(t.tecnico ? function (r) { return r.nome === t.tecnico; } : null), "💬 " + primeiro_(t.nome) + " respondeu o chamado #" + t.id, resumo_(x), linkTec_());
      return { ok: true };
    });
  },

  clienteAcesso: function (d) {
    var t = chamadoCliente_(d);
    if (t.acesso !== "pendente") throw new Error("Não há pedido de acesso em aberto.");
    return comTrava_(function () {
      var ok = !!d.permitir;
      atualizar_(t.id, { acesso: ok ? "aprovado" : "recusado", atualizado: new Date() });
      msg_(t.id, "sis", "", primeiro_(t.nome) + (ok ? " autorizou o acesso remoto ao computador." : " recusou o acesso remoto."));
      hist_(t.id, t.nome + " (cliente)", ok ? "autorizou o acesso remoto" : "recusou o acesso remoto", "");
      mudou_();
      return { ok: true };
    });
  },

  avaliar: function (d) {
    var t = chamadoCliente_(d), n = Math.round(Number(d.nota));
    if (!(n >= 1 && n <= 5)) throw new Error("Nota inválida.");
    return comTrava_(function () {
      atualizar_(t.id, { nota: n });
      msg_(t.id, "sis", "", primeiro_(t.nome) + " avaliou o atendimento com " + n + " estrela" + (n > 1 ? "s" : "") + ".");
      hist_(t.id, t.nome + " (cliente)", "avaliou", n + " estrela" + (n > 1 ? "s" : "") + (d.comentario ? " · " + lim_(d.comentario, 300) : ""));
      if (d.comentario) msg_(t.id, "cli", t.nome, lim_(d.comentario, 300));
      mudou_();
      return { ok: true };
    });
  },

  /* ======== TÉCNICOS ======== */
  login: function (d) {
    var email = String(d.email || "").trim().toLowerCase(), pin = String(d.pin || "").trim();
    var tec = linhas_("Tecnicos").filter(function (r) {
      return String(r.email).trim().toLowerCase() === email && String(r.pin).trim() === pin && sim_(r.ativo);
    })[0];
    if (!tec) throw new Error("E-mail ou senha incorretos.");
    var token = Utilities.getUuid();
    guardarSessao_(token, JSON.stringify({ nome: tec.nome, email: email, gestor: sim_(tec.gestor) }));
    return { ok: true, token: token, nome: tec.nome, gestor: sim_(tec.gestor), empresa: cfg_("empresa"), distribuicao: cfg_("distribuicao") };
  },

  painel: function (d) {
    var eu = sessao_(d);
    var v = versao_();
    if (d.v && Number(d.v) === v) return { ok: true, mudou: false, v: v };
    var limite = Date.now() - 45 * 24 * H;
    var lista = linhas_("Chamados").filter(function (t) {
      return t.status !== "Resolvido" || ms_(t.resolvido || t.atualizado) > limite;
    }).map(function (t) { return publico_(t, true); });
    var tecs = linhas_("Tecnicos").filter(function (r) { return sim_(r.ativo); }).map(function (r) { return { nome: r.nome, gestor: sim_(r.gestor) }; });
    return { ok: true, mudou: true, v: v, eu: eu, chamados: lista, tecnicos: tecs, empresa: cfg_("empresa"), distribuicao: cfg_("distribuicao") };
  },

  detalhe: function (d) {
    var eu = sessao_(d), t = achar_(d.id);
    var hs = linhas_("Historico").filter(function (h) { return Number(h.chamado) === t.id; });
    var jaViu = hs.some(function (h) { return h.quem === eu.nome && h.acao === "visualizou"; });
    if (!jaViu) { hist_(t.id, eu.nome, "visualizou", ""); hs.push({ quando: new Date(), chamado: t.id, quem: eu.nome, acao: "visualizou", detalhe: "" }); }
    return {
      ok: true, chamado: publico_(t, true), mensagens: mensagens_(t.id),
      historico: hs.map(function (h) { return { quando: ms_(h.quando), quem: h.quem, acao: h.acao, detalhe: h.detalhe }; })
    };
  },

  acao: function (d) {
    var eu = sessao_(d);
    if (d.tipo === "verConfig" || d.tipo === "salvarConfig" || d.tipo === "salvarTecnico") return configGestor_(eu, d);
    return comTrava_(function () {
      var t = achar_(d.id), agora = new Date(), x;
      switch (d.tipo) {
        case "assumir":
          if (t.tecnico && t.tecnico !== eu.nome && !d.forcar) throw new Error("Este chamado já está com " + t.tecnico + ".");
          atualizar_(t.id, { tecnico: eu.nome, status: t.status === "Aberto" ? "Em atendimento" : t.status, atualizado: agora });
          msg_(t.id, "sis", "", eu.nome + " assumiu o chamado.");
          hist_(t.id, eu.nome, "assumiu o chamado", t.tecnico ? "estava com " + t.tecnico : "");
          push_(["C_" + t.id], cfg_("empresa"), "👨‍🔧 " + eu.nome + " está cuidando do seu chamado #" + t.id + ".", linkCli_(t));
          break;
        case "transferir":
          var para = String(d.para || "");
          if (!linhas_("Tecnicos").some(function (r) { return r.nome === para && sim_(r.ativo); })) throw new Error("Técnico não encontrado.");
          atualizar_(t.id, { tecnico: para, atualizado: agora });
          msg_(t.id, "sis", "", "Chamado transferido para " + para + ".");
          hist_(t.id, eu.nome, "transferiu", "de " + (t.tecnico || "ninguém") + " para " + para + (d.motivo ? " · " + lim_(d.motivo, 200) : ""));
          avisarTransferencia_(t, para, eu.nome);
          push_(tecsPush_(function (r) { return r.nome === para; }), "Chamado #" + t.id + " transferido para você", eu.nome + " · " + t.assunto, linkTec_());
          break;
        case "responder":
          x = lim_(d.texto, 3000);
          if (!x) throw new Error("Escreva a mensagem.");
          if (d.interno) {
            msg_(t.id, "int", eu.nome, x);
            hist_(t.id, eu.nome, "anotação interna", resumo_(x));
          } else {
            var mud = { atualizado: agora };
            if (!t.tecnico) { mud.tecnico = eu.nome; hist_(t.id, eu.nome, "assumiu o chamado", "ao responder"); }
            if (t.status === "Aberto") mud.status = "Em atendimento";
            atualizar_(t.id, mud);
            msg_(t.id, "tec", eu.nome, x);
            hist_(t.id, eu.nome, "respondeu ao cliente", resumo_(x));
            avisarCliente_(t, eu.nome, x);
            push_(["C_" + t.id], cfg_("empresa"), "💬 " + eu.nome + ": " + resumo_(x), linkCli_(t));
          }
          break;
        case "status":
          if (STATUS.indexOf(d.valor) < 0) throw new Error("Status inválido.");
          if (d.valor === "Resolvido") throw new Error("Use o botão Resolver.");
          atualizar_(t.id, { status: d.valor, atualizado: agora, resolvido: "" });
          msg_(t.id, "sis", "", "Status alterado para " + d.valor + ".");
          hist_(t.id, eu.nome, "mudou o status", t.status + " → " + d.valor);
          break;
        case "pedirAcesso":
          atualizar_(t.id, { acesso: "pendente", atualizado: agora });
          msg_(t.id, "sis", "", eu.nome + " pediu acesso remoto ao computador.");
          hist_(t.id, eu.nome, "pediu acesso remoto", (t.app || "") + " " + (t.rid || ""));
          push_(["C_" + t.id], cfg_("empresa"), "🖥 " + eu.nome + " pediu para acessar o seu computador. Toque para permitir.", linkCli_(t));
          break;
        case "conectou":
          msg_(t.id, "sis", "", eu.nome + " conectou ao computador" + (t.rid ? " (" + (t.app || "acesso remoto") + " " + t.rid + ")" : "") + ".");
          hist_(t.id, eu.nome, "acessou o computador", (t.app || "") + " " + (t.rid || ""));
          break;
        case "encerrouAcesso":
          msg_(t.id, "sis", "", "Acesso remoto encerrado" + (d.texto ? ": " + lim_(d.texto, 300) : "."));
          hist_(t.id, eu.nome, "encerrou o acesso remoto", lim_(d.texto, 300));
          atualizar_(t.id, { acesso: "", atualizado: agora });
          break;
        case "resolver":
          var min = Math.max(0, Math.round(Number(d.minutos) || 0));
          atualizar_(t.id, { status: "Resolvido", resolvido: agora, minutos: min, tecnico: t.tecnico || eu.nome, acesso: "", atualizado: agora });
          if (d.texto) { msg_(t.id, "tec", eu.nome, lim_(d.texto, 3000)); avisarCliente_(t, eu.nome, lim_(d.texto, 3000), true); }
          msg_(t.id, "sis", "", "Chamado resolvido por " + eu.nome + ". Tempo de atendimento: " + fmtMin_(min) + ".");
          hist_(t.id, eu.nome, "resolveu o chamado", fmtMin_(min));
          push_(["C_" + t.id], cfg_("empresa"), "✅ Seu chamado #" + t.id + " foi resolvido. Conte como foi o atendimento.", linkCli_(t));
          break;
        case "reabrir":
          atualizar_(t.id, { status: "Em atendimento", resolvido: "", atualizado: agora });
          msg_(t.id, "sis", "", eu.nome + " reabriu o chamado.");
          hist_(t.id, eu.nome, "reabriu o chamado", "");
          break;
        default: throw new Error("Ação desconhecida.");
      }
      mudou_();
      return { ok: true };
    });
  },

  historico: function (d) {
    var eu = sessao_(d);
    if (!eu.gestor) throw new Error("Só o gestor vê o histórico geral.");
    var hs = linhas_("Historico");
    var n = Math.min(Number(d.limite) || 300, 2000);
    return { ok: true, historico: hs.slice(-n).reverse().map(function (h) { return { quando: ms_(h.quando), chamado: h.chamado, quem: h.quem, acao: h.acao, detalhe: h.detalhe }; }) };
  }
};

/* ---------------- e-mails ---------------- */
function linkCli_(t) { var l = cfg_("link_sistema"); return l ? l + (l.indexOf("?") < 0 ? "?" : "&") + "c=" + t.id + "&k=" + t.chave : ""; }
function linkTec_() { var l = cfg_("link_sistema"); return l ? l + "#tecnico" : ""; }
function tecsPush_(filtro) {
  return linhas_("Tecnicos").filter(function (r) { return sim_(r.ativo) && (!filtro || filtro(r)); })
    .map(function (r) { return "T_" + String(r.email).trim().toLowerCase(); });
}
function avisarNovo_(t) {
  if (!sim_(cfg_("avisar_tecnicos_email"))) return;
  var tecs = linhas_("Tecnicos").filter(function (r) { return sim_(r.ativo) && /@/.test(r.email); });
  if (t.tecnico) tecs = tecs.filter(function (r) { return r.nome === t.tecnico || sim_(r.gestor); });
  var para = tecs.map(function (r) { return r.email; }).join(",");
  if (!para) return;
  var link = cfg_("link_sistema");
  enviar_(para, "🔔 Novo chamado #" + t.id + " · " + t.empresa + " · " + t.assunto,
    "<h2 style='margin:0 0 8px'>Novo chamado #" + t.id + "</h2>" +
    tabela_([["Prioridade", t.prioridade], ["Cliente", t.nome], ["Empresa", t.empresa], ["Telefone", t.tel], ["E-mail", t.email], ["Setor", t.setor],
             ["Tipo", t.categoria], ["Assunto", t.assunto], ["Descrição", t.descricao], ["Patrimônio", t.patrimonio],
             ["Acesso remoto", (t.app || "") + " " + (t.rid || "")], ["Encaminhado para", t.tecnico || "Fila (todos)"]]) +
    (link ? "<p><a href='" + link + "#tecnico' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Abrir a Atende Fácil</a></p>" : ""));
}
function confirmarCliente_(t) {
  if (!sim_(cfg_("avisar_cliente_email")) || !/@/.test(t.email)) return;
  var link = cfg_("link_sistema"), emp = cfg_("empresa");
  var url = link ? link + (link.indexOf("?") < 0 ? "?" : "&") + "c=" + t.id + "&k=" + t.chave : "";
  enviar_(t.email, "Recebemos seu chamado #" + t.id + " · " + emp,
    "<p>Olá, " + esc_(primeiro_(t.nome)) + "!</p><p>Recebemos seu chamado <b>#" + t.id + " · " + esc_(t.assunto) + "</b>. Nossa equipe já foi avisada.</p>" +
    (url ? "<p><a href='" + url + "' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Acompanhar o chamado</a></p>" : "") +
    "<p style='color:#4A5B75'>" + esc_(emp) + "</p>", emp);
}
function avisarTransferencia_(t, para, por) {
  if (!sim_(cfg_("avisar_tecnicos_email"))) return;
  var r = linhas_("Tecnicos").filter(function (x) { return x.nome === para; })[0];
  if (!r || !/@/.test(r.email)) return;
  var link = cfg_("link_sistema");
  enviar_(r.email, "Chamado #" + t.id + " transferido para você", "<p>" + esc_(por) + " transferiu para você o chamado <b>#" + t.id + " · " + esc_(t.assunto) + "</b> (" + esc_(t.empresa) + ").</p>" +
    (link ? "<p><a href='" + link + "#tecnico'>Abrir a Atende Fácil</a></p>" : ""));
}
function avisarCliente_(t, tecnico, texto, resolvido) {
  if (!sim_(cfg_("avisar_cliente_email")) || !/@/.test(t.email)) return;
  var link = cfg_("link_sistema"), emp = cfg_("empresa");
  var url = link ? link + (link.indexOf("?") < 0 ? "?" : "&") + "c=" + t.id + "&k=" + t.chave : "";
  enviar_(t.email, (resolvido ? "Chamado #" + t.id + " resolvido" : "Resposta no seu chamado #" + t.id) + " · " + emp,
    "<p>Olá, " + esc_(primeiro_(t.nome)) + "!</p><p><b>" + esc_(tecnico) + "</b> respondeu seu chamado <b>#" + t.id + " · " + esc_(t.assunto) + "</b>:</p>" +
    "<blockquote style='border-left:4px solid #8EC5E8;margin:0;padding:8px 12px;background:#F2F6FA'>" + esc_(texto).replace(/\n/g, "<br>") + "</blockquote>" +
    (url ? "<p><a href='" + url + "' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Ver e responder o chamado</a></p>" : "") +
    "<p style='color:#4A5B75'>" + esc_(emp) + "</p>", emp);
}
function enviar_(para, assunto, html, nome) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return;
    MailApp.sendEmail({ to: para, subject: assunto, htmlBody: "<div style='font-family:Arial,sans-serif;color:#0E2238;font-size:14px'>" + html + "</div>", name: nome || "Atende Fácil" });
  } catch (x) { console.log("e-mail não enviado: " + x); }
}
function tabela_(linhas) {
  return "<table style='border-collapse:collapse'>" + linhas.filter(function (l) { return String(l[1] || "").trim(); }).map(function (l) {
    return "<tr><td style='padding:4px 12px 4px 0;color:#4A5B75;vertical-align:top'>" + l[0] + "</td><td style='padding:4px 0'><b>" + esc_(l[1]).replace(/\n/g, "<br>") + "</b></td></tr>";
  }).join("") + "</table>";
}

/* ---------------- anexos ---------------- */
function pastaAnexos_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty("PASTA");
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var f = DriveApp.createFolder("Atende Fácil · anexos");
  p.setProperty("PASTA", f.getId());
  return f;
}
function salvarAnexo_(a) {
  var bytes = Utilities.base64Decode(String(a.base64));
  if (bytes.length > 8 * 1024 * 1024) throw new Error("O anexo passa de 8 MB.");
  var blob = Utilities.newBlob(bytes, a.tipo || "application/octet-stream", lim_(a.nome, 100) || "anexo");
  var arq = pastaAnexos_().createFile(blob);
  try { arq.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) {}
  return arq.getUrl();
}

/* ---------------- planilha ---------------- */
function planilha_() {
  var id = PropertiesService.getScriptProperties().getProperty("PLANILHA");
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function aba_(n) {
  var sh = planilha_().getSheetByName(n);
  if (!sh) throw new Error("A aba " + n + " não existe. Rode a função configurar.");
  return sh;
}
function linhas_(n) {
  var v = aba_(n).getDataRange().getValues(), cab = v.shift();
  return v.filter(function (r) { return r.join("") !== ""; }).map(function (r) {
    var o = {}; cab.forEach(function (c, i) { o[c] = r[i]; }); return o;
  });
}
function inserir_(n, o) {
  aba_(n).appendRow(ABAS[n].map(function (c) { return txt_(o[c] === undefined ? "" : o[c]); }));
}
function achar_(id) {
  id = Number(id);
  var t = linhas_("Chamados").filter(function (r) { return Number(r.id) === id; })[0];
  if (!t) throw new Error("Chamado não encontrado.");
  t.id = Number(t.id);
  return t;
}
function atualizar_(id, campos) {
  var sh = aba_("Chamados"), ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === Number(id)) {
      Object.keys(campos).forEach(function (c) {
        var col = ABAS.Chamados.indexOf(c);
        if (col >= 0) sh.getRange(i + 2, col + 1).setValue(txt_(campos[c]));
      });
      return;
    }
  }
}
function msg_(id, de, autor, texto) { inserir_("Mensagens", { chamado: id, quando: new Date(), de: de, autor: autor, texto: texto }); }
function hist_(id, quem, acao, det) { inserir_("Historico", { quando: new Date(), chamado: id, quem: quem, acao: acao, detalhe: det || "" }); }
function mensagens_(id) {
  return linhas_("Mensagens").filter(function (m) { return Number(m.chamado) === Number(id); })
    .map(function (m) { return { quando: ms_(m.quando), de: m.de, autor: m.autor, texto: String(m.texto) }; });
}
function cfg_(k) {
  var r = linhas_("Config").filter(function (x) { return x.chave === k; })[0];
  return r ? String(r.valor) : "";
}
function setCfg_(k, v) {
  var sh = aba_("Config"), v0 = sh.getDataRange().getValues();
  for (var i = 1; i < v0.length; i++) if (v0[i][0] === k) { sh.getRange(i + 1, 2).setValue(v); return; }
  sh.appendRow([k, v, ""]);
}
function proximoRodizio_() {
  var tecs = linhas_("Tecnicos").filter(function (r) { return sim_(r.ativo) && !sim_(r.gestor); });
  if (!tecs.length) tecs = linhas_("Tecnicos").filter(function (r) { return sim_(r.ativo); });
  if (!tecs.length) return "";
  var pos = (Number(cfg_("rodizio_pos")) || 0) % tecs.length;
  setCfg_("rodizio_pos", pos + 1);
  return tecs[pos].nome;
}

/* ---------------- sessão, versão e trava ---------------- */
function sessao_(d) {
  var s = lerSessao_(d.token, function (v) {
    var em = String(JSON.parse(v).email || "").toLowerCase();
    return linhas_("Tecnicos").some(function (r) { return String(r.email).trim().toLowerCase() === em && sim_(r.ativo); });
  });
  if (!s) throw new Error("SESSAO");
  return JSON.parse(s);
}
function chamadoCliente_(d) {
  var t = achar_(d.id);
  if (!d.chave || String(t.chave) !== String(d.chave)) throw new Error("Chamado não encontrado.");
  return t;
}
function versao_() { return Number(PropertiesService.getScriptProperties().getProperty("VERSAO") || 1); }
function mudou_() { PropertiesService.getScriptProperties().setProperty("VERSAO", String(Date.now())); }
function comTrava_(fn) {
  var l = LockService.getScriptLock();
  if (!l.tryLock(20000)) throw new Error("Sistema ocupado, tente de novo em alguns segundos.");
  try { return fn(); } finally { SpreadsheetApp.flush(); l.releaseLock(); }
}

/* ---------------- utilidades ---------------- */
function publico_(t, interno) {
  var o = {};
  ABAS.Chamados.forEach(function (c) { if (c !== "chave") o[c] = t[c]; });
  ["criado", "atualizado", "prazo", "resolvido"].forEach(function (c) { o[c] = ms_(t[c]); });
  o.id = Number(t.id);
  o.permite = sim_(t.permite);
  o.nota = t.nota === "" ? null : Number(t.nota);
  o.minutos = t.minutos === "" ? null : Number(t.minutos);
  return o;
}
// o apóstrofo faz a planilha guardar como texto: telefone e código do AnyDesk não viram número
// e nada que o cliente digitar vira fórmula
function txt_(v) { return (typeof v === "string" && v !== "") ? "'" + v : v; }
function ms_(v) { if (!v) return null; if (v instanceof Date) return v.getTime(); var n = Number(v); if (!isNaN(n) && n > 0) return n; var d = new Date(v); return isNaN(d) ? null : d.getTime(); }
function sim_(v) { return /^s/i.test(String(v).trim()); }
function lim_(v, n) { return String(v === undefined || v === null ? "" : v).trim().slice(0, n); }
function resumo_(x) { x = String(x).replace(/\s+/g, " "); return x.length > 120 ? x.slice(0, 117) + "…" : x; }
function primeiro_(n) { return String(n || "").trim().split(" ")[0]; }
function esc_(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function fmtMin_(m) { m = Number(m) || 0; var h = Math.floor(m / 60), r = m % 60; return h ? h + " h" + (r ? " " + r + " min" : "") : r + " min"; }

/* ---------------- avisos no celular, mesmo com o app fechado (OneSignal) ---------------- */
var ONESIGNAL_APP = "7a1178de-2e8b-4205-aeb9-8171f97fb614";
function pushGuardar_(chave, sub) {
  sub = String(sub || "").trim();
  if (!/^[0-9a-zA-Z-]{20,80}$/.test(sub)) throw new Error("Aparelho inválido.");
  var P = PropertiesService.getScriptProperties(), k = "PS_" + chave, o = { s: [], t: 0 };
  try { o = JSON.parse(P.getProperty(k) || '{"s":[]}'); } catch (x) {}
  var l = (o.s || []).filter(function (s) { return s !== sub; }); l.push(sub);
  P.setProperty(k, JSON.stringify({ s: l.slice(-5), t: Date.now() }));
  if (Math.random() < 0.03) pushLimpar_();
}
function pushLimpar_() {
  try {
    var P = PropertiesService.getScriptProperties(), tudo = P.getProperties(), velho = Date.now() - 120 * 86400000;
    Object.keys(tudo).forEach(function (k) {
      if (k.indexOf("PS_") !== 0) return;
      try { if ((JSON.parse(tudo[k]).t || 0) < velho) P.deleteProperty(k); } catch (x) { P.deleteProperty(k); }
    });
  } catch (x) {}
}
function pushDe_(chave) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("PS_" + chave) || '{"s":[]}').s || []; } catch (x) { return []; } }
function pushChave_() { return String(cfg_("push_chave") || "").trim(); }
function push_(chaves, titulo, texto, url) {
  try {
    var key = pushChave_();
    if (!key) return;
    var subs = [];
    chaves.forEach(function (c) { pushDe_(c).forEach(function (s) { if (subs.indexOf(s) < 0) subs.push(s); }); });
    if (!subs.length) return;
    var corpo = { app_id: ONESIGNAL_APP, target_channel: "push", include_subscription_ids: subs, headings: { en: String(titulo).slice(0, 80) }, contents: { en: String(texto).slice(0, 200) },
      chrome_web_icon: "https://dailva123.github.io/dayia/chamados/icon-192.png", chrome_web_badge: "https://dailva123.github.io/dayia/chamados/icon-192.png", ttl: 86400 };
    if (url) corpo.url = url;
    var r = UrlFetchApp.fetch("https://api.onesignal.com/notifications?c=push", { method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { Authorization: (/^os_v2_/.test(key) ? "Key " : "Basic ") + key }, payload: JSON.stringify(corpo) });
    if (r.getResponseCode() >= 300) console.log("aviso push recusado: " + r.getResponseCode() + " " + r.getContentText().slice(0, 300));
  } catch (x) { console.log("aviso push não enviado: " + x); }
}
function testarAviso() {
  var key = pushChave_();
  if (!key) { console.log("❌ Falta colar a chave do OneSignal na aba Config (linha push_chave, coluna B)."); return "Falta colar a chave do OneSignal na aba Config (linha push_chave)."; }
  var r = UrlFetchApp.fetch("https://api.onesignal.com/notifications?c=push", { method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { Authorization: (/^os_v2_/.test(key) ? "Key " : "Basic ") + key },
    payload: JSON.stringify({ app_id: ONESIGNAL_APP, target_channel: "push", include_subscription_ids: ["00000000-0000-0000-0000-000000000000"], contents: { en: "teste" } }) });
  var c = r.getResponseCode();
  var msg = (c === 401 || c === 403) ? "❌ A chave não foi aceita (" + c + "). Confira se copiou inteira, sem espaço." : "✅ Chave do OneSignal funcionando!";
  console.log(msg);
  return msg;
}

/* ---------------- configurações pelo painel do gestor ---------------- */
function linhaExemploGestor_() {
  var v = aba_("Tecnicos").getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][1]).trim().toLowerCase() === "dono@suaempresa.com.br" && sim_(v[i][3])) return i + 1;
  return 0;
}
function configGestor_(eu, d) {
  if (!eu.gestor) throw new Error("Só o gestor mexe nas configurações.");
  if (d.tipo === "verConfig") {
    return { ok: true, empresa: cfg_("empresa"), distribuicao: cfg_("distribuicao"), avisar_tecnicos_email: sim_(cfg_("avisar_tecnicos_email")), avisar_cliente_email: sim_(cfg_("avisar_cliente_email")),
      tecnicos: linhas_("Tecnicos").filter(function (r) { return String(r.nome).trim(); }).map(function (r) { return { nome: String(r.nome), email: String(r.email), gestor: sim_(r.gestor), ativo: sim_(r.ativo) }; }) };
  }
  return comTrava_(function () {
    if (d.tipo === "salvarConfig") {
      var emp = lim_(d.empresa, 80);
      if (!emp) throw new Error("Coloque o nome da empresa.");
      setCfg_("empresa", emp);
      setCfg_("distribuicao", d.distribuicao === "rodizio" ? "rodizio" : "fila");
      setCfg_("avisar_tecnicos_email", d.at ? "SIM" : "NÃO");
      setCfg_("avisar_cliente_email", d.ac ? "SIM" : "NÃO");
    } else {
      var t = d.tec || {}, nome = lim_(t.nome, 60), email = lim_(t.email, 120).toLowerCase(), pin = lim_(t.pin, 20), orig = lim_(t.orig, 120).toLowerCase();
      if (!nome) throw new Error("Coloque o nome.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Coloque um e-mail válido.");
      if (pin && pin.length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres.");
      if (orig === String(eu.email).toLowerCase() && (!t.gestor || !t.ativo)) throw new Error("Você não pode tirar o seu próprio acesso de gestor.");
      var sh = aba_("Tecnicos"), v = sh.getDataRange().getValues(), linha = -1;
      for (var i = 1; i < v.length; i++) {
        var em = String(v[i][1]).trim().toLowerCase();
        if (orig && em === orig) linha = i + 1;
        else if (em === email) throw new Error("Já existe alguém da equipe com esse e-mail.");
      }
      if (!orig && v.some(function (r, i) { return i > 0 && String(r[0]).trim().toLowerCase() === nome.toLowerCase(); })) throw new Error("Já existe alguém da equipe com esse nome.");
      if (linha < 0) {
        if (orig) throw new Error("Pessoa não encontrada.");
        if (!pin) throw new Error("Crie uma senha para a pessoa nova.");
        sh.appendRow([nome, email, "'" + pin, t.gestor ? "SIM" : "NÃO", t.ativo ? "SIM" : "NÃO"]);
      } else {
        sh.getRange(linha, 2).setValue(email);
        if (pin) sh.getRange(linha, 3).setValue("'" + pin);
        sh.getRange(linha, 4, 1, 2).setValues([[t.gestor ? "SIM" : "NÃO", t.ativo ? "SIM" : "NÃO"]]);
      }
    }
    mudou_();
    return { ok: true };
  });
}

/* ---------------- sessão longa: fica conectado por 30 dias ---------------- */
var SESSAO_DIAS = 30;
function guardarSessao_(token, valor) {
  CacheService.getScriptCache().put("tk_" + token, valor, 21600);
  PropertiesService.getScriptProperties().setProperty("SS_" + token, JSON.stringify({ v: valor, exp: Date.now() + SESSAO_DIAS * 86400000 }));
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
    P.setProperty("SS_" + token, JSON.stringify({ v: o.v, exp: Date.now() + SESSAO_DIAS * 86400000 }));
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
