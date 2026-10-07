/* =====================================================================
   AGENDA FÁCIL by DayIA  ·  servidor (Google Apps Script)
   ---------------------------------------------------------------------
   UMA planilha só para todos os negócios. Cada negócio se cadastra
   sozinho na página "Criar minha agenda" e recebe o próprio link.
   Você controla tudo pela aba "Negocios" (coluna situacao):
     teste     → funciona até a data da coluna teste_ate
     ativo     → cliente pagante, funciona normalmente
     cortesia  → funciona sempre, sem cobrança e sem nenhum aviso
     suspenso  → o link e o painel mostram "fale com a DayIA"

   Instalação (uma vez só):
   1. Crie uma planilha Google em branco chamada "Agenda Fácil".
   2. Extensões > Apps Script. Apague o que estiver lá e cole este arquivo.
   3. Selecione a função "configurar" e clique em Executar (autorize).
   4. Implantar > Nova implantação > App da Web
        Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
   5. Copie o endereço que termina em /exec.
   ===================================================================== */

var VERSAO_SISTEMA = "2.1";
var ABAS = {
  Negocios:     ["n","nome","segmento","situacao","teste_ate","criado","dono","whatsapp_dono","email_dono","senha","telefone","endereco","instagram","email_aviso","dias","abre","fecha","intervalo_ini","intervalo_fim","passo","antecedencia","cancelar_ate","observacao"],
  Agendamentos: ["negocio","id","criado","ini","fim","quando","cliente","tel","email","pet","servico","servico_nome","prof","prof_nome","preco","status","origem","obs","conversa","recado_novo","chave"],
  Servicos:     ["negocio","id","nome","minutos","preco","ativo"],
  Equipe:       ["negocio","id","nome","ativo"],
  Bloqueios:    ["negocio","id","prof","ini","fim","quando","motivo"],
  Config:       ["chave","valor","explicacao"]
};
var MIN = 60000, DIA = 86400000;
var MODELOS = {
  manicure: { serv: [["Manicure",40,35],["Pedicure",50,40],["Pé e mão",80,70],["Esmaltação em gel",60,80],["Design de sobrancelhas",30,40],["Alongamento em fibra",150,180],["Manutenção do alongamento",90,120]], dias: "2,3,4,5,6", abre: "09:00", fecha: "19:00", alm: ["12:00","13:00"] },
  estetica: { serv: [["Limpeza de pele",60,150],["Drenagem linfática",50,120],["Massagem relaxante",60,130],["Design de sobrancelhas",30,45],["Depilação a laser",30,90],["Peeling",45,180]], dias: "1,2,3,4,5,6", abre: "08:00", fecha: "19:00", alm: ["12:00","13:00"] },
  medico:   { serv: [["Primeira consulta",50,300],["Consulta",30,250],["Retorno",20,0],["Pequeno procedimento",40,200]], dias: "1,2,3,4,5", abre: "08:00", fecha: "18:00", alm: ["12:00","13:30"] },
  odonto:   { serv: [["Avaliação",30,0],["Limpeza",45,180],["Restauração",60,250],["Clareamento",90,600],["Manutenção de aparelho",30,150]], dias: "1,2,3,4,5,6", abre: "08:00", fecha: "18:00", alm: ["12:00","13:00"] },
  psico:    { serv: [["Primeira sessão",60,180],["Sessão individual",50,160],["Sessão de casal",80,250],["Sessão online",50,150]], dias: "1,2,3,4,5", abre: "08:00", fecha: "21:00", alm: ["12:00","13:00"] },
  salao:    { serv: [["Corte masculino",30,45],["Barba",30,35],["Corte + barba",60,70],["Corte feminino",60,90],["Escova",45,60],["Coloração",120,180]], dias: "2,3,4,5,6", abre: "09:00", fecha: "20:00", alm: ["13:00","14:00"] },
  pet:      { serv: [["Banho (porte pequeno)",60,60],["Banho (porte grande)",90,90],["Banho e tosa",120,110],["Tosa higiênica",40,45],["Consulta veterinária",30,150]], dias: "1,2,3,4,5,6", abre: "08:00", fecha: "18:00", alm: ["12:00","13:00"] },
  fisio:    { serv: [["Avaliação",60,150],["Sessão de fisioterapia",50,120],["Pilates",50,90],["RPG",50,130]], dias: "1,2,3,4,5,6", abre: "07:00", fecha: "20:00", alm: ["12:00","13:00"] },
  outro:    { serv: [["Atendimento",60,100]], dias: "1,2,3,4,5", abre: "09:00", fecha: "18:00", alm: ["12:00","13:00"] }
};

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
    ["dias_teste", "30", "Quantos dias de teste grátis cada negócio novo ganha"],
    ["cadastro_aberto", "SIM", "SIM = qualquer negócio pode criar a agenda pelo site · NÃO = só você cadastra"],
    ["email_admin", "", "Seu e-mail: recebe aviso a cada negócio novo que se cadastrar"],
    ["whatsapp_dayia", "5519999389118", "WhatsApp que aparece para negócios com teste vencido ou suspensos"],
    ["fuso_minutos", "-180", "Fuso horário (Brasília = -180). Não mexa."],
    ["proximo_id", "1", "Uso interno (não mexa)"],
    ["link_base", "", "Preenchido sozinho"],
    ["push_chave", "", "Chave do OneSignal: avisos no celular mesmo com o app fechado (cole aqui a chave)"]
  ];
  var tem = cfg.getDataRange().getValues().map(function (r) { return r[0]; });
  padrao.forEach(function (p) { if (tem.indexOf(p[0]) < 0) cfg.appendRow([p[0], txt_(p[1]), p[2]]); });
  cfg.autoResizeColumns(1, 3);
  // a Ilumine-se já entra pronta, como cortesia
  if (!negocio_("ilumine-se", true)) {
    criarNegocio_({ n: "ilumine-se", nome: "Ilumine-se", segmento: "manicure", situacao: "cortesia", dono: "Palmira Pastor", senha: "1234",
      servicos: [["Manicure",40,35],["Pedicure",50,40],["Pé e mão",80,70],["Esmaltação em gel",60,80],["Design de sobrancelhas",30,40],["Sobrancelha com henna",40,50],["Alongamento em fibra",150,180],["Manutenção do alongamento",90,120]] });
  }
  var sobra = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
  if (sobra && sobra.getLastRow() === 0 && ss.getSheets().length > 6) ss.deleteSheet(sobra);
  MailApp.getRemainingDailyQuota();
  return "Pronto! Agora faça a implantação como App da Web.";
}

/* ---------------- entrada ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.acao) return responder_(executar_(p));
  return ContentService.createTextOutput("Agenda Fácil by DayIA · servidor funcionando (versão " + VERSAO_SISTEMA + ").");
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

  /* guarda o aparelho para receber avisos com o app fechado */
  pushReg: function (d) {
    if (d.token) { pushGuardar_("N_" + sessao_(d), d.sub); }
    else {
      var N = negocio_(d.n);
      (d.lista || []).slice(0, 10).forEach(function (x) { try { var a = daCliente_(N, x); pushGuardar_("A_" + N.n + "_" + a.id, d.sub); } catch (e) {} });
    }
    return { ok: true, ativo: !!pushChave_() };
  },

  /* ======== CADASTRO DE NEGÓCIO NOVO ======== */
  cadastro: function (d) {
    if (!sim_(cfgVal_("cadastro_aberto"))) throw new Error("O cadastro de novas agendas está fechado. Fale com a DayIA pelo WhatsApp.");
    var c = d.dados || {};
    var nome = lim_(c.nome, 60), dono = lim_(c.dono, 60), senha = String(c.senha || "");
    if (!nome) throw new Error("Coloque o nome do seu negócio.");
    if (!dono) throw new Error("Coloque o seu nome.");
    if (String(c.whatsapp || "").replace(/\D/g, "").length < 10) throw new Error("Coloque o seu WhatsApp com DDD.");
    if (senha.length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres.");
    var seg = MODELOS[c.segmento] ? c.segmento : "outro";
    return comTrava_(function () {
      var base = slug_(nome) || "agenda", n = base, i = 2;
      var todos = linhas_("Negocios").map(function (x) { return String(x.n).toLowerCase(); });
      while (todos.indexOf(n) >= 0) n = base + "-" + (i++);
      var dias = Number(cfgVal_("dias_teste")) || 30;
      criarNegocio_({ n: n, nome: nome, segmento: seg, situacao: "teste", teste_ate: Date.now() + dias * DIA, dono: dono,
        whatsapp_dono: lim_(c.whatsapp, 30), email_dono: lim_(c.email, 120), telefone: lim_(c.whatsapp, 30), email_aviso: lim_(c.email, 120), senha: senha });
      if (d.base) setCfg_("link_base", String(d.base).split("?")[0].split("#")[0]);
      var adm = cfgVal_("email_admin");
      if (/@/.test(adm)) enviar_(adm, "🎉 Novo cadastro na Agenda Fácil: " + nome,
        "<p><b>" + esc_(nome) + "</b> (" + esc_(seg) + ") criou uma agenda.</p><p>Responsável: " + esc_(dono) + "<br>WhatsApp: " + esc_(c.whatsapp) + "<br>E-mail: " + esc_(c.email) + "</p><p>Situação: teste por " + dias + " dias. Para mudar, use a aba Negocios da planilha.</p>", "Agenda Fácil");
      var lk = linkNeg_({ n: n });
      if (/@/.test(c.email || "") && lk) enviar_(lim_(c.email, 120), "Sua agenda " + nome + " está pronta!",
        "<p>Olá, " + esc_(dono.split(" ")[0]) + "!</p><p>Sua agenda online está pronta. Guarde este e-mail.</p>" +
        "<p><b>Link para as suas clientes agendarem</b> (coloque na bio e no WhatsApp):<br><a href='" + lk + "'>" + lk + "</a></p>" +
        "<p><b>Seu painel</b> (entre com a senha que você criou):<br><a href='" + lk + "#painel'>" + lk + "#painel</a></p>" +
        "<p>Você tem " + dias + " dias para testar à vontade.</p><p style='color:#4A5B75'>Agenda Fácil by DayIA</p>", "Agenda Fácil");
      return { ok: true, n: n, token: novoToken_(n), nome: nome, dias_teste: dias };
    });
  },

  /* ======== PÁGINA DA CLIENTE ======== */
  info: function (d) {
    var N = negocio_(d.n), agora = Date.now();
    if (!liberado_(N).ok) return { ok: true, bloqueado: true, negocio: { nome: String(N.nome) } };
    var ocup = agendamentos_(N.n).filter(function (a) { return a.status !== "cancelado" && a.fim > agora - DIA && a.ini < agora + 45 * DIA; })
      .map(function (a) { return { prof: a.prof, ini: a.ini, fim: a.fim }; });
    var bloq = bloqueios_(N.n).filter(function (b) { return b.fim > agora; }).map(function (b) { return { prof: b.prof, ini: b.ini, fim: b.fim }; });
    return { ok: true, negocio: publicoNeg_(N), segmento: N.segmento, horario: horario_(N), passo: Number(N.passo) || 15, antecedencia: Number(N.antecedencia) || 0,
      cancelar_ate: Number(N.cancelar_ate) || 0, servicos: servicos_(N.n, true), profs: equipe_(N.n, true), ocupados: ocup, bloq: bloq };
  },

  agendar: function (d) {
    var N = negocio_(d.n);
    if (!liberado_(N).ok) throw new Error("Esta agenda está indisponível no momento.");
    var c = d.dados || {};
    if (!lim_(c.nome, 80)) throw new Error("Coloque o seu nome.");
    if (String(c.tel || "").replace(/\D/g, "").length < 10) throw new Error("Coloque um WhatsApp com DDD.");
    var sv = servicos_(N.n, true).filter(function (s) { return s.id === String(c.servico); })[0];
    if (!sv) throw new Error("Serviço não encontrado.");
    var ini = Number(c.ini);
    if (!ini) throw new Error("Escolha um horário.");
    return comTrava_(function () {
      var H = horario_(N), ags = agendamentos_(N.n), bl = bloqueios_(N.n);
      var profs = equipe_(N.n, true).map(function (p) { return p.id; });
      var candidatos = c.prof ? [String(c.prof)] : profs;
      var livres = candidatos.filter(function (p) { return profs.indexOf(p) >= 0 && livre_(N, H, ags, bl, p, ini, sv.minutos, null, false); });
      if (!livres.length) return { ok: false, ocupado: true, erro: "Esse horário acabou de ser ocupado. Escolha outro, por favor." };
      var pid = livres[0];
      if (livres.length > 1) {
        var d0 = inicioDia_(ini), cont = {};
        livres.forEach(function (p) { cont[p] = 0; });
        ags.forEach(function (a) { if (a.status !== "cancelado" && inicioDia_(a.ini) === d0 && cont[a.prof] !== undefined) cont[a.prof]++; });
        pid = livres.sort(function (a, b) { return cont[a] - cont[b]; })[0];
      }
      if (d.base) setCfg_("link_base", String(d.base).split("?")[0].split("#")[0]);
      var a = {
        negocio: N.n, id: proximoId_(), criado: Date.now(), ini: ini, fim: ini + sv.minutos * MIN, quando: legivel_(ini), cliente: lim_(c.nome, 80), tel: lim_(c.tel, 30),
        email: lim_(c.email, 120), pet: lim_(c.pet, 40), servico: sv.id, servico_nome: sv.nome, prof: pid, prof_nome: nomeProf_(N.n, pid), preco: sv.preco,
        status: "pendente", origem: "online", obs: lim_(c.obs, 500), conversa: c.obs ? JSON.stringify([{ de: "cli", x: lim_(c.obs, 500), t: Date.now() }]) : "[]",
        recado_novo: c.obs ? "SIM" : "", chave: Utilities.getUuid().replace(/-/g, "").slice(0, 10)
      };
      inserir_("Agendamentos", a);
      mudou_(N.n);
      avisarNegocio_(a, N);
      emailCliente_(a, N, "novo");
      push_(["N_" + N.n], "📅 Novo agendamento: " + a.cliente, a.servico_nome + " · " + a.quando + (a.obs ? " · " + a.obs : ""), linkPainel_(N));
      return { ok: true, agendamento: publico_(a, true), chave: a.chave };
    });
  },

  meus: function (d) {
    var N = negocio_(d.n), todos = agendamentos_(N.n), out = [];
    (d.lista || []).slice(0, 30).forEach(function (x) {
      var a = todos.filter(function (y) { return y.id === Number(x.id) && String(y.chave) === String(x.chave); })[0];
      if (a) out.push(publico_(a, true));
    });
    return { ok: true, agendamentos: out, negocio: publicoNeg_(N), cancelar_ate: Number(N.cancelar_ate) || 0 };
  },

  cancelar: function (d) {
    return comTrava_(function () {
      var N = negocio_(d.n), a = daCliente_(N, d);
      if (a.status === "cancelado") return { ok: true };
      if (a.ini - Date.now() < (Number(N.cancelar_ate) || 0) * MIN) throw new Error("Falta pouco para o horário. Para cancelar, fale direto pelo WhatsApp.");
      var conv = conversa_(a); conv.push({ de: "sis", x: "Cancelado pela cliente.", t: Date.now() });
      atualizarAg_(a.id, { status: "cancelado", conversa: JSON.stringify(conv), recado_novo: "SIM" });
      mudou_(N.n);
      push_(["N_" + N.n], "❌ " + a.cliente + " cancelou o horário", a.servico_nome + " · " + a.quando, linkPainel_(N));
      return { ok: true };
    });
  },

  recado: function (d) {
    var x = lim_(d.texto, 500);
    if (!x) throw new Error("Escreva o recado.");
    return comTrava_(function () {
      var N = negocio_(d.n), a = daCliente_(N, d), conv = conversa_(a);
      conv.push({ de: "cli", x: x, t: Date.now() });
      atualizarAg_(a.id, { conversa: JSON.stringify(conv), recado_novo: "SIM" });
      mudou_(N.n);
      push_(["N_" + N.n], "💬 Recado de " + a.cliente, x, linkPainel_(N));
      return { ok: true };
    });
  },

  /* ======== PAINEL DO NEGÓCIO ======== */
  login: function (d) {
    var N = negocio_(d.n);
    if (!confereSenha_(N, String(d.senha || ""))) throw new Error("Senha incorreta.");
    return { ok: true, token: novoToken_(N.n), nome: String(N.nome) };
  },

  painel: function (d) {
    var n = sessao_(d), N = negocio_(n), lib = liberado_(N);
    var v = versao_(n);
    if (d.v && Number(d.v) === v) return { ok: true, mudou: false, v: v, licenca: lib };
    var de = Date.now() - 400 * DIA;
    return { ok: true, mudou: true, v: v, licenca: lib, negocio: publicoNeg_(N), segmento: N.segmento, horario: horario_(N), passo: Number(N.passo) || 15,
      antecedencia: Number(N.antecedencia) || 0, cancelar_ate: Number(N.cancelar_ate) || 0, email_aviso: String(N.email_aviso || ""),
      servicos: servicos_(n, false), profs: equipe_(n, false),
      ags: agendamentos_(n).filter(function (a) { return a.ini > de; }).map(function (a) { return publico_(a, false); }),
      bloq: bloqueios_(n).filter(function (b) { return b.fim > Date.now() - 7 * DIA; }) };
  },

  acao: function (d) {
    var n = sessao_(d), N = negocio_(n);
    if (!liberado_(N).ok && d.tipo !== "lido") throw new Error("Agenda suspensa. Fale com a DayIA para reativar.");
    return comTrava_(function () {
      var H = horario_(N), a, conv, agora = Date.now();
      switch (d.tipo) {
        case "status":
          a = doNegocio_(n, d.id);
          if (["pendente", "confirmado", "concluido", "faltou", "cancelado"].indexOf(d.valor) < 0) throw new Error("Situação inválida.");
          conv = conversa_(a);
          if (d.valor === "confirmado" || d.valor === "cancelado") conv.push({ de: "sis", x: d.valor === "confirmado" ? "Horário confirmado." : "Horário cancelado pelo negócio.", t: agora });
          atualizarAg_(a.id, { status: d.valor, conversa: JSON.stringify(conv) });
          if (d.valor === "confirmado") emailCliente_(a, N, "confirmado");
          if (d.valor === "cancelado") emailCliente_(a, N, "cancelado");
          if (d.valor === "confirmado" || d.valor === "cancelado") push_(["A_" + n + "_" + a.id], String(N.nome), (d.valor === "confirmado" ? "✅ Seu horário está confirmado: " : "❌ Seu horário foi cancelado: ") + a.servico_nome + " · " + a.quando, linkCliAg_(N, a));
          break;
        case "remarcar":
          a = doNegocio_(n, d.id);
          var sv = servicoPorId_(n, a.servico) || { minutos: (a.fim - a.ini) / MIN };
          var ini = Number(d.ini), prof = String(d.prof || a.prof);
          if (!d.forcar && !livre_(N, H, agendamentos_(n), bloqueios_(n), prof, ini, sv.minutos, a.id, true)) return { ok: false, ocupado: true, erro: "Horário ocupado ou fora do expediente." };
          conv = conversa_(a);
          conv.push({ de: "sis", x: "Horário remarcado para " + legivel_(ini) + ".", t: agora });
          atualizarAg_(a.id, { ini: ini, fim: ini + sv.minutos * MIN, quando: legivel_(ini), prof: prof, prof_nome: nomeProf_(n, prof), status: a.status === "faltou" || a.status === "cancelado" ? "confirmado" : a.status, conversa: JSON.stringify(conv) });
          a.quando = legivel_(ini); a.prof_nome = nomeProf_(n, prof);
          emailCliente_(a, N, "remarcado");
          push_(["A_" + n + "_" + a.id], String(N.nome), "🔁 Seu horário foi remarcado para " + a.quando + " (" + a.servico_nome + ")", linkCliAg_(N, a));
          break;
        case "novo":
          var c = d.dados || {}, s2 = servicoPorId_(n, c.servico);
          if (!s2) throw new Error("Serviço não encontrado.");
          if (!lim_(c.nome, 80)) throw new Error("Coloque o nome.");
          var i2 = Number(c.ini);
          if (!d.forcar && !livre_(N, H, agendamentos_(n), bloqueios_(n), String(c.prof), i2, s2.minutos, null, true)) return { ok: false, ocupado: true, erro: "Horário ocupado ou fora do expediente." };
          inserir_("Agendamentos", { negocio: n, id: proximoId_(), criado: agora, ini: i2, fim: i2 + s2.minutos * MIN, quando: legivel_(i2), cliente: lim_(c.nome, 80), tel: lim_(c.tel, 30), email: lim_(c.email, 120),
            pet: lim_(c.pet, 40), servico: s2.id, servico_nome: s2.nome, prof: String(c.prof), prof_nome: nomeProf_(n, c.prof), preco: s2.preco, status: "confirmado", origem: "balcão",
            obs: lim_(c.obs, 500), conversa: "[]", recado_novo: "", chave: Utilities.getUuid().replace(/-/g, "").slice(0, 10) });
          break;
        case "responder":
          a = doNegocio_(n, d.id);
          var x = lim_(d.texto, 500);
          if (!x) throw new Error("Escreva a resposta.");
          conv = conversa_(a); conv.push({ de: "neg", x: x, t: agora });
          atualizarAg_(a.id, { conversa: JSON.stringify(conv), recado_novo: "" });
          emailCliente_(a, N, "resposta", x);
          push_(["A_" + n + "_" + a.id], String(N.nome), "💬 " + x, linkCliAg_(N, a));
          break;
        case "lido":
          a = doNegocio_(n, d.id);
          atualizarAg_(a.id, { recado_novo: "" });
          break;
        case "bloquear":
          var bi = Number(d.ini), bf = Number(d.fim);
          if (!(bf > bi)) throw new Error("O horário final precisa ser depois do inicial.");
          inserir_("Bloqueios", { negocio: n, id: "b" + agora, prof: String(d.prof || "todos"), ini: bi, fim: bf, quando: legivel_(bi) + " até " + legivel_(bf), motivo: lim_(d.motivo, 80) });
          break;
        case "desbloquear":
          apagarLinha_("Bloqueios", n, String(d.id));
          break;
        case "config":
          salvarConfig_(N, d);
          break;
        default: throw new Error("Ação desconhecida.");
      }
      mudou_(n);
      return { ok: true };
    });
  }
};

/* ---------------- negócios e licença ---------------- */
function criarNegocio_(o) {
  var m = MODELOS[o.segmento] || MODELOS.outro;
  inserir_("Negocios", {
    n: o.n, nome: o.nome, segmento: o.segmento, situacao: o.situacao, teste_ate: o.teste_ate ? legivel_(o.teste_ate).slice(0, 10) : "", criado: legivel_(Date.now()),
    dono: o.dono || "", whatsapp_dono: o.whatsapp_dono || "", email_dono: o.email_dono || "", senha: hash_(o.senha), telefone: o.telefone || "", endereco: "", instagram: "",
    email_aviso: o.email_aviso || "", dias: m.dias, abre: m.abre, fecha: m.fecha, intervalo_ini: m.alm[0], intervalo_fim: m.alm[1], passo: "15", antecedencia: "60", cancelar_ate: "120", observacao: ""
  });
  var serv = o.servicos || m.serv, sh = aba_("Servicos");
  sh.getRange(sh.getLastRow() + 1, 1, serv.length, ABAS.Servicos.length)
    .setValues(serv.map(function (s, i) { return txtRow_([o.n, "s" + (i + 1), s[0], s[1], s[2], "SIM"]); }));
  inserir_("Equipe", { negocio: o.n, id: "p1", nome: o.dono || o.nome, ativo: "SIM" });
}
function liberado_(N) {
  var s = String(N.situacao || "").toLowerCase().trim();
  if (s === "cortesia" || s === "ativo") return { ok: true, situacao: s };
  if (s === "suspenso") return { ok: false, situacao: s, whatsapp: cfgVal_("whatsapp_dayia") };
  var ate = dataDe_(N.teste_ate);
  if (ate && Date.now() > ate + DIA) return { ok: false, situacao: "teste_vencido", whatsapp: cfgVal_("whatsapp_dayia") };
  return { ok: true, situacao: "teste", dias_restantes: ate ? Math.max(0, Math.floor((ate + DIA - Date.now()) / DIA)) : null, whatsapp: cfgVal_("whatsapp_dayia") };
}
function dataDe_(v) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  var m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]) - fuso_() * MIN; // meia-noite de Brasília
  var t = Date.parse(v); return isNaN(t) ? 0 : t;
}
function negocio_(n, semErro) {
  n = String(n || "").toLowerCase().trim();
  var N = linhas_("Negocios").filter(function (x) { return String(x.n).toLowerCase() === n; })[0];
  if (!N && !semErro) throw new Error("Agenda não encontrada. Confira o link.");
  if (N) N.n = String(N.n).toLowerCase();
  return N || null;
}
function publicoNeg_(N) { return { n: N.n, nome: String(N.nome), tel: String(N.telefone || ""), end: String(N.endereco || ""), insta: String(N.instagram || "") }; }
function horario_(N) {
  return { dias: String(N.dias || "").split(",").filter(function (x) { return x.trim() !== ""; }).map(Number), ini: hmTxt_(N.abre) || "09:00", fim: hmTxt_(N.fecha) || "18:00",
    almoco: [hmTxt_(N.intervalo_ini), hmTxt_(N.intervalo_fim)] };
}
function hmTxt_(v) { if (v instanceof Date) return ("0" + v.getHours()).slice(-2) + ":" + ("0" + v.getMinutes()).slice(-2); return String(v || "").trim(); }
function confereSenha_(N, senha) {
  var s = String(N.senha || "");
  if (/^[0-9a-f]{64}$/.test(s)) return hash_(senha) === s;
  // senha digitada direto na planilha (ex.: você trocou para ajudar o cliente): aceita e já guarda protegida
  if (s !== "" && s === senha) { atualizarNeg_(N.n, { senha: hash_(senha) }); return true; }
  return false;
}
function hash_(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "agendafacil:" + String(s), Utilities.Charset.UTF_8);
  return b.map(function (x) { return ("0" + ((x + 256) % 256).toString(16)).slice(-2); }).join("");
}
function salvarConfig_(N, d) {
  var m = {};
  if (d.negocio) { m.nome = lim_(d.negocio.nome, 60) || N.nome; m.telefone = lim_(d.negocio.tel, 30); m.endereco = lim_(d.negocio.end, 150); m.instagram = lim_(d.negocio.insta, 60); }
  if (d.horario) { m.dias = (d.horario.dias || []).join(","); m.abre = d.horario.ini; m.fecha = d.horario.fim; m.intervalo_ini = (d.horario.almoco || [])[0] || ""; m.intervalo_fim = (d.horario.almoco || [])[1] || ""; }
  if (d.antecedencia !== undefined) m.antecedencia = String(Number(d.antecedencia) || 0);
  if (d.email_aviso !== undefined) m.email_aviso = lim_(d.email_aviso, 120);
  if (d.senha) { if (String(d.senha).length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres."); m.senha = hash_(d.senha); }
  atualizarNeg_(N.n, m);
  if (d.servicos) regravar_("Servicos", N.n, d.servicos.map(function (s, i) {
    return [N.n, s.id || "s" + Date.now() + i, lim_(s.nome, 60) || "Serviço", Math.max(5, Number(s.min) || 30), Math.max(0, Number(s.preco) || 0), s.ativo === false ? "NÃO" : "SIM"]; }));
  if (d.profs) regravar_("Equipe", N.n, d.profs.map(function (p, i) { return [N.n, p.id || "p" + Date.now() + i, lim_(p.nome, 60) || "Profissional", p.ativo === false ? "NÃO" : "SIM"]; }));
}
function regravar_(aba, n, novas) {
  var sh = aba_(aba), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][0]).toLowerCase() === n) sh.deleteRow(i + 1);
  if (novas.length) sh.getRange(sh.getLastRow() + 1, 1, novas.length, ABAS[aba].length).setValues(novas.map(txtRow_));
}

/* ---------------- disponibilidade ---------------- */
function livre_(N, H, ags, bl, pid, ini, minutos, ignorar, semAntecedencia) {
  var fim = ini + minutos * MIN, off = fuso_();
  var local = ini / MIN + off, minDia = ((local % 1440) + 1440) % 1440, dsem = ((Math.floor(local / 1440) + 4) % 7 + 7) % 7;
  if (H.dias.indexOf(dsem) < 0) return false;
  var a = minDia, b = minDia + minutos;
  if (a < hm_(H.ini) || b > hm_(H.fim)) return false;
  if (H.almoco[0] && H.almoco[1] && a < hm_(H.almoco[1]) && b > hm_(H.almoco[0])) return false;
  if (!semAntecedencia && ini < Date.now() + (Number(N.antecedencia) || 0) * MIN) return false;
  for (var i = 0; i < ags.length; i++) { var x = ags[i]; if (x.prof !== pid || x.status === "cancelado" || (ignorar != null && x.id === ignorar)) continue; if (ini < x.fim && fim > x.ini) return false; }
  for (var j = 0; j < bl.length; j++) { var k = bl[j]; if (k.prof !== pid && k.prof !== "todos") continue; if (ini < k.fim && fim > k.ini) return false; }
  return true;
}
var FUSO_CACHE = null;
function fuso_() { if (FUSO_CACHE === null) FUSO_CACHE = Number(cfgVal_("fuso_minutos")) || -180; return FUSO_CACHE; }
function inicioDia_(t) { var off = fuso_() * MIN; return Math.floor((t + off) / DIA) * DIA - off; }
function hm_(s) { var p = String(s || "0:0").split(":"); return Number(p[0]) * 60 + (Number(p[1]) || 0); }
function legivel_(t) {
  var d = new Date(t + fuso_() * MIN), p = function (n) { return (n < 10 ? "0" : "") + n; };
  return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear() + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
}

/* ---------------- e-mails ---------------- */
function linkPainel_(N) { var l = linkNeg_(N); return l ? l + "#painel" : ""; }
function linkCliAg_(N, a) { var l = linkNeg_(N); return l ? l + "&ag=" + a.id + "&k=" + a.chave : ""; }
function linkNeg_(N) { var b = cfgVal_("link_base"); return b ? b + "?n=" + encodeURIComponent(N.n) : ""; }
function avisarNegocio_(a, N) {
  if (!/@/.test(N.email_aviso || "")) return;
  var link = linkNeg_(N);
  enviar_(String(N.email_aviso), "📅 Novo agendamento: " + a.cliente + " · " + a.quando,
    "<h2 style='margin:0 0 8px'>Novo agendamento online</h2><p><b>" + esc_(a.cliente) + "</b>" + (a.pet ? " · pet " + esc_(a.pet) : "") + "<br>" + esc_(a.servico_nome) + " com " + esc_(a.prof_nome) + "<br><b>" + esc_(a.quando) + "</b><br>WhatsApp: " + esc_(a.tel) + (a.obs ? "<br>Recado: " + esc_(a.obs) : "") + "</p>" +
    (link ? "<p><a href='" + link + "#painel' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Abrir o painel</a></p>" : ""), String(N.nome));
}
function emailCliente_(a, N, tipo, texto) {
  if (!/@/.test(a.email || "")) return;
  var link = linkNeg_(N); if (link) link += "&ag=" + a.id + "&k=" + a.chave;
  var tit = { novo: "Recebemos seu agendamento", confirmado: "Seu horário está confirmado", cancelado: "Seu horário foi cancelado", remarcado: "Seu horário foi remarcado", resposta: "Você recebeu uma resposta" }[tipo];
  enviar_(a.email, tit + " · " + N.nome,
    "<p>Olá, " + esc_(String(a.cliente).split(" ")[0]) + "!</p><p><b>" + tit + "</b>.</p><p>" + esc_(a.servico_nome) + " com " + esc_(a.prof_nome) + "<br><b>" + esc_(a.quando) + "</b></p>" +
    (texto ? "<blockquote style='border-left:4px solid #8EC5E8;margin:0;padding:8px 12px;background:#F2F6FA'>" + esc_(texto) + "</blockquote>" : "") +
    (link ? "<p><a href='" + link + "' style='background:#0E2238;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold'>Ver meu horário</a></p>" : "") +
    "<p style='color:#4A5B75'>" + esc_(N.nome) + (N.endereco ? " · " + esc_(N.endereco) : "") + "</p>", String(N.nome));
}
function enviar_(para, assunto, html, nome) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return;
    MailApp.sendEmail({ to: para, subject: assunto, htmlBody: "<div style='font-family:Arial,sans-serif;color:#0E2238;font-size:14px'>" + html + "</div>", name: nome || "Agenda Fácil" });
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
function atualizarAg_(id, campos) { atualizarPor_("Agendamentos", 1, Number(id), campos); }
function atualizarNeg_(n, campos) { atualizarPor_("Negocios", 0, n, campos); }
function atualizarPor_(aba, col0, chave, campos) {
  var sh = aba_(aba), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    var k = v[i][col0];
    if ((typeof chave === "number" && Number(k) === chave) || (typeof chave === "string" && String(k).toLowerCase() === chave)) {
      Object.keys(campos).forEach(function (c) { var col = ABAS[aba].indexOf(c); if (col >= 0) sh.getRange(i + 1, col + 1).setValue(txt_(campos[c])); });
      return;
    }
  }
}
function apagarLinha_(aba, n, id) {
  var sh = aba_(aba), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][0]).toLowerCase() === n && String(v[i][1]) === id) { sh.deleteRow(i + 1); return; }
}
function agendamentos_(n) {
  return linhas_("Agendamentos").filter(function (a) { return String(a.negocio).toLowerCase() === n; }).map(function (a) {
    a.id = Number(a.id); a.ini = Number(a.ini); a.fim = Number(a.fim); a.preco = Number(a.preco) || 0; a.criado = Number(a.criado);
    a.prof = String(a.prof); a.servico = String(a.servico); return a;
  });
}
function bloqueios_(n) { return linhas_("Bloqueios").filter(function (b) { return String(b.negocio).toLowerCase() === n; }).map(function (b) { return { id: String(b.id), prof: String(b.prof), ini: Number(b.ini), fim: Number(b.fim), motivo: String(b.motivo || "") }; }); }
function servicos_(n, soAtivos) {
  return linhas_("Servicos").filter(function (s) { return String(s.negocio).toLowerCase() === n && (!soAtivos || sim_(s.ativo)); })
    .map(function (s) { return { id: String(s.id), nome: String(s.nome), minutos: Number(s.minutos) || 30, min: Number(s.minutos) || 30, preco: Number(s.preco) || 0, ativo: sim_(s.ativo) }; });
}
function servicoPorId_(n, id) { return servicos_(n, false).filter(function (s) { return s.id === String(id); })[0]; }
function equipe_(n, soAtivos) { return linhas_("Equipe").filter(function (p) { return String(p.negocio).toLowerCase() === n && (!soAtivos || sim_(p.ativo)); }).map(function (p) { return { id: String(p.id), nome: String(p.nome), ativo: sim_(p.ativo) }; }); }
function nomeProf_(n, id) { var p = equipe_(n, false).filter(function (x) { return x.id === String(id); })[0]; return p ? p.nome : ""; }
function doNegocio_(n, id) { var a = agendamentos_(n).filter(function (x) { return x.id === Number(id); })[0]; if (!a) throw new Error("Agendamento não encontrado."); return a; }
function daCliente_(N, d) { var a = doNegocio_(N.n, d.id); if (!d.chave || String(a.chave) !== String(d.chave)) throw new Error("Agendamento não encontrado."); return a; }
function conversa_(a) { try { var c = JSON.parse(a.conversa || "[]"); return Array.isArray(c) ? c : []; } catch (x) { return []; } }
function cfgVal_(k) { var r = linhas_("Config").filter(function (x) { return x.chave === k; })[0]; return r ? String(r.valor) : ""; }
function setCfg_(k, v) {
  var sh = aba_("Config"), v0 = sh.getDataRange().getValues();
  for (var i = 1; i < v0.length; i++) if (v0[i][0] === k) { if (String(v0[i][1]) !== String(v)) sh.getRange(i + 1, 2).setValue(txt_(String(v))); return; }
  sh.appendRow([k, txt_(String(v)), ""]);
}
function proximoId_() { var id = Number(cfgVal_("proximo_id")) || 1; setCfg_("proximo_id", id + 1); return id; }
function publico_(a, paraCliente) {
  var o = { id: a.id, ini: a.ini, fim: a.fim, cli: String(a.cliente), tel: String(a.tel), email: String(a.email || ""), pet: String(a.pet || ""), serv: a.servico, servico_nome: String(a.servico_nome), prof: a.prof, prof_nome: String(a.prof_nome),
    preco: a.preco, status: a.status, origem: a.origem, obs: String(a.obs || ""), conversa: conversa_(a), recado_novo: sim_(a.recado_novo), criado: a.criado };
  if (paraCliente) { o.chave = a.chave; delete o.recado_novo; }
  return o;
}
function slug_(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); }

/* ---------------- sessão, versão e trava ---------------- */
function novoToken_(n) { var t = Utilities.getUuid(); CacheService.getScriptCache().put("tk_" + t, n, 21600); return t; }
function sessao_(d) { var c = CacheService.getScriptCache(), k = "tk_" + String(d.token || ""), n = c.get(k); if (!n) throw new Error("SESSAO"); c.put(k, n, 21600); return n; }
function versao_(n) { return Number(PropertiesService.getScriptProperties().getProperty("V_" + n) || 1); }
function mudou_(n) { PropertiesService.getScriptProperties().setProperty("V_" + n, String(Date.now())); }
function comTrava_(fn) {
  var l = LockService.getScriptLock();
  if (!l.tryLock(20000)) throw new Error("Muita gente agendando agora. Tente de novo em alguns segundos.");
  try { return fn(); } finally { SpreadsheetApp.flush(); l.releaseLock(); }
}

/* ---------------- utilidades ---------------- */
// o apóstrofo faz a planilha guardar como texto: telefone não vira número, "09:00" não vira hora e nada vira fórmula
function txt_(v) { return (typeof v === "string" && v !== "") ? "'" + v : v; }
function txtRow_(r) { return r.map(txt_); }
function sim_(v) { return /^s/i.test(String(v).trim()); }
function lim_(v, n) { return String(v === undefined || v === null ? "" : v).trim().slice(0, n); }
function esc_(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

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
function pushChave_() { return String(cfgVal_("push_chave") || "").trim(); }
function push_(chaves, titulo, texto, url) {
  try {
    var key = pushChave_();
    if (!key) return;
    var subs = [];
    chaves.forEach(function (c) { pushDe_(c).forEach(function (s) { if (subs.indexOf(s) < 0) subs.push(s); }); });
    if (!subs.length) return;
    var corpo = { app_id: ONESIGNAL_APP, target_channel: "push", include_subscription_ids: subs, headings: { en: String(titulo).slice(0, 80) }, contents: { en: String(texto).slice(0, 200) },
      chrome_web_icon: "https://dailva123.github.io/dayia/agenda/app/icon-192.png", chrome_web_badge: "https://dailva123.github.io/dayia/agenda/app/icon-192.png", ttl: 86400 };
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
