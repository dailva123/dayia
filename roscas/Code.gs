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

var VERSAO = "1.0";

// Modelos usados (pode trocar aqui se o fornecedor lançar um mais novo)
var MODELO_GEMINI = "gemini-flash-latest";
var MODELO_CLAUDE = "claude-sonnet-5-5";

// Limite de análises por dia, para ninguém gastar sua cota à toa
var LIMITE_DIA = 300;

var PROMPT = [
  "Você é um metrologista especialista em roscas de tubo de conexões hidráulicas e pneumáticas (BSP e NPT).",
  "A foto foi tirada no balcão, normalmente SEM nenhum objeto de referência ao lado.",
  "",
  "Tarefa: MEDIR a rosca na própria imagem. Não tente adivinhar a norma, só meça.",
  "",
  "A) Proporção (o mais importante, funciona sem referência):",
  "   1. Meça, em pixels, o diâmetro da rosca: macho = de pico a pico dos filetes, perpendicular ao eixo;",
  "      fêmea = diâmetro do furo nos picos internos.",
  "   2. Meça o passo em pixels: conte os picos dos filetes no maior trecho nítido possível ao longo do eixo",
  "      e divida o comprimento desse trecho pelo número de intervalos entre picos.",
  "   3. razao_diametro_passo = diametro_px / passo_px. Confira a conta duas vezes; um erro de contagem",
  "      de filete muda a bitola.",
  "",
  "B) Tamanho real:",
  "   - Se houver cartão de banco (85,60 x 53,98 mm), régua ou paquímetro na foto, use para calcular",
  "     diametro_mm e fios_por_polegada, e marque tem_referencia = true.",
  "   - Se não houver, deixe diametro_mm e fios_por_polegada como null e estime diametro_estimado_mm",
  "     pelo contexto: mão ou dedos, ferramentas, bancada, tamanho do sextavado, espessura da parede do furo,",
  "     proporções típicas de conexões. Sempre preencha diametro_estimado_mm, mesmo com pouca certeza.",
  "",
  "C) Forma: reta (diâmetro igual no comprimento todo) ou cônica (afunila na ponta). Se não der, \"indefinida\".",
  "",
  "O cliente informou que a rosca é: {TIPO}.",
  "",
  "Responda SOMENTE com um JSON neste formato, sem texto fora dele:",
  "{\"rosca_visivel\":true,",
  " \"tipo\":\"macho|femea|indefinido\",",
  " \"diametro_px\":0, \"passo_px\":0, \"filetes_contados\":0,",
  " \"razao_diametro_passo\":0.0,",
  " \"tem_referencia\":false, \"referencia\":\"cartao|regua|paquimetro|nenhuma\",",
  " \"diametro_mm\":null, \"fios_por_polegada\":null,",
  " \"diametro_estimado_mm\":0.0,",
  " \"forma\":\"reta|conica|indefinida\",",
  " \"certeza\":0,",
  " \"problemas\":\"\"}",
  "\"certeza\" vai de 0 a 100 e diz o quanto você confia na contagem dos filetes.",
  "Em \"problemas\", escreva em português simples, para um leigo, o que atrapalhou",
  "(ex.: filetes borrados, foto de frente em vez de lado, pouca luz). Deixe vazio se a foto estiver boa."
].join("\n");

/* ---------------- entrada ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
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

    var bruto = provedor_() === "gemini"
      ? gemini_(texto, corpo.imagem, mime)
      : claude_(texto, corpo.imagem, mime);

    var medida = extrairJson_(bruto);
    if (!medida) return json_({ ok: false, erro: "A IA não conseguiu ler a foto. Tente outra foto." });
    contarUso_(emp ? emp.id : "_dayia");
    return json_({ ok: true, medida: medida });
  } catch (err) {
    return json_({ ok: false, erro: "Erro no servidor: " + err.message });
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
  if (p.getProperty("GEMINI_KEY")) return "gemini";
  if (p.getProperty("CLAUDE_KEY")) return "claude";
  return "";
}

function gemini_(texto, b64, mime) {
  var chave = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY");
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODELO_GEMINI + ":generateContent";
  var r = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": chave },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: texto }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" }
    })
  });
  var d = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error((d.error && d.error.message) || ("Gemini " + r.getResponseCode()));
  var partes = (((d.candidates || [])[0] || {}).content || {}).parts || [];
  return partes.map(function (p) { return p.text || ""; }).join("");
}

function claude_(texto, b64, mime) {
  var chave = PropertiesService.getScriptProperties().getProperty("CLAUDE_KEY");
  var r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01" },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: MODELO_CLAUDE,
      max_tokens: 1024,
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
