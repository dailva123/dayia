/* ================= Aprova Fácil by DayIA ================= */
const $=s=>document.querySelector(s);
const CHAVE="aprovafacil-v1";
const COFRE="https://script.google.com/macros/s/AKfycbxNQ6ujEny-MJkRQauSYr7uyjZTVxqXWnj2wnF4c-ceuUloBWsWvgCqhmhAU8NJGmhzpA/exec"; // endereço do cofre (Apps Script) do Aprova Fácil
const AREAS={
  ling:{n:"Linguagens",i:"📖",sub:"Português, Literatura e Inglês"},
  hum:{n:"Ciências Humanas",i:"🌎",sub:"História, Geografia, Filosofia e Sociologia"},
  nat:{n:"Ciências da Natureza",i:"🔬",sub:"Biologia, Química e Física"},
  mat:{n:"Matemática",i:"🔢",sub:"Contas, porcentagem, gráficos e geometria"}
};
const OBJETIVOS={
  gv:{nome:"Direito GV",ic:"👩‍⚖️",prova:"2027-10-17",info:"1ª fase: questões objetivas e discursivas · 2ª fase: exame oral",
      missao:["ling","hum","ling","hum","mat"]},
  fuvest:{nome:"Psicologia USP",ic:"🧠",prova:"2027-11-21",info:"Fuvest · 1ª fase: 80 questões · 2ª fase: discursivas e redação",
      missao:["ling","hum","nat","mat","nat"]}
};
const NIVEIS=["Começo","Ritmo","Foco","Garra","Brilho","Rumo à aprovação","Imparável","Lenda do vestibular"];
const MEDALHAS=[
  {id:"primeira",i:"🌱",n:"Primeira missão",ok:d=>d.dias.length>=1},
  {id:"tres",i:"🔥",n:"3 dias seguidos",ok:()=>sequencia()>=3},
  {id:"sete",i:"⚡",n:"7 dias seguidos",ok:()=>sequencia()>=7},
  {id:"cem",i:"⭐",n:"100 pontos",ok:d=>d.xp>=100},
  {id:"quinhentos",i:"🌟",n:"500 pontos",ok:d=>d.xp>=500},
  {id:"perfeita",i:"🎯",n:"Missão sem erro",ok:d=>!!d.perfeita},
  {id:"revisao",i:"🔁",n:"Acertou um erro antigo",ok:d=>!!d.corrigiu},
  {id:"todas",i:"🗺️",n:"Treinou as 4 áreas",ok:d=>Object.keys(AREAS).every(a=>Object.keys(d.resp).some(id=>BANCO[id]&&BANCO[id].area===a))},
  {id:"cinquenta",i:"🏆",n:"50 acertos",ok:()=>totalAcertos()>=50}
];

/* ---------- dados guardados no celular ---------- */
function novo(){return {id:"",nome:"",email:"",tel:"",objetivo:"",dataProva:"",xp:0,dias:[],resp:{},erros:[],medalhas:[],missao:null,perfeita:false,corrigiu:false,som:true,fila:[],moedas:0,compras:["tema-azul","av-🎓"],tema:"azul",avatar:"🎓",trofeus:[],grupo:"",stats:{},semanas:{},meses:{},regiao:0,premio:"",metaMes:600,redacoes:[],redacaoAtual:null,sim:null,recadoVisto:0}}
let D;try{D=Object.assign(novo(),JSON.parse(localStorage.getItem(CHAVE))||{})}catch(e){D=novo()}
// versão antiga guardava as questões pelo número: passa para o código novo
Object.keys(D.resp).forEach(k=>{if(/^\d+$/.test(k)){D.resp["d"+k]=D.resp[k];delete D.resp[k]}});
D.erros=D.erros.map(x=>typeof x==="number"?"d"+x:x);
if(D.missao&&D.missao.ids)D.missao.ids=D.missao.ids.map(x=>typeof x==="number"?"d"+x:x);
if(!D.id)D.id=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)).slice(0,36);
function salvar(){try{localStorage.setItem(CHAVE,JSON.stringify(D))}catch(e){}}
salvar();

/* ---------- banco de questões ---------- */
const BANCO={};
QUESTOES.forEach((q,i)=>{BANCO["d"+i]={id:"d"+i,area:AREA_DE[q.m],tag:MATERIAS[q.m].i+" "+MATERIAS[q.m].n,t:"",p:q.e,a:q.a,c:q.c,x:q.x,fonte:"Questão DayIA"}});
let carregado=false;
const carregando=Promise.all(Object.keys(AREAS).map(a=>fetch("enem/"+a+".json").then(r=>r.json()).then(lista=>lista.forEach(q=>{
  BANCO[q.id]={id:q.id,area:a,tag:AREAS[a].i+" "+AREAS[a].n,t:q.t,p:q.p,a:q.a,c:q.c,fonte:"ENEM "+q.ano+" · questão "+q.n}})).catch(()=>{})))
  .then(()=>{carregado=true;if(aba==="inicio"||aba==="trilha")render()});

/* ---------- utilidades ---------- */
const hoje=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const diaMenos=(iso,n)=>{const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()-n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
// texto das questões e da IA: **negrito**, *itálico*, parágrafos
function texto(s,ia){
  if(ia)s=String(s||"").replace(/\\mathbf\{([^}]*)\}/g,"**$1**").replace(/\\(?:text|mathrm)\{([^}]*)\}/g,"$1").replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g,"$1/$2").replace(/\\times/g,"×").replace(/\\cdot/g,"·").replace(/\\%/g,"%").replace(/\\,/g," ").replace(/\$([^$\n]{1,80})\$/g,(m,x,o,str)=>str[o-1]==="R"?m:x);
  let t=esc(s||"");
  const guard=[];t=t.replace(/\\([\\*\[\]_#().!-])/g,(m,c)=>{guard.push(c);return "\u0000"+(guard.length-1)+"\u0000"});
  t=t.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(^|[^*])\*([^*\n]+?)\*/g,"$1<i>$2</i>");
  t=t.replace(/\u0000(\d+)\u0000/g,(m,i)=>guard[i]);
  return t.split(/\n{2,}/).map(p=>{
    let html="",txt=[],itens=[];
    const fecha=()=>{if(txt.length){html+="<p>"+txt.join("<br>")+"</p>";txt=[]}if(itens.length){html+="<ul>"+itens.map(x=>"<li>"+x+"</li>").join("")+"</ul>";itens=[]}};
    p.split("\n").forEach(l=>{if(/^\s*[-•]\s/.test(l)){if(txt.length)fecha();itens.push(l.replace(/^\s*[-•]\s/,""))}else{if(itens.length)fecha();txt.push(l)}});
    fecha();return html}).join("");
}
const LETRAS="ABCDE";
function embaralhar(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("on"),2600)}
function festa(qtd=28,em=["🎉","⭐","✨","💛","🎊"]){const f=$("#festa");for(let i=0;i<qtd;i++){const s=document.createElement("i");s.textContent=em[i%em.length];s.style.left=Math.random()*100+"vw";s.style.animationDelay=Math.random()*.6+"s";f.appendChild(s);setTimeout(()=>s.remove(),3200)}}
function abrirModal(html){$("#modalCaixa").innerHTML=html;$("#modal").classList.remove("oculto")}
function fecharModal(){$("#modal").classList.add("oculto")}
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")fecharModal()});

/* ---------- palminhas 👏 (som feito na hora, sem arquivo) ---------- */
let audio=null;
function somPalmas(){
  if(!D.som)return;
  try{
    audio=audio||new (window.AudioContext||window.webkitAudioContext)();
    const agora=audio.currentTime;
    for(let k=0;k<6;k++){
      const t=agora+k*0.13+Math.random()*0.03,dur=0.09;
      const buf=audio.createBuffer(1,Math.floor(audio.sampleRate*dur),audio.sampleRate),dados=buf.getChannelData(0);
      for(let i=0;i<dados.length;i++)dados[i]=(Math.random()*2-1)*Math.pow(1-i/dados.length,4);
      const fonte=audio.createBufferSource();fonte.buffer=buf;
      const filtro=audio.createBiquadFilter();filtro.type="bandpass";filtro.frequency.value=1100+Math.random()*500;filtro.Q.value=0.9;
      const vol=audio.createGain();vol.gain.value=0.9;
      fonte.connect(filtro).connect(vol).connect(audio.destination);fonte.start(t);
    }
  }catch(e){}
}
function palmas(){
  somPalmas();
  if(navigator.vibrate)try{navigator.vibrate([40,60,40])}catch(e){}
  const p=$("#palmas");p.classList.remove("on");void p.offsetWidth;p.classList.add("on");
  festa(14,["👏","👏","✨","👏","⭐"]);
}

/* ---------- envio para a planilha da DayIA (com fila se estiver sem internet) ---------- */
function enviar(dados){D.fila.push(Object.assign({tipo:"aprova",id:D.id},dados));D.fila=D.fila.slice(-30);salvar();esvaziarFila()}
let enviando=false;
async function esvaziarFila(){
  if(enviando||!D.fila.length||!/^https:/.test(COFRE)||!navigator.onLine)return;
  enviando=true;
  try{while(D.fila.length){const r=await fetch(COFRE,{method:"POST",body:JSON.stringify(D.fila[0])}).then(x=>x.json());if(!r||!r.ok)break;D.fila.shift();salvar()}}catch(e){}
  enviando=false;
}
window.addEventListener("online",esvaziarFila);
function enviarProgresso(feito,certas,total){
  let a=0,e=0;Object.values(D.resp).forEach(r=>{a+=r.a;e+=r.e});
  const w=D.semanas[semanaAtual()]||{xp:0},m=D.meses[mesAtual()]||{xp:0,q:0};
  enviar({acao:"progresso",nome:D.nome,feito,certas,total,xp:D.xp,dias:D.dias.length,seq:sequencia(),acertos:a,erros:e,grupo:D.grupo||"",xpSemana:w.xp,semana:semanaAtual(),xpMes:m.xp,mes:mesAtual(),qMes:m.q,perfil:(D.avatar||"")+" "+D.nome});
}

/* ---------- semana e mês ---------- */
function semanaAtual(){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+3-(d.getDay()+6)%7);const s=new Date(d.getFullYear(),0,4);return d.getFullYear()+"-S"+String(1+Math.round(((d-s)/864e5-3+(s.getDay()+6)%7)/7)).padStart(2,"0")}
const mesAtual=()=>hoje().slice(0,7);
function contarQuestao(certo){if(certo)D.moedas=(D.moedas||0)+1;const h=new Date().getHours();if(h>=22)D.stats.coruja=1;if(h<7&&h>=4)D.stats.madrugadora=1;const w=semanaAtual(),m=mesAtual();D.semanas[w]=D.semanas[w]||{xp:0,q:0,a:0};D.meses[m]=D.meses[m]||{xp:0,q:0,a:0};D.semanas[w].q++;D.meses[m].q++;if(certo){D.semanas[w].a++;D.meses[m].a++;D.moedas+=1}salvar()}

/* ---------- pontos, nível e sequência ---------- */
const nivel=()=>Math.floor(D.xp/100);
const nomeNivel=()=>NIVEIS[Math.min(nivel(),NIVEIS.length-1)];
function totalAcertos(){return Object.values(D.resp).reduce((s,r)=>s+r.a,0)}
// Sequência de dias: um dia sem estudar por semana vira "dia de descanso" e não quebra a sequência.
function sequencia(){
  const set=new Set(D.dias);let d=set.has(hoje())?hoje():diaMenos(hoje(),1);
  let n=0,folgas=0;
  while(true){
    if(set.has(d)){n++;d=diaMenos(d,1);continue}
    if(n>0&&folgas<1+Math.floor(n/7)&&set.has(diaMenos(d,1))){folgas++;d=diaMenos(d,1);continue}
    break;
  }
  return n;
}
function ganhar(pts){const antes=nivel();D.xp+=pts;const w=semanaAtual(),m=mesAtual();D.semanas[w]=D.semanas[w]||{xp:0,q:0,a:0};D.meses[m]=D.meses[m]||{xp:0,q:0,a:0};D.semanas[w].xp+=pts;D.meses[m].xp+=pts;salvar();placar();if(nivel()>antes){setTimeout(()=>{festa(40);toast("🎉 Subiu de nível: "+nomeNivel()+"!")},400)}}
function conferirMedalhas(){MEDALHAS.forEach(m=>{if(!D.medalhas.includes(m.id)&&m.ok(D)){D.medalhas.push(m.id);salvar();setTimeout(()=>{festa(20);toast("🏅 Nova conquista: "+m.n)},900)}})}
function placar(){$("#placar").innerHTML=D.objetivo?`<span>🔥 ${sequencia()}</span><span class="xp">🪙 ${D.moedas}</span>`:""}

/* ---------- navegação ---------- */
let aba="inicio";
function ir(a){aba=a;render();window.scrollTo(0,0)}
document.querySelectorAll(".menu button").forEach(b=>b.onclick=()=>ir(b.dataset.aba));
function render0(){placar();$("#menu").classList.remove("oculto");document.querySelectorAll(".menu button").forEach(b=>b.classList.toggle("ativo",b.dataset.aba==="treinos"));window.scrollTo(0,0)}
function render(){
  placar();
  $("#menu").classList.toggle("oculto",!D.objetivo||aba==="quiz");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.toggle("ativo",b.dataset.aba===aba));
  if(!D.objetivo)return telaBoasVindas();
  ({inicio:telaInicio,trilha:telaTrilha,erros:telaErros,progresso:telaProgresso,quiz:telaQuiz,treinos:telaTreinos,duelo:telaDuelo}[aba]||telaInicio)();
}

/* ---------- boas-vindas ---------- */
function telaBoasVindas(){
  let obj=D.objetivo||"";
  $("#tela").innerHTML=`<div class="centro"><div class="grande">🎓</div><h2>Bem-vinda ao Aprova Fácil!</h2>
  <p class="sub">Missões curtinhas todo dia, pontos e conquistas. Estudar para o vestibular pode ser leve.</p></div>
  <div class="card"><label for="bvNome">Seu nome</label><input id="bvNome" placeholder="Como você quer ser chamada" autocomplete="name" value="${esc(D.nome)}">
  <label for="bvEmail">Seu e-mail</label><input id="bvEmail" type="email" inputmode="email" placeholder="seuemail@gmail.com" autocomplete="email" value="${esc(D.email)}">
  <label for="bvTel">Seu WhatsApp</label><input id="bvTel" type="tel" inputmode="tel" placeholder="(19) 99999-9999" autocomplete="tel" value="${esc(D.tel)}">
  <label>Qual é o seu objetivo?</label>
  ${Object.entries(OBJETIVOS).map(([k,o])=>`<button class="objetivo ${k===obj?"sel":""}" data-obj="${k}"><span class="ic">${o.ic}</span><span><b>${o.nome}</b><span class="sub">${o.info}</span></span></button>`).join("")}
  <p class="sub" style="font-size:13px">Seu nome, contato e seu progresso nas missões ficam guardados com a DayIA, só para acompanhar sua preparação.</p>
  <button class="btn btn-pri btn-bloco" id="bvComecar" style="margin-top:6px">Começar minha jornada 🚀</button></div>`;
  $("#bvTel").oninput=e=>{let v=e.target.value.replace(/\D/g,"").slice(0,11);if(v.length>6)v=`(${v.slice(0,2)}) ${v.slice(2,v.length-4)}-${v.slice(-4)}`;else if(v.length>2)v=`(${v.slice(0,2)}) ${v.slice(2)}`;e.target.value=v};
  document.querySelectorAll("[data-obj]").forEach(b=>b.onclick=()=>{obj=b.dataset.obj;document.querySelectorAll("[data-obj]").forEach(x=>x.classList.toggle("sel",x===b))});
  $("#bvComecar").onclick=()=>{
    const nome=$("#bvNome").value.trim(),email=$("#bvEmail").value.trim(),tel=$("#bvTel").value.trim();
    if(!nome)return toast("Escreva o seu nome 😉");
    if(!/^\S+@\S+\.\S+$/.test(email))return toast("Confira o seu e-mail 📧");
    if(tel.replace(/\D/g,"").length<10)return toast("Confira o seu WhatsApp com DDD 📱");
    if(!obj)return toast("Escolha o seu objetivo 🎯");
    Object.assign(D,{nome,email,tel,objetivo:obj,dataProva:OBJETIVOS[obj].prova});salvar();
    enviar({acao:"cadastro",nome,email,tel,objetivo:OBJETIVOS[obj].nome});
    festa();ir("inicio");
  };
}

/* ---------- início ---------- */
function telaInicio(){
  const o=OBJETIVOS[D.objetivo];
  const faltam=Math.max(0,Math.ceil((new Date(D.dataProva+"T12:00:00")-new Date())/864e5));
  const feita=D.missao&&D.missao.data===hoje()&&D.missao.fim;
  const h=new Date().getHours(),saud=h<12?"Bom dia":h<18?"Boa tarde":"Boa noite";
  const xpNivel=D.xp%100;
  $("#tela").innerHTML=`<p class="ola">${saud}${D.nome?", "+esc(D.nome):""}! 👋</p>
  <button class="busca-inicio" id="buscaInicio">🔍 <span>Procurar no app… (ex.: oral, relâmpago, redação)</span></button>
  <div class="card contagem"><div class="sub">${o.ic} ${o.nome}</div><div class="num">${faltam}</div><div class="sub">${D.dataCerta?`dias para a prova (${new Date(D.dataProva+"T12:00:00").toLocaleDateString("pt-BR")})`:`dias, mais ou menos, até a prova · previsão: ${D.objetivo==="gv"?"outubro":"novembro"} de 2027`}</div>${D.dataCerta?"":`<div class="sub" style="font-size:13px;margin-top:6px">Quando sair a data oficial, coloque em ⚙️ Ajustes</div>`}</div>
  <div class="stats"><div class="stat"><b>🔥 ${sequencia()}</b><small>dias seguidos</small></div><div class="stat"><b>⭐ ${D.xp}</b><small>pontos</small></div><div class="stat"><b>🏆 ${D.trofeus.length}</b><small>troféus</small></div></div>
  <div class="card"><b>Nível ${nivel()+1}: ${nomeNivel()}</b><div class="barra"><i style="width:${xpNivel}%"></i></div><div class="sub">Faltam ${100-xpNivel} pontos para o próximo nível</div></div>
  <div class="card missao ${feita?"feita":""}">${feita?`<h3>✅ Missão de hoje concluída!</h3><p class="sub">Você acertou ${D.missao.acertos} de ${D.missao.ids.length}. Amanhã tem mais. Se quiser, treine mais um pouco.</p><button class="btn btn-sec btn-bloco" id="btnExtra">Fazer uma missão extra ✨</button>`
   :`<h3>🎯 Missão do dia</h3><p class="sub">5 questões · uns 10 minutos · até 70 pontos</p><button class="btn btn-pri btn-bloco" id="btnMissao">${D.missao&&D.missao.data===hoje()?"Continuar a missão":"Começar a missão"}</button>`}</div>
  ${podeAviso()?`<div class="card aviso-card"><h3>🔔 Lembrete às 17h</h3><p class="sub">Um aviso no celular só nos dias em que você ainda não estudou. Nada de cobrança, é só um empurrãozinho 💛</p><button class="btn btn-pri btn-bloco" id="btnAviso">Quero o lembrete</button><button class="btn btn-sec btn-bloco" id="btnAvisoNao" style="margin-top:8px">Agora não</button></div>`:""}
  <div class="atalhos">
    <button data-ir="relampago"><span>⚡</span>Relâmpago</button>
    <button data-ir="simulado"><span>⏱️</span>Simulado</button>
    <button data-ir="redacao"><span>✍️</span>Redação</button>
    <button data-ir="${D.objetivo==="gv"?"oral":"discursiva"}"><span>${D.objetivo==="gv"?"🎤":"🧪"}</span>${D.objetivo==="gv"?"Oral":"Discursivas"}</button>
    <button data-ir="provas"><span>📄</span>Provas antigas</button>
    <button data-ir="foto"><span>📸</span>Foto</button>
  </div>
  <div class="card duelo-mini" id="cardDuelo"><b>👯‍♀️ Duelo das gêmeas</b><p class="sub">${D.grupo?"Veja o placar da semana e os recadinhos 💌":"Ligue o app com a sua irmã e vejam quem estuda mais!"}</p></div>
  <p class="sub centro">📚 ${carregado?Object.keys(BANCO).length.toLocaleString("pt-BR")+" questões no banco (ENEM 2009 a 2023 + DayIA)":"Carregando o banco de questões…"}</p>
  <button class="btn btn-sec btn-bloco" id="btnAjustes" style="margin-top:16px">⚙️ Ajustes</button>`;
  const b=$("#btnMissao");if(b)b.onclick=()=>comecarMissao(false);
  const x=$("#btnExtra");if(x)x.onclick=()=>comecarMissao(true);
  $("#btnAjustes").onclick=ajustes;
  document.querySelectorAll("[data-ir]").forEach(b=>b.onclick=()=>({relampago:relampago,simulado:escolherSimulado,redacao:telaRedacao,oral:telaOral,discursiva:telaDiscursiva,provas:telaProvasIA,foto:telaFoto}[b.dataset.ir])());
  $("#cardDuelo").onclick=()=>ir("duelo");
  $("#buscaInicio").onclick=abrirBusca;
  const av=$("#btnAviso");if(av){av.onclick=ativarAvisos;$("#btnAvisoNao").onclick=()=>{D.semAviso=Date.now();salvar();render()}}
}

/* ---------- missão / quiz ---------- */
let Q=null; // quiz em andamento: {ids,idx,acertos,modo,fim}
function sortearDa(area,ja){
  const ids=Object.keys(BANCO).filter(id=>BANCO[id].area===area&&!ja.includes(id));
  const errou=ids.filter(id=>D.erros.includes(id)),nunca=ids.filter(id=>!D.resp[id]);
  const pool=Math.random()<0.25&&errou.length?errou:(nunca.length?nunca:ids);
  return pool[Math.floor(Math.random()*pool.length)];
}
function escolherMissao(){const ids=[];OBJETIVOS[D.objetivo].missao.forEach(a=>{const id=sortearDa(a,ids);if(id)ids.push(id)});return embaralhar(ids)}
async function comecarMissao(extra){
  if(!carregado){toast("Carregando as questões…");await carregando}
  if(!extra&&D.missao&&D.missao.data===hoje()&&!D.missao.fim&&D.missao.ids.every(id=>BANCO[id])){Q=D.missao}
  else{Q={data:hoje(),ids:escolherMissao(),idx:0,acertos:0,modo:extra?"extra":"missao",fim:false};if(!extra){D.missao=Q;salvar()}}
  ir("quiz");
}
function treinar(ids,modo){Q={data:hoje(),ids:ids.filter(id=>BANCO[id]),idx:0,acertos:0,modo,fim:false};if(!Q.ids.length)return toast("Nada para treinar aqui ainda");ir("quiz")}
function telaQuiz(){
  if(!Q)return ir("inicio");
  if(Q.idx>=Q.ids.length)return fimQuiz();
  const id=Q.ids[Q.idx],q=BANCO[id];
  $("#tela").innerHTML=`<div class="topoq"><button class="fechar" id="sair" aria-label="Sair">✕</button><div class="barra"><i style="width:${Q.idx/Q.ids.length*100}%"></i></div><b>${Q.idx+1}/${Q.ids.length}</b></div>
  <span class="tagm">${q.tag}</span> <span class="fonte">${esc(q.fonte)}</span>
  ${q.t?`<div class="texto-base">${texto(q.t)}</div>`:""}<div class="enun">${texto(q.p)}</div>
  <div id="alts">${q.a.map((t,i)=>`<button class="alt" data-i="${i}"><span class="l">${LETRAS[i]}</span><span>${texto(t)}</span></button>`).join("")}</div><div id="volta"></div>`;
  $("#sair").onclick=()=>{if(Q.modo==="missao"){D.missao=Q;salvar()}Q=null;ir("inicio")};
  document.querySelectorAll(".alt").forEach(b=>b.onclick=()=>responder(id,+b.dataset.i));
}
function responder(id,i){
  const q=BANCO[id],certo=i===q.c;
  document.querySelectorAll(".alt").forEach(b=>{b.disabled=true;const k=+b.dataset.i;if(k===q.c)b.classList.add("certa");else if(k===i)b.classList.add("errada")});
  const r=D.resp[id]||{a:0,e:0};
  if(certo){r.a++;Q.acertos++;if(D.erros.includes(id)){D.erros=D.erros.filter(x=>x!==id);D.corrigiu=true}}
  else{r.e++;if(!D.erros.includes(id))D.erros.push(id)}
  D.resp[id]=r;contarQuestao(certo);const pts=certo?10:2;ganhar(pts);
  if(certo)palmas();
  const elogios=["Isso aí! 👏","Mandou bem! 💪","Arrasou! 👏","Perfeito! 🎯","Que orgulho! 💛"],calmas=["Quase! Bora entender 💡","Tudo bem errar aqui 😉","Agora você não esquece mais 💡"];
  $("#volta").innerHTML=`<div class="explica ${certo?"ok":"nao"}"><h3>${certo?elogios[Math.floor(Math.random()*elogios.length)]:calmas[Math.floor(Math.random()*calmas.length)]} <span class="mais">+${pts}</span></h3>
  ${certo?"":`<p class="sub">A resposta certa é a <b>${LETRAS[q.c]}</b>.</p>`}
  ${q.x?texto(q.x):`<div id="expIA"><button class="btn btn-sec btn-bloco" id="btnIA">💡 Entender com a professora IA</button></div>`}
  <button class="btn btn-pri btn-bloco" id="prox" style="margin-top:12px">${Q.idx+1<Q.ids.length?"Próxima →":"Ver resultado 🏁"}</button></div>`;
  if(Q.modo==="missao"){D.missao=Q}
  salvar();
  const bia=$("#btnIA");if(bia)bia.onclick=()=>explicarIA(id,i);
  $("#prox").onclick=()=>{Q.idx++;if(Q.modo==="missao"){D.missao=Q;salvar()}render();window.scrollTo(0,0)};
  $("#volta").scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function explicarIA(id,marcada){
  const q=BANCO[id],box=$("#expIA");
  if(!/^https:/.test(COFRE))return box.innerHTML=`<p class="sub">A professora IA ainda está sendo ligada. Logo, logo funciona! 💛</p>`;
  box.innerHTML=`<p class="sub">💭 A professora IA está pensando…</p>`;
  try{
    const r=await fetch(COFRE,{method:"POST",body:JSON.stringify({tipo:"explicar",objetivo:OBJETIVOS[D.objetivo].nome,fonte:q.fonte,enunciado:(q.t?q.t+"\n\n":"")+q.p,alternativas:q.a,correta:q.c,marcada})}).then(x=>x.json());
    if(!r.ok)throw new Error(r.mensagem||"erro");
    box.innerHTML=`<div class="ia">${texto(r.resultado,true)}</div>`;
  }catch(e){box.innerHTML=`<p class="sub">Não consegui falar com a professora IA agora (${esc(e.message)}). Tente de novo daqui a pouco.</p><button class="btn btn-sec btn-bloco" id="btnIA">Tentar de novo</button>`;$("#btnIA").onclick=()=>explicarIA(id,marcada)}
}
function fimQuiz(){
  const n=Q.ids.length,a=Q.acertos;let bonus=0;
  if(Q.modo==="desafio"){const qq=Q;Q=null;conferirMedalhas();conferirTrofeus();ganhar(a*5);if(a>=4)palmas();enviarProgresso("Desafio com código",a,n);return fimDesafio(a,n)}
  if(Q.modo==="missao"&&!Q.fim){Q.fim=true;D.missao=Q;if(!D.dias.includes(hoje()))D.dias.push(hoje());bonus=20;D.moedas+=5;if(a===n){D.perfeita=true;stat("perfeitas")}salvar();ganhar(bonus)}
  conferirMedalhas();conferirTrofeus();placar();festa(a>=n-1?40:18);
  enviarProgresso({missao:"Missão do dia",extra:"Missão extra",treino:"Treino na trilha",revisao:"Revisão de erros"}[Q.modo]||Q.modo,a,n);
  const msg=a===n?"Missão perfeita! Você está voando 🚀":a>=n*.6?"Muito bem! Cada missão te deixa mais perto da aprovação 💛":"Hoje foi dia de aprender com os erros, e isso conta muito! 💪";
  $("#tela").innerHTML=`<div class="card centro"><div class="grande">${a===n?"🏆":a>=n*.6?"🎉":"🌱"}</div><h2>${a} de ${n} certas</h2><p>${msg}</p>
  ${bonus?`<p><span class="mais">+${bonus}</span> bônus por concluir a missão do dia</p>`:""}
  <p class="sub">🔥 Sequência: ${sequencia()} ${sequencia()===1?"dia":"dias"} · ⭐ ${D.xp} pontos</p>
  <button class="btn btn-pri btn-bloco" id="fimOk">Voltar ao início</button>
  ${D.erros.length?`<button class="btn btn-sec btn-bloco" id="fimRev" style="margin-top:10px">🔁 Revisar meus erros</button>`:""}</div>`;
  if(a===n)palmas();
  Q=null;
  $("#fimOk").onclick=()=>ir("inicio");const r=$("#fimRev");if(r)r.onclick=()=>ir("erros");
}

/* ---------- trilha ---------- */
function telaTrilha(){
  $("#tela").innerHTML=`<h2>🗺️ Sua trilha</h2>${htmlMapa()}<h3>📚 Treinar por área</h3><p class="sub">Faça uma fase de 5 questões. Cada acerto acende um pedacinho do caminho e chega mais perto do próximo chefão 🐉</p>
  <div class="lupa"><input id="busca" placeholder="Procurar área ou matéria" autocomplete="off"></div><div id="lista"></div>`;
  const desenhar=()=>{const t=$("#busca").value.trim().toLowerCase();
    $("#lista").innerHTML=Object.entries(AREAS).filter(([k,a])=>(a.n+" "+a.sub).toLowerCase().includes(t)).map(([k,a])=>{
      const ids=Object.keys(BANCO).filter(id=>BANCO[id].area===k),ok=ids.filter(id=>D.resp[id]&&D.resp[id].a>0&&!D.erros.includes(id)).length;
      const fase=Math.floor(ok/5)+1,naFase=ok%5;
      return `<button class="materia" data-a="${k}"><span class="ic">${a.i}</span><span class="info"><b>${a.n}</b><span class="sub">${a.sub}</span><span class="sub">Fase ${fase} · ${ok} de ${ids.length} dominadas</span><span class="fases">${[0,1,2,3,4].map(x=>`<i class="${x<naFase?"ok":""}"></i>`).join("")}</span></span><span>▶️</span></button>`}).join("")||`<p class="sub">Nada com esse nome.</p>`;
    document.querySelectorAll("[data-a]").forEach(b=>b.onclick=async()=>{if(!carregado){toast("Carregando as questões…");await carregando}const ids=[];for(let k=0;k<5;k++){const id=sortearDa(b.dataset.a,ids);if(id)ids.push(id)}treinar(ids,"treino")});};
  $("#busca").oninput=desenhar;desenhar();ligarMapa();
}

/* ---------- revisar erros ---------- */
function telaErros(){
  const erros=D.erros.filter(id=>BANCO[id]);
  $("#tela").innerHTML=`<h2>🔁 Revisar</h2><p class="sub">As questões que você errou ficam aqui. Acertou de novo? Ela sai da lista e você ganha uma conquista.</p>
  ${erros.length?`<button class="btn btn-pri btn-bloco" id="refazTodas" style="margin-bottom:12px">Refazer ${Math.min(5,erros.length)} questões agora</button><div class="lupa"><input id="busca" placeholder="Procurar nos erros" autocomplete="off"></div><div id="lista"></div>`
  :`<div class="card centro"><div class="grande">✨</div><p>${carregado||!D.erros.length?"Nenhum erro para revisar. Continue assim!":"Carregando…"}</p></div>`}`;
  if(!erros.length)return;
  $("#refazTodas").onclick=()=>treinar(embaralhar(erros).slice(0,5),"revisao");
  const desenhar=()=>{const t=$("#busca").value.trim().toLowerCase();
    $("#lista").innerHTML=erros.filter(id=>(BANCO[id].p+" "+BANCO[id].t+" "+BANCO[id].tag+" "+BANCO[id].fonte).toLowerCase().includes(t)).map(id=>{const q=BANCO[id],res=(q.p||q.t).replace(/[*\\]/g,"");return `<button class="materia" data-q="${id}"><span class="ic">${AREAS[q.area].i}</span><span class="info"><b>${AREAS[q.area].n}</b><span class="sub">${esc(q.fonte)} · ${esc(res.slice(0,80))}${res.length>80?"…":""}</span></span><span>▶️</span></button>`}).join("")||`<p class="sub">Nada encontrado.</p>`;
    document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>treinar([b.dataset.q],"revisao"));};
  $("#busca").oninput=desenhar;desenhar();
}

/* ---------- conquistas e progresso ---------- */
function telaProgresso(){
  const porArea=Object.keys(AREAS).map(k=>{let a=0,e=0;Object.entries(D.resp).forEach(([id,r])=>{const q=BANCO[id];if(q&&q.area===k){a+=r.a;e+=r.e}});return {k,a,e,p:a+e?Math.round(a/(a+e)*100):null}});
  const feitas=porArea.filter(x=>x.p!==null).sort((x,y)=>y.p-x.p);
  const forte=feitas.filter(x=>x.p>=70).slice(0,2),vale=feitas.filter(x=>x.p<60).slice(-2);
  $("#tela").innerHTML=`<h2>🏆 Conquistas</h2>
  <div class="card perfil"><span class="avatar-grande">${D.avatar}</span><div><b>${esc(D.nome)}</b><div class="sub">Nível ${nivel()+1}: ${nomeNivel()} · ⭐ ${D.xp} · 🪙 ${D.moedas}</div></div></div>
  <div class="dois"><button class="btn btn-pri" id="btnLoja">🛍️ Loja</button><button class="btn btn-sec" id="btnResumo">📸 Minha semana</button></div>
  <h3>🏆 Estante de troféus · ${D.trofeus.length} de ${TROFEUS.length}</h3>
  <div class="estante">${TROFEUS.map(t=>{const tem=D.trofeus.includes(t.id);return `<div class="trofeu ${tem?"":"bloq"}" title="${esc(t.d)}"><span>${tem||!t.secreto?t.i:"❓"}</span><b>${tem||!t.secreto?esc(t.n):"Secreto"}</b><small>${tem||!t.secreto?esc(t.d):"Descubra como ganhar 👀"}</small></div>`}).join("")}</div>
  <h3>🏅 Medalhas</h3>
  <div class="medalhas">${MEDALHAS.map(m=>`<div class="medalha ${D.medalhas.includes(m.id)?"":"bloq"}"><span>${m.i}</span>${m.n}</div>`).join("")}</div>
  <div class="card" style="margin-top:14px"><h3>📊 Como você está</h3>
  ${feitas.length?`${forte.length?`<p>💪 Forte em: <b>${forte.map(x=>AREAS[x.k].n).join(" e ")}</b></p>`:""}${vale.length?`<p>💡 Vale treinar: <b>${vale.map(x=>AREAS[x.k].n).join(" e ")}</b></p>`:""}
  ${porArea.map(x=>`<div class="linhamat"><span class="nome">${AREAS[x.k].i} ${AREAS[x.k].n}</span><div class="barra"><i style="width:${x.p||0}%"></i></div><small>${x.p===null?"–":x.p+"%"}</small></div>`).join("")}`
  :`<p class="sub">Faça a primeira missão para ver aqui as áreas em que você brilha. ✨</p>`}</div>`;
  $("#btnLoja").onclick=telaLoja;$("#btnResumo").onclick=resumoSemana;
}


/* ---------- provas antigas oficiais (abrem no site de origem) ---------- */
const PROVAS={
  fuvest:[
    {n:"Fuvest 2027 · 1ª fase · prova",u:"https://www.curso-objetivo.br/vestibular/resolucao-comentada/fuvest/2027_1fase/fuvest2027_1fase_prova_V1.pdf",d:"Prova de Conhecimentos Gerais"},
    {n:"Fuvest 2027 · 1ª fase · gabarito",u:"https://www.curso-objetivo.br/vestibular/resolucao-comentada/fuvest/2027_1fase/fuvest2027_1fase_gabarito.pdf",d:"Respostas certas",gab:1},
    {n:"Fuvest 2026 · 1ª fase · prova",u:"https://www.curso-objetivo.br/vestibular/resolucao-comentada/fuvest/2026_1fase/fuvest2026_1fase_prova_V1.pdf",d:"Prova de Conhecimentos Gerais"},
    {n:"Fuvest 2026 · 1ª fase · gabarito",u:"https://www.curso-objetivo.br/vestibular/resolucao-comentada/fuvest/2026_1fase/fuvest2026_1fase_gabarito.pdf",d:"Respostas certas",gab:1},
    {n:"Fuvest 2025 · 1ª fase · prova",u:"https://www.curso-objetivo.br/vestibular/resolucao-comentada/fuvest/2025_1fase/fuvest2025_1fase_prova_V1.pdf",d:"Prova de Conhecimentos Gerais"},
    {n:"Fuvest 2025 · 1ª fase · gabarito",u:"https://www.curso-objetivo.br/vestibular/resolucao-comentada/fuvest/2025_1fase/fuvest2025_1fase_gabarito.pdf",d:"Respostas certas",gab:1},
    {n:"Fuvest 2024 · 1ª fase · prova",u:"https://www.fuvest.br/wp-content/uploads/fuvest2024_primeira_fase_prova_X.pdf",d:"Prova de Conhecimentos Gerais (versão X)"},
    {n:"Fuvest 2024 · 1ª fase · gabarito",u:"https://www.fuvest.br/wp-content/uploads/fuvest2024_gabarito_primeira_fase.pdf",d:"Respostas certas",gab:1},
    {n:"Fuvest 2021 · 1ª fase · prova",u:"https://www.curso-objetivo.br/vestibular/resolucao-comentada/fuvest/2021_1fase/fuvest2021_1fase_prova.pdf",d:"Prova de Conhecimentos Gerais"},
    {n:"Fuvest 2021 · 1ª fase · gabarito",u:"https://www.curso-objetivo.br/vestibular/resolucao-comentada/fuvest/2021_1fase/fuvest2021_1fase_gabarito.pdf",d:"Respostas certas",gab:1}
  ],
  gv:[
    {n:"Direito GV 2019 · 1ª fase · 1º dia",u:"https://www.curso-objetivo.br/vestibular/resolucao_comentada/fgvsp/2019_direito_1fase/1dia/fgvsp2019_direito_1dia.pdf",d:"Prova com resolução comentada",gab:1},
    {n:"Direito GV 2018 · 1ª fase · 2º dia",u:"https://curso-objetivo.br/vestibular/resolucao_comentada/fgvsp/2018_direito_1fase/2dia/fgvsp2018_direito_2dia.pdf",d:"Prova com resolução comentada",gab:1},
    {n:"Direito GV 2013 · 1ª fase · 1º dia",u:"https://curso-objetivo.br/vestibular/resolucao_comentada/fgvsp/2013_direito_1fase/1dia/fgvsp2013_direito_1dia_prova.pdf",d:"Prova"},
    {n:"Direito GV 2013 · 1ª fase · 2º dia",u:"https://www.curso-objetivo.br/vestibular/resolucao_comentada/fgvsp/2013_direito_1fase/2dia/fgvsp2013_direito_2dia_prova.pdf",d:"Prova"},
    {n:"Direito GV 2012 · 1ª fase · 1º dia",u:"https://curso-objetivo.br/vestibular/resolucao_comentada/fgvsp/2012_direito_1fase/1dia/fgvsp_direito_1dia_prova.pdf",d:"Prova"},
    {n:"Direito GV 2011 · 1ª fase · 1º dia",u:"https://curso-objetivo.br/vestibular/resolucao_comentada/fgvsp/2011_direito_1fase/1dia/fgvsp_direito_1dia_prova.pdf",d:"Prova"},
    {n:"Direito GV 2010 · 1ª fase · 2º dia",u:"https://curso-objetivo.br/vestibular/resolucao_comentada/fgvsp/2010_direito_1fase/2dia/fgv2010_direito_1fase_2dia_prova.pdf",d:"Prova"},
    {n:"Direito GV 2009 · 1ª fase · 2º dia",u:"https://curso-objetivo.br/vestibular/resolucao_comentada/fgvsp/2009_direito_1fase/2dia/fgv2009_direito_1fase_2dia_prova.pdf",d:"Prova"}
  ]
};

/* ---------- ajustes ---------- */
function ajustes(){
  abrirModal(`<h3>⚙️ Ajustes</h3><label for="jNome">Seu nome</label><input id="jNome" value="${esc(D.nome)}">
  <label for="jObj">Objetivo</label><select id="jObj">${Object.entries(OBJETIVOS).map(([k,o])=>`<option value="${k}" ${k===D.objetivo?"selected":""}>${o.ic} ${o.nome}</option>`).join("")}</select>
  <label for="jData">Data da prova</label><input id="jData" type="text" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" value="${D.dataProva.split("-").reverse().join("/")}">
  <p class="sub">${D.dataCerta?"Data informada por você.":"Por enquanto é só uma previsão. Quando a "+(D.objetivo==="gv"?"GV":"Fuvest")+" divulgar o dia da prova, coloque aqui."}</p>
  ${D.grupo?`<p class="sub">👯‍♀️ Código do duelo das gêmeas: <b>${esc(D.grupo)}</b></p>`:""}
  <label class="linha-som"><input type="checkbox" id="jSom" ${D.som?"checked":""}> 👏 Som de palminhas quando acertar</label>
  <label class="linha-som"><input type="checkbox" id="jLem" ${D.lembrete!==false?"checked":""}> 📩 Lembrete por e-mail às 17h (só nos dias sem estudo)</label>
  ${window.Notification&&Notification.permission!=="granted"?`<button class="btn btn-sec btn-bloco" id="jAviso" style="margin-top:8px">🔔 Ligar aviso no celular</button>`:""}
  <button class="btn btn-pri btn-bloco" id="jSalvar" style="margin-top:12px">Salvar</button>
  <button class="btn btn-sec btn-bloco" id="jZerar" style="margin-top:10px">Começar do zero</button>`);
  $("#jData").oninput=e=>{let v=e.target.value.replace(/\D/g,"").slice(0,8);if(v.length>4)v=v.slice(0,2)+"/"+v.slice(2,4)+"/"+v.slice(4);else if(v.length>2)v=v.slice(0,2)+"/"+v.slice(2);e.target.value=v};
  $("#jSalvar").onclick=()=>{const m=$("#jData").value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return toast("Escreva a data assim: dd/mm/aaaa");
    const nv=$("#jObj").value,mudou=nv!==D.objetivo||$("#jNome").value.trim()!==D.nome;D.nome=$("#jNome").value.trim();const nova=`${m[3]}-${m[2]}-${m[1]}`,dataMudou=nova!==D.dataProva;if(nv!==D.objetivo&&!dataMudou){D.dataCerta=false;D.objetivo=nv;D.dataProva=OBJETIVOS[nv].prova}else{D.objetivo=nv;if(dataMudou){D.dataCerta=true;D.dataProva=nova}}D.som=$("#jSom").checked;const lem=$("#jLem").checked;if(lem!==(D.lembrete!==false)){D.lembrete=lem;cofre({tipo:"lembrete",ativo:lem}).catch(()=>{})}salvar();
    if(mudou)enviar({acao:"cadastro",nome:D.nome,email:D.email,tel:D.tel,objetivo:OBJETIVOS[nv].nome});
    fecharModal();toast("Ajustes salvos ✅");render()};
  const ja=$("#jAviso");if(ja)ja.onclick=()=>{fecharModal();ativarAvisos()};
  $("#jZerar").onclick=()=>{if(!confirm("Apagar todos os pontos e o progresso deste celular?"))return;const guarda={id:D.id,nome:D.nome,email:D.email,tel:D.tel};D=Object.assign(novo(),guarda);salvar();fecharModal();ir("inicio")};
}

/* ---------- instalar ---------- */
let pedidoInstalar=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();pedidoInstalar=e});
const instalado=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone;
if(instalado())$("#btnInstalar").classList.add("oculto");
window.addEventListener("appinstalled",()=>{$("#btnInstalar").classList.add("oculto");toast("Aprova Fácil instalado! 🎉")});
$("#btnInstalar").onclick=()=>{
  if(pedidoInstalar){pedidoInstalar.prompt();pedidoInstalar.userChoice.finally(()=>pedidoInstalar=null);return}
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  abrirModal(`<h3>⬇️ Instalar o Aprova Fácil</h3>${ios?`<p>No iPhone, pelo Safari:</p><ol><li>Toque em <b>Compartilhar</b> (quadrado com seta para cima).</li><li>Toque em <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>.</li></ol>`:`<p>No Android, pelo Chrome:</p><ol><li>Toque nos <b>três pontinhos ⋮</b> no canto de cima.</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme em <b>Instalar</b>.</li></ol>`}<button class="btn btn-pri btn-bloco" onclick="fecharModal()">Entendi</button>`);
};
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));

/* ---------- abertura ---------- */
(function(){const i=$("#intro");if(!i)return;
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches){i.remove();return}
  setTimeout(()=>i.classList.add("passo2"),1500);setTimeout(()=>i.classList.add("fim"),2700);setTimeout(()=>i.remove(),3400);})();

aplicarTema();render();esvaziarFila();if(D.grupo)setTimeout(avisarRecados,4000);setTimeout(conferirTrofeus,2500);

/* ---------- lembrete das 17h: aviso no celular (OneSignal, o mesmo da Agenda Fácil) ---------- */
const OS_APP="7a1178de-2e8b-4205-aeb9-8171f97fb614";const PUSH={os:null,sub:null};
function podeAviso(){return !!(window.Notification&&Notification.permission==="default"&&(!D.semAviso||Date.now()-D.semAviso>7*864e5)&&D.dias.length>0)}
(function(){
  if(!("serviceWorker" in navigator)||!window.PushManager||location.protocol!=="https:")return;
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  OneSignalDeferred.push(async function(OS){
    try{
      await OS.init({appId:OS_APP,serviceWorkerPath:"push/OneSignalSDKWorker.js",serviceWorkerParam:{scope:"/push/"},autoResubscribe:true,notifyButton:{enable:false},welcomeNotification:{disable:true}});
      PUSH.os=OS;
      const at=()=>{const s=OS.User.PushSubscription;PUSH.sub=(s.optedIn&&s.id)?s.id:null;if(PUSH.sub)registrarAviso()};
      OS.User.PushSubscription.addEventListener("change",at);
      if(Notification.permission==="granted"&&!OS.User.PushSubscription.optedIn){try{await OS.User.PushSubscription.optIn()}catch(e){}}
      at();
    }catch(e){console.log("avisos indisponíveis",e)}
  });
  const s=document.createElement("script");s.src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";s.defer=true;document.head.appendChild(s);
})();
function registrarAviso(){if(!PUSH.sub||!D.id||!D.objetivo||D.avisoReg===PUSH.sub)return;cofre({tipo:"push_reg",sub:PUSH.sub}).then(()=>{D.avisoReg=PUSH.sub;salvar()}).catch(()=>{})}
async function ativarAvisos(){
  if(!PUSH.os){
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
    if(ios&&!instalado())return abrirModal(`<h3>🔔 Aviso no celular</h3><p>No iPhone, o aviso só funciona com o app instalado. Toque em <b>⬇️ Instalar</b> lá em cima, abra o Aprova Fácil pela tela do celular e tente de novo.</p><button class="btn btn-pri btn-bloco" onclick="fecharModal()">Entendi</button>`);
    return toast("Só um instantinho e tente de novo 🙂");
  }
  try{await PUSH.os.Notifications.requestPermission();if(Notification.permission==="granted"&&!PUSH.os.User.PushSubscription.optedIn)await PUSH.os.User.PushSubscription.optIn()}catch(e){}
  if(Notification.permission==="granted"){toast("🔔 Prontinho! Às 17h eu te lembro, se você ainda não tiver estudado.");festa(16,["🔔","✨","💛"])}
  else toast("Os avisos ficaram desligados. Tudo bem! 💛");
  render();
}

/* ---------- lupa: procurar qualquer coisa no app (atalho rápido) ---------- */
const semAcento=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function rolarPara(sel){setTimeout(()=>{const e=document.querySelector(sel);if(e){e.scrollIntoView({behavior:"smooth",block:"center"})}},350)}
async function treinarArea(a){if(!carregado){toast("Carregando as questões…");await carregando}const ids=[];for(let k=0;k<5;k++){const id=sortearDa(a,ids);if(id)ids.push(id)}treinar(ids,"treino")}
function atalhos(){return [
  ["🎯","Missão do dia","5 questões, uns 10 minutos","missao diaria questoes professora ia explica",()=>comecarMissao(false)],
  ["🎤","Treino de oral","A professora (banca) pergunta em voz alta e você responde falando","oral banca professora voz fala falar microfone entrevista ia gv direito exame oral",()=>telaOral()],
  ["⚡","Questão relâmpago","60 segundos, pontos em dobro","relampago rapido rapida 60 segundos dobro raio",()=>relampago()],
  ["⏱️","Simulado","10, 20 ou 45 questões com cronômetro","simulado prova cronometro teste tempo",()=>escolherSimulado()],
  ["✍️","Redação com IA","Tema novo, correção e nota","redacao texto escrever corrigir correcao nota tema dissertacao",()=>telaRedacao()],
  ["🧪","Discursivas","Questões da 2ª fase corrigidas pela IA","discursiva discursivas segunda fase escrever resposta dissertativa",()=>telaDiscursiva()],
  ["📄","Provas antigas","Fuvest e GV dentro do app, com ajuda da IA","provas antigas anteriores fuvest gv pdf vestibular ler",()=>telaProvasIA()],
  ["🔎","Método LUPA","O jeito certo de ler qualquer questão","lupa metodo ler leitura questao interpretar interpretacao",()=>{telaProvasIA();rolarPara(".lupa-metodo")}],
  ["📸","Foto de questão","Tire foto de uma questão e a IA explica","foto camera imagem apostila caderno tirar foto",()=>telaFoto()],
  ["🗺️","Trilha","O seu mapa até a aprovação","trilha mapa caminho regiao regioes fase nivel",()=>ir("trilha")],
  ["🐉","Chefão","10 questões para passar de região","chefao chefe boss desafio regiao",()=>{ir("trilha");rolarPara("#btnChefao")}],
  ...Object.entries(AREAS).map(([k,a])=>[a.i,a.n,"Treinar 5 questões · "+a.sub,"treinar area materia "+a.n+" "+a.sub,()=>treinarArea(k)]),
  ["❌","Revisar erros","Refazer as questões que você errou","erros errei revisar revisao refazer",()=>ir("erros")],
  ["👯‍♀️","Duelo das gêmeas","Placar, meta, prêmio e recadinhos","duelo irma irmas gemeas placar recado recados meta premio codigo",()=>ir("duelo")],
  ["🏁","Desafio com código","As mesmas 5 questões para as duas","desafio codigo irma competir",()=>telaDesafio()],
  ["🏆","Troféus","A sua estante de conquistas","trofeus trofeu conquistas medalhas estante",()=>ir("progresso")],
  ["🛍️","Loja","Cores do app e avatares com moedas","loja moedas comprar cores tema avatar",()=>{ir("progresso");telaLoja()}],
  ["📲","Minha semana","Imagem para postar nos stories","minha semana stories resumo imagem instagram postar",()=>{ir("progresso");resumoSemana()}],
  ["⚙️","Ajustes","Nome, objetivo, data da prova e palminhas","ajustes configuracoes configurar nome objetivo data prova som palminhas zerar",()=>{ir("inicio");ajustes()}],
  ["🔔","Lembrete e aviso no celular","Lembrete das 17h por e-mail e no celular","lembrete aviso notificacao notificacoes 17h email e-mail celular",()=>{ir("inicio");ajustes();rolarPara("#jLem")}],
  ["⬇️","Instalar o app","Colocar o Aprova Fácil na tela do celular","instalar app aplicativo tela inicial baixar",()=>{const b=$("#btnInstalar");if(b&&!b.classList.contains("oculto"))b.click();else toast("O app já está instalado 🎉")}],
  ["🏠","Início","Tela inicial","inicio home comeco",()=>ir("inicio")]
]}
function abrirBusca(){
  abrirModal(`<h3>🔍 Procurar no app</h3><input class="busca-campo" id="buscaTxt" placeholder="Ex.: oral, relâmpago, redação…" autocomplete="off"><div class="busca-lista" id="buscaLista"></div>`);
  const lista=atalhos(),campo=$("#buscaTxt");
  const mostrar=()=>{const t=semAcento(campo.value).trim().split(/\s+/).filter(Boolean);
    const r=lista.filter(a=>{const txt=semAcento(a[1]+" "+a[2]+" "+a[3]);return t.every(p=>txt.includes(p))});
    $("#buscaLista").innerHTML=r.length?r.map((a,i)=>`<button class="busca-item" data-b="${lista.indexOf(a)}"><span class="ic">${a[0]}</span><span><b>${a[1]}</b><small>${a[2]}</small></span></button>`).join(""):`<div class="busca-vazia">Não achei "${campo.value.replace(/[<>&"]/g,"")}" 🤔<br>Tente outra palavra, tipo <b>oral</b>, <b>simulado</b> ou <b>troféus</b>.</div>`;
    document.querySelectorAll("[data-b]").forEach(b=>b.onclick=()=>{fecharModal();if(typeof Q!=="undefined"&&Q&&aba==="quiz")Q=null;try{lista[+b.dataset.b][4]()}catch(e){console.error(e)}})};
  campo.oninput=mostrar;campo.onkeydown=e=>{if(e.key==="Enter"){const p=document.querySelector("[data-b]");if(p)p.click()}};
  mostrar();setTimeout(()=>campo.focus(),80);
}
$("#btnBusca").onclick=abrirBusca;
