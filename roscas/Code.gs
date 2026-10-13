/* =====================================================================
   ROSCA FÁCIL by DayIA  ·  servidor (Google Apps Script)
   ---------------------------------------------------------------------
   Recebe a foto da peça enviada pelo app, pede para uma IA de visão
   medir a rosca (usando o cartão ou a régua da foto como referência)
   e devolve as medidas. A comparação com as tabelas BSP / NPT é feita
   no próprio app.

   A chave da IA fica guardada aqui, escondida. Ela nunca aparece no app.

   Instalação (uma vez só, uns 5 minutos):
   1. Entre em script.google.com com a conta da DayIA > Novo projeto.
   2. Apague o que estiver lá e cole este arquivo inteiro.
   3. Pegue uma chave de IA:
        Gemini (tem uso grátis): aistudio.google.com > "Get API key"
        ou Claude: console.anthropic.com > API Keys
   4. No Apps Script: engrenagem (Configurações do projeto) >
      Propriedades do script > Adicionar propriedade:
        nome  GEMINI_KEY  (ou CLAUDE_KEY)   valor  a chave copiada
        nome  PIN_DONO                      valor  uma senha só sua (para o painel)
   5. Implantar > Nova implantação > tipo "App da Web"
        Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
   6. Copie o endereço que termina em /exec e mande para colocar no app.

   Empresas: cadastradas pelo painel (painel.html), só com o nome.
   Cada empresa recebe um link próprio do app. Nada de planilha.
   ===================================================================== */

var VERSAO = "2.0";
var TENTATIVAS = []; // diagnóstico: cada chamada à IA (modelo, jeito, tempo, resultado)

// Modelos usados (pode trocar aqui se o fornecedor lançar um mais novo)
// Ordem de tentativa: se um modelo estiver lotado ou fora do ar, passa para o próximo.
// Com as duas chaves (CLAUDE_KEY e GEMINI_KEY), o Claude vem primeiro (mais preciso) e o Gemini fica de reserva.
// Para mudar a ordem, crie a propriedade IA_PRIMEIRO com o valor "gemini" ou "claude".
// Rápidos primeiro; os mais pesados só se os rápidos estiverem lotados.
// 1.9: o "lite" primeiro (achar o retângulo da rosca é tarefa simples e ele responde mais rápido)
var MODELOS_GEMINI = ["gemini-flash-lite-latest", "gemini-flash-latest"];   // 1.7: sem o "pro" (lento demais)
var MODELOS_CLAUDE = ["claude-haiku-5-5", "claude-sonnet-5-5"];          // 1.7: o mais rápido primeiro

// Limite de análises por dia, para ninguém gastar sua cota à toa
var LIMITE_DIA = 300;

// 1.8: a IA NÃO mede mais (ela inventava os números). Ela só aponta onde está a rosca;
// o celular mede o passo e a largura dentro desse retângulo. Resposta curta = mais rápida.
var PROMPT = [
  "Você localiza roscas de conexões hidráulicas em fotos. Responda rápido e só com JSON.",
  "box_2d: retângulo JUSTO em volta SÓ da parte com filetes (sem o sextavado, sem o corpo da peça), [ymin, xmin, ymax, xmax] de 0 a 1000.",
  "tipo: macho (filetes por fora) | femea (filetes por dentro) | indefinido. Rosca informada pelo cliente: {TIPO}.",
  "diametro_estimado_mm: tamanho aproximado da rosca pelo contexto (dedos, sextavado, objetos).",
  "forma: reta | conica | indefinida.",
  "marcacao: medida de ROSCA gravada ou impressa na peça (ex.: \"1/2\", \"3/4\", \"M16x1,5\"). Ignore códigos de modelo. Senão \"\".",
  "Se não houver rosca visível: rosca_visivel=false.",
  "JSON: {\"rosca_visivel\":true,\"tipo\":\"macho\",\"box_2d\":[0,0,0,0],\"diametro_estimado_mm\":0,\"forma\":\"indefinida\",\"marcacao\":\"\",\"problemas\":\"\"}",
  "problemas: em português simples, ou vazio."
].join("\n");

/* ---------------- entrada ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.acao === "ping") return json_({ ok: true });
  if (p.acao === "empresa") {
    var emp = empresas_()[String(p.e || "").toLowerCase()];
    if (!emp || !emp.ativa) return json_({ ok: false });
    return json_({ ok: true, empresa: { id: emp.id, nome: emp.nome } });
  }
  return json_({ ok: true, app: "Rosca Fácil by DayIA", versao: VERSAO, ia: provedor_() || "não configurada" });
}

function doPost(e) {
  try {
    var corpo = JSON.parse(e.postData.contents || "{}");
    if (corpo.acao === "painel") return painel_(corpo);
    if (corpo.acao !== "analisar") return json_({ ok: false, erro: "Ação desconhecida." });
    var emp = corpo.e ? empresas_()[String(corpo.e).toLowerCase()] : null;
    if (corpo.e && (!emp || !emp.ativa)) return json_({ ok: false, erro: "Este link está desativado. Fale com quem te passou o app." });
    if (!corpo.imagem) return json_({ ok: false, erro: "Nenhuma foto recebida." });
    if (!provedor_()) return json_({ ok: false, erro: "A IA ainda não foi configurada." });
    if (!dentroDoLimite_()) return json_({ ok: false, erro: "O limite de análises de hoje acabou. Tente amanhã ou use a medida manual." });

    var tipo = corpo.tipo === "femea" ? "fêmea (filetes por dentro)" : "macho (filetes por fora)";
    var texto = PROMPT.replace("{TIPO}", tipo);
    var mime = corpo.mime || "image/jpeg";

    var t0 = Date.now();
    TENTATIVAS = [];
    var bruto = analisarComIA_(texto, corpo.imagem, mime);

    var medida = extrairJson_(bruto);
    if (!medida) return json_({ ok: false, erro: "A IA não conseguiu ler a foto. Tente outra foto." });
    contarUso_(emp ? emp.id : "_dayia");
    return json_({ ok: true, medida: medida, ms: Date.now() - t0, versao: VERSAO, tentativas: TENTATIVAS });
  } catch (err) {
    var msg = String(err.message || err);
    var extra = { detalhe: msg.slice(0, 400), versao: VERSAO, tentativas: TENTATIVAS };
    // limite grátis do dia (cota) é diferente de "lotado": avisar certo
    if (/quota|exhausted|per day|limit/i.test(msg) && !/demand|overload/i.test(msg))
      return json_(Object.assign({ ok: false, limite: true, erro: "O limite grátis de hoje da IA acabou. Ele volta amanhã. Enquanto isso, meça com o pente na foto." }, extra));
    if (/demand|overload|unavailable|503|529|429|rate/i.test(msg))
      return json_(Object.assign({ ok: false, ocupado: true, erro: "A IA está muito ocupada agora. Tente de novo em alguns segundos, ou meça com o pente na foto." }, extra));
    return json_(Object.assign({ ok: false, erro: "Erro no servidor: " + msg }, extra));
  }
}


/* ---------------- empresas (painel da dona) ---------------- */
function empresas_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("EMPRESAS") || "{}"); }
  catch (e) { return {}; }
}
function gravarEmpresas_(lista) {
  PropertiesService.getScriptProperties().setProperty("EMPRESAS", JSON.stringify(lista));
}
function slug_(t) {
  return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "empresa";
}
function mesAtual_() { return Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM"); }

function contarUso_(id) {
  var p = PropertiesService.getScriptProperties(), k = "USO_" + id + "_" + mesAtual_();
  p.setProperty(k, String(Number(p.getProperty(k) || 0) + 1));
}

function painel_(c) {
  var pin = PropertiesService.getScriptProperties().getProperty("PIN_DONO");
  if (!pin) return json_({ ok: false, erro: "Defina o PIN_DONO nas propriedades do script." });
  if (String(c.pin || "") !== pin) return json_({ ok: false, erro: "Senha errada." });

  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    var lista = empresas_();
    if (c.op === "nova") {
      var nome = String(c.nome || "").trim().slice(0, 60);
      if (!nome) return json_({ ok: false, erro: "Digite o nome da empresa." });
      var id = slug_(nome), base = id, n = 2;
      while (lista[id]) id = base + "-" + (n++);
      lista[id] = { id: id, nome: nome, ativa: true, criada: new Date().toISOString() };
      gravarEmpresas_(lista);
    } else if (c.op === "editar" && lista[c.id]) {
      if (c.nome !== undefined && String(c.nome).trim()) lista[c.id].nome = String(c.nome).trim().slice(0, 60);
      if (c.ativa !== undefined) lista[c.id].ativa = !!c.ativa;
      gravarEmpresas_(lista);
    } else if (c.op === "remover" && lista[c.id]) {
      delete lista[c.id];
      gravarEmpresas_(lista);
    }
    var p = PropertiesService.getScriptProperties(), mes = mesAtual_();
    var saida = Object.keys(lista).map(function (k) {
      var x = lista[k];
      return { id: x.id, nome: x.nome, ativa: x.ativa, criada: x.criada, usoMes: Number(p.getProperty("USO_" + x.id + "_" + mes) || 0) };
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    return json_({ ok: true, empresas: saida, ia: provedor_() || "", usoDayia: Number(p.getProperty("USO__dayia_" + mes) || 0) });
  } finally { lock.releaseLock(); }
}

/* ---------------- IAs ---------------- */
function provedor_() {
  var p = PropertiesService.getScriptProperties();
  var tem = { claude: !!p.getProperty("CLAUDE_KEY"), gemini: !!p.getProperty("GEMINI_KEY") };
  var pref = String(p.getProperty("IA_PRIMEIRO") || "").toLowerCase();
  if (tem[pref]) return pref;
  if (tem.claude) return "claude";
  if (tem.gemini) return "gemini";
  return "";
}

/* Tenta cada modelo disponível, na ordem, até um responder.
   Erros de "lotado"/limite (429, 500, 503, 529) passam para o próximo; o último erro é devolvido. */
function analisarComIA_(texto, b64, mime) {
  var p = PropertiesService.getScriptProperties(), fila = [];
  var ordem = provedor_() === "gemini" ? ["gemini", "claude"] : ["claude", "gemini"];
  ordem.forEach(function (prov) {
    if (prov === "claude" && p.getProperty("CLAUDE_KEY")) MODELOS_CLAUDE.forEach(function (m) { fila.push(["claude", m]); });
    if (prov === "gemini" && p.getProperty("GEMINI_KEY")) MODELOS_GEMINI.forEach(function (m) { fila.push(["gemini", m]); });
  });
  var ultimo = null;
  for (var i = 0; i < fila.length; i++) {
    try {
      return fila[i][0] === "claude" ? claude_(texto, b64, mime, fila[i][1]) : gemini_(texto, b64, mime, fila[i][1]);
    } catch (err) {
      ultimo = err;
      if (!/lotado|demand|overload|unavailable|rate|quota|exhausted|not found|invalid argument|404|400|429|500|503|529/i.test(String(err.message))) {
        // erro de chave/permissão: tenta o outro fornecedor, se houver, mas não insiste no mesmo
        while (i + 1 < fila.length && fila[i + 1][0] === fila[i][0]) i++;
      } else {
        Utilities.sleep(200);
      }
    }
  }
  throw ultimo || new Error("Nenhuma IA configurada.");
}

/* Jeitos de pedir resposta rápida, do mais rápido ao padrão. Cada modelo do Google aceita um;
   o servidor testa na ordem e guarda o que funcionou para aquele modelo (sem errar de novo). */
// 1.9: imagem em resolução baixa (para achar o retângulo basta) deixa a IA bem mais rápida.
var JEITOS_GEMINI = [
  { thinkingConfig: { thinkingLevel: "minimal" }, mediaResolution: "MEDIA_RESOLUTION_LOW" },
  { thinkingConfig: { thinkingBudget: 0 }, mediaResolution: "MEDIA_RESOLUTION_LOW" },
  { thinkingConfig: { thinkingLevel: "minimal" } },
  { thinkingConfig: { thinkingLevel: "low" } },
  { thinkingConfig: { thinkingBudget: 0 } },
  {}
];
var JEITO_VALIDADE_MS = 6 * 3600 * 1000; // a cada 6 h volta a testar os jeitos mais rápidos
function gemini_(texto, b64, mime, modelo) {
  var props = PropertiesService.getScriptProperties();
  var chave = props.getProperty("GEMINI_KEY");
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent";
  var reg = String(props.getProperty("JEITO2_" + modelo) || "").split("|");
  var salvo = Number(reg[0]), quando = Number(reg[1]) || 0;
  if (!(salvo >= 0 && salvo < JEITOS_GEMINI.length) || Date.now() - quando > JEITO_VALIDADE_MS) salvo = -1;
  var inicio = salvo >= 0 ? salvo : 0;
  var ultimoErro = null;
  for (var k = inicio; k < JEITOS_GEMINI.length; k++) {
    var cfg = { temperature: 0, responseMimeType: "application/json" };
    if (JEITOS_GEMINI[k].thinkingConfig) cfg.thinkingConfig = JEITOS_GEMINI[k].thinkingConfig;
    if (JEITOS_GEMINI[k].mediaResolution) cfg.mediaResolution = JEITOS_GEMINI[k].mediaResolution;
    var t1 = Date.now();
    var r = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": chave },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: texto }] }],
        generationConfig: cfg
      })
    });
    var code = r.getResponseCode(), d = {};
    try { d = JSON.parse(r.getContentText()); } catch (e) {}
    TENTATIVAS.push({ modelo: modelo, jeito: k, ms: Date.now() - t1, codigo: code });
    if (code === 200) {
      if (salvo !== k) props.setProperty("JEITO2_" + modelo, k + "|" + Date.now());
      var partes = (((d.candidates || [])[0] || {}).content || {}).parts || [];
      return partes.filter(function (p) { return !p.thought; }).map(function (p) { return p.text || ""; }).join("");
    }
    ultimoErro = new Error((d.error && d.error.message) || ("Gemini " + code));
    if (code !== 400) throw ultimoErro;   // lotado, chave errada etc.: não adianta mudar o jeito
  }
  throw ultimoErro;
}

function claude_(texto, b64, mime, modelo) {
  var chave = PropertiesService.getScriptProperties().getProperty("CLAUDE_KEY");
  var r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01" },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: modelo,
      max_tokens: 250,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
        { type: "text", text: texto }
      ] }]
    })
  });
  var d = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error((d.error && d.error.message) || ("Claude " + r.getResponseCode()));
  return (d.content || []).map(function (c) { return c.text || ""; }).join("");
}

/* ---------------- utilidades ---------------- */
function extrairJson_(t) {
  if (!t) return null;
  var i = t.indexOf("{"), f = t.lastIndexOf("}");
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(t.slice(i, f + 1)); } catch (e) { return null; }
}

function dentroDoLimite_() {
  var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");
  var p = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var dia = p.getProperty("CONTA_DIA"), n = Number(p.getProperty("CONTA_N") || 0);
    if (dia !== hoje) { dia = hoje; n = 0; }
    if (n >= LIMITE_DIA) return false;
    p.setProperties({ CONTA_DIA: dia, CONTA_N: String(n + 1) });
    return true;
  } finally { lock.releaseLock(); }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
