// CryptoCheck v3 — importação rápida, auditoria guiada, histórico e ranking de pendências.
state.history=Array.isArray(state.history)?state.history:[];
state.settings={staleDays:30,...(state.settings||{})};

function ccStaleDays(){return Number(state.settings?.staleDays||30)}
function ccIsStaleBalance(b){return !b.checkedAt||(now()-Number(b.checkedAt))>ccStaleDays()*86400000}
function ccDaysSince(t){return t?Math.max(0,Math.floor((now()-Number(t))/86400000)):null}
function ccLastCheckForAsset(a){return Math.max(0,...balancesFor(a.id).map(b=>Number(b.checkedAt||0)))}
function ccHistoryForBalance(balanceId){return state.history.filter(h=>h.balanceId===balanceId).sort((a,b)=>Number(b.checkedAt)-Number(a.checkedAt))}
function ccRecordCheck(b){if(!b?.checkedAt)return;state.history.push({id:uid(),balanceId:b.id,assetId:b.assetId,locationId:b.locationId,qty:Number(b.qty||0),proof:b.proof,checkedAt:Number(b.checkedAt)})}
function ccAssetStatus(a){
  const expected=Number(a.expectedQty||0),found=foundQty(a),d=diffQty(a),missing=Math.max(0,d),extra=Math.max(0,-d);
  if(assetHasRisk(a))return {cls:"bad",text:"Em risco"};
  if(expected>0&&found<=1e-10)return {cls:"bad",text:"Não localizado"};
  if(missing>1e-10){const pct=expected>0?Math.min(100,(found/expected)*100):0;return {cls:"warn",text:`Parcial ${pct.toFixed(0)}%`}}
  if(extra>1e-10)return {cls:"warn",text:"Acima do registro"};
  if(isUncheckedAsset(a))return {cls:"warn",text:"Localizado • revisar"};
  return {cls:"ok",text:"100% localizado"};
}
function ccPendingRanking(){
  return state.assets.map(a=>{const qty=missingQty(a),p=priceOf(a),usd=p?qty*p:null;return {asset:a,qty,usd,hasPrice:!!p}})
    .filter(x=>x.qty>1e-10)
    .sort((a,b)=>a.hasPrice!==b.hasPrice?(a.hasPrice?-1:1):(a.hasPrice?b.usd-a.usd:b.qty-a.qty));
}

isUncheckedAsset=function(a){const bs=balancesFor(a.id);return !bs.length||bs.some(b=>!["confirmed","address"].includes(b.proof)||ccIsStaleBalance(b))};

priorityRows=function(){
  const rows=[];
  state.assets.forEach(a=>{
    const p=priceOf(a),m=missingQty(a);
    if(m>1e-10)rows.push({icon:"🔍",title:`${a.symbol}: quantidade não localizada`,text:`Esperado ${fmtQty(a.expectedQty)} • encontrado ${fmtQty(foundQty(a))} • explicado ${fmtQty(a.explainedQty||0)}`,value:p?fmtUSD(m*p):`${fmtQty(m)} ${a.symbol}`,score:p?m*p:1});
    if(assetHasRisk(a))rows.push({icon:"🚨",title:`${a.symbol}: saldo em local de risco`,text:balancesFor(a.id).filter(balanceRisk).map(b=>locationById(b.locationId)?.name||"Local").join(", "),value:p?fmtUSD(balancesFor(a.id).filter(balanceRisk).reduce((s,b)=>s+Number(b.qty)*p,0)):"Sem preço",score:999999});
    balancesFor(a.id).filter(b=>ccIsStaleBalance(b)).forEach(b=>{const l=locationById(b.locationId),days=ccDaysSince(b.checkedAt);rows.push({icon:"🕒",title:`${a.symbol}: conferência antiga`,text:`${l?.name||"Local"} • ${b.checkedAt?`${days} dias desde a última conferência`:"nunca conferido"}`,value:"Revisar",score:p?Number(b.qty||0)*p*.25:.5})});
    if(!p)rows.push({icon:"💲",title:`${a.symbol}: sem preço em USD`,text:"Informe CoinGecko ID ou preço manual.",value:"—",score:0});
  });
  return rows.sort((a,b)=>b.score-a.score);
};

renderAssets=function(){
  const q=$("assetSearch").value.trim().toLowerCase(),f=$("assetFilter").value;
  const list=state.assets.filter(a=>{const hay=[a.symbol,a.name,a.source].join(" ").toLowerCase();if(q&&!hay.includes(q))return false;if(f==="mismatch"&&Math.abs(diffQty(a))<1e-10)return false;if(f==="unchecked"&&!isUncheckedAsset(a))return false;if(f==="risk"&&!assetHasRisk(a))return false;if(f==="noprice"&&!noPrice(a))return false;return true});
  const box=$("assetList");
  box.innerHTML=list.length?list.map(a=>{
    const p=priceOf(a),fq=foundQty(a),dq=diffQty(a),missing=Math.max(0,dq),expected=Number(a.expectedQty||0),ratio=expected>0?Math.min(100,(fq/expected)*100):(fq>0?100:0),st=ccAssetStatus(a),last=ccLastCheckForAsset(a),bs=balancesFor(a.id);
    const status=`<span class="tag ${st.cls}">${esc(st.text)}</span>`;
    return `<div class="asset"><div class="asset-top"><div class="asset-name"><div class="coin">${esc(a.symbol.slice(0,3))}</div><div style="min-width:0"><h4>${esc(a.symbol)} ${a.name?`<span style="color:var(--muted);font-weight:600">• ${esc(a.name)}</span>`:""}</h4><div class="sub">${status} ${a.source?` • ${esc(a.source)}`:""}${last?` • conferido ${fmtDate(last)}`:" • ainda não conferido"}</div></div></div><div class="asset-value"><strong>${p?fmtUSD(fq*p):"Sem preço"}</strong><span>${fmtQty(fq)} ${esc(a.symbol)}</span></div></div><div class="asset-progress"><div class="progress-line"><span>Localizado ${ratio.toFixed(0)}%</span><span>${fmtQty(fq)} / ${fmtQty(expected)}</span></div><div class="progress-track"><div class="progress-bar" style="width:${ratio}%"></div></div></div><div class="asset-metrics"><div class="metric"><span>Registrado</span><strong>${fmtQty(expected)}</strong></div><div class="metric"><span>Encontrado</span><strong>${fmtQty(fq)}</strong></div><div class="metric"><span>Explicado</span><strong>${fmtQty(a.explainedQty||0)}</strong></div><div class="metric"><span>Preço</span><strong>${p?fmtUSD(p):"—"}</strong></div><div class="metric"><span>Não localizado</span><strong>${fmtQty(missing)}</strong></div></div>${bs.length?`<div style="margin-top:8px">${bs.map(b=>{const l=locationById(b.locationId);return `<div class="balance-chip"><strong>${esc(l?.name||"Local")}</strong> • ${fmtQty(b.qty)} ${esc(a.symbol)} • <span class="proof ${esc(b.proof)}">${esc(proofLabel(b.proof))}</span> • ${b.checkedAt?fmtDate(b.checkedAt):"não conferido"}</div>`}).join("")}</div>`:""}<div class="asset-actions"><button class="btn primary" onclick="addBalance('${a.id}')">+ Saldo encontrado</button><button class="btn" onclick="editAsset('${a.id}')">Editar</button><button class="btn danger" onclick="removeAsset('${a.id}')">Excluir</button></div></div>`;
  }).join(""):'<div class="empty"><strong>Nenhum ativo ainda</strong>Importe sua lista do CoinMarketCap ou adicione um ativo manualmente.</div>';
};

function renderPendingRanking(){
  const box=$("pendingRanking");if(!box)return;
  const rows=ccPendingRanking().slice(0,10);
  box.innerHTML=rows.length?rows.map((r,i)=>`<div class="rank-row"><div class="rank-pos">${i+1}</div><div><strong>${esc(r.asset.symbol)}</strong><span>${fmtQty(r.qty)} ${esc(r.asset.symbol)} ainda não localizado</span></div><div class="rank-value">${r.hasPrice?fmtUSD(r.usd):"Sem preço"}</div></div>`).join(""):'<div class="empty"><strong>Sem pendências</strong>Todos os ativos estão reconciliados.</div>';
}

renderInvestigate=function(){
  renderPendingRanking();
  const rows=priorityRows(),box=$("investigateList");
  state.locations.filter(l=>["closed","restricted","unknown"].includes(l.status)).forEach(l=>rows.push({icon:l.status==="closed"?"☠️":"⚠️",title:`${l.name}: ${locationStatusLabel(l.status)}`,text:`${l.type}${l.notes?` • ${l.notes}`:""}`,value:"Local",score:500000}));
  rows.sort((a,b)=>b.score-a.score);
  box.innerHTML=rows.length?rows.map(r=>`<div class="risk-row"><div class="risk-icon">${r.icon}</div><div><strong>${esc(r.title)}</strong><small>${esc(r.text)}</small></div><div class="risk-value">${esc(r.value)}</div></div>`).join(""):'<div class="empty"><strong>Nada para investigar</strong>Seu inventário não tem divergências ou locais de risco agora.</div>';
};

renderCheck=function(){
  const locFilter=$("checkLocationFilter"),old=locFilter.value;
  locFilter.innerHTML='<option value="">Todos os locais</option>'+state.locations.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join("");
  if([...locFilter.options].some(o=>o.value===old))locFilter.value=old;
  const sf=$("checkStatusFilter").value,lf=locFilter.value;let bs=state.balances.filter(b=>!lf||b.locationId===lf);
  if(sf==="unchecked")bs=bs.filter(b=>!["confirmed","address"].includes(b.proof)||ccIsStaleBalance(b));
  if(sf==="stale")bs=bs.filter(ccIsStaleBalance);
  $("checkList").innerHTML=bs.length?bs.map(b=>{const a=state.assets.find(x=>x.id===b.assetId),l=locationById(b.locationId),hist=ccHistoryForBalance(b.id).slice(0,5),stale=ccIsStaleBalance(b);return `<div class="check-item"><div class="check-head"><div><h4>${esc(a?.symbol||"")} • ${esc(l?.name||"")}</h4><p>${fmtQty(b.qty)} ${esc(a?.symbol||"")} • ${esc(proofLabel(b.proof))} • ${b.checkedAt?`última conferência ${fmtDate(b.checkedAt)}`:"nunca conferido"}</p></div>${stale?'<span class="tag warn">Revisar</span>':'<span class="tag ok">Atual</span>'}</div><div class="check-grid"><div><label>Saldo real agora</label><input id="check_${b.id}" type="number" min="0" step="any" value="${Number(b.qty)}"></div><div><label>Prova</label><select id="proof_${b.id}"><option value="confirmed">🟢 Confirmado agora</option><option value="address">🔵 Endereço verificado</option><option value="old">🟡 Registro antigo</option><option value="unchecked">🟠 Não conferido</option><option value="inaccessible">🔴 Inacessível</option><option value="lost">⚫ Perdido/encerrado</option></select></div><button class="btn primary" onclick="confirmBalance('${b.id}')">Salvar conferência</button></div>${hist.length?`<details class="history-box"><summary>Histórico de conferências (${ccHistoryForBalance(b.id).length})</summary>${hist.map(h=>`<div class="history-row"><span>${fmtDate(h.checkedAt)}</span><strong>${fmtQty(h.qty)} ${esc(a?.symbol||"")}</strong><small>${esc(proofLabel(h.proof))}</small></div>`).join("")}</details>`:""}</div>`}).join(""):'<div class="empty"><strong>Nada nesta fila</strong>Adicione saldos encontrados ou altere os filtros.</div>';
  bs.forEach(b=>setTimeout(()=>{const s=$("proof_"+b.id);if(s)s.value=b.proof},0));
};

$("balanceForm").onsubmit=e=>{e.preventDefault();const id=$("balanceId").value||uid(),proof=$("bProof").value,b={id,assetId:$("balanceAssetId").value,locationId:$("bLocation").value,qty:Number($("bQty").value),proof,network:$("bNetwork").value.trim(),notes:$("bNotes").value.trim(),checkedAt:["confirmed","address"].includes(proof)?now():null};const i=state.balances.findIndex(x=>x.id===id);if(i>=0)state.balances[i]=b;else state.balances.push(b);if(b.checkedAt)ccRecordCheck(b);closeModal("balanceModal");save()};
window.confirmBalance=id=>{const b=state.balances.find(x=>x.id===id);if(!b)return;b.qty=Number($("check_"+id).value);b.proof=$("proof_"+id).value;b.checkedAt=now();ccRecordCheck(b);save()};

$("importFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.assets)||!Array.isArray(d.locations)||!Array.isArray(d.balances))throw new Error();if(!confirm("Substituir os dados atuais por este backup?"))return;state={assets:d.assets,locations:d.locations,balances:d.balances,history:Array.isArray(d.history)?d.history:[],prices:d.prices||{},priceUpdatedAt:d.priceUpdatedAt||null,settings:{staleDays:30,...(d.settings||{})}};save()}catch{alert("Backup inválido.")}e.target.value=""};
$("clearBtn").onclick=()=>{if(confirm("Zerar todo o inventário do CryptoCheck?")){state={assets:[],locations:[],balances:[],history:[],prices:{},priceUpdatedAt:null,settings:{staleDays:30}};save()}};

function ccNumber(value){let s=String(value??"").trim().replace(/\s/g,"");if(!s)return 0;if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:NaN}
function ccLocationStatus(v){const s=String(v||"active").trim().toLowerCase();if(["closed","encerrado","fechado"].includes(s))return "closed";if(["restricted","restrito","difícil","dificil"].includes(s))return "restricted";if(["unknown","desconhecido"].includes(s))return "unknown";return "active"}
function ccProof(v){const s=String(v||"unchecked").trim().toLowerCase();if(["confirmed","confirmado","ok"].includes(s))return "confirmed";if(["address","endereco","endereço","blockchain"].includes(s))return "address";if(["old","antigo","registro antigo"].includes(s))return "old";if(["inaccessible","inacessivel","inacessível"].includes(s))return "inaccessible";if(["lost","perdido","encerrado"].includes(s))return "lost";return "unchecked"}
function ccTemplate(){return `# CRYPTOCHECK — MODELO COMPLETO\n# Use ; entre os campos. Linhas com # são ignoradas.\n\n[LOCAIS]\n# nome;tipo;status;apelido;observações\nMEXC;Exchange;active;Principal;\nLedger;Hardware wallet;active;Principal;\n\n[ATIVOS]\n# ticker;nome;quantidade registrada;fonte;CoinGecko ID;preço manual USD;quantidade explicada;motivo;observações\nKAVA;Kava;686,87;CoinMarketCap;kava;;0;;\nEGLD;MultiversX;7,939;CoinMarketCap;elrond-egld;;0;;\n\n[SALDOS]\n# ticker;local;quantidade encontrada;prova;rede;observações\nKAVA;MEXC;686,87;confirmed;Kava;\nEGLD;MEXC;6,968;confirmed;MultiversX;\n`}
function ccParseBulk(text){
  const lines=String(text||"").split(/\r?\n/),out={locations:[],assets:[],balances:[],errors:[]};let section="";
  lines.forEach((line,idx)=>{const raw=line.trim();if(!raw||raw.startsWith("#"))return;const sm=raw.match(/^\[(LOCAIS|ATIVOS|SALDOS)\]$/i);if(sm){section=sm[1].toUpperCase();return}try{if(!section){const p=raw.includes(";")?raw.split(";").map(x=>x.trim()):raw.split(/\s+/);if(p.length<2)throw new Error("use TICKER QUANTIDADE");const symbol=p[0].toUpperCase(),qty=ccNumber(p[1]);if(!symbol||!Number.isFinite(qty))throw new Error("ticker/quantidade inválidos");out.assets.push({symbol,name:"",expectedQty:qty,source:"CoinMarketCap",coinId:KNOWN[symbol]||"",manualPrice:0,explainedQty:0,explanation:"",notes:""});return}const p=raw.split(";").map(x=>x.trim());if(section==="LOCAIS"){if(!p[0])throw new Error("nome do local obrigatório");out.locations.push({name:p[0],type:p[1]||"Exchange",status:ccLocationStatus(p[2]),account:p[3]||"",notes:p.slice(4).join(";")||""})}else if(section==="ATIVOS"){const symbol=(p[0]||"").toUpperCase(),qty=ccNumber(p[2]);if(!symbol||!Number.isFinite(qty))throw new Error("ticker ou quantidade inválidos");out.assets.push({symbol,name:p[1]||"",expectedQty:qty,source:p[3]||"CoinMarketCap",coinId:p[4]||KNOWN[symbol]||"",manualPrice:ccNumber(p[5])||0,explainedQty:ccNumber(p[6])||0,explanation:p[7]||"",notes:p.slice(8).join(";")||""})}else{const symbol=(p[0]||"").toUpperCase(),loc=p[1],qty=ccNumber(p[2]);if(!symbol||!loc||!Number.isFinite(qty))throw new Error("ticker, local ou quantidade inválidos");out.balances.push({symbol,locationName:loc,qty,proof:ccProof(p[3]),network:p[4]||"",notes:p.slice(5).join(";")||""})}}catch(err){out.errors.push(`Linha ${idx+1}: ${err.message}`)}});return out;
}
function ccImportBulk(parsed){
  localStorage.setItem("cryptocheck_before_bulk_import",JSON.stringify({...state,backupAt:new Date().toISOString()}));let cLoc=0,cAsset=0,cBal=0,uAsset=0,uBal=0;
  parsed.locations.forEach(x=>{let l=state.locations.find(y=>y.name.trim().toLowerCase()===x.name.trim().toLowerCase());if(l)Object.assign(l,x);else{state.locations.push({id:uid(),...x});cLoc++}});
  parsed.assets.forEach(x=>{let a=state.assets.find(y=>y.symbol===x.symbol);if(a){Object.assign(a,x);uAsset++}else{state.assets.push({id:uid(),...x});cAsset++}});
  parsed.balances.forEach(x=>{const a=state.assets.find(y=>y.symbol===x.symbol);if(!a)return;let l=state.locations.find(y=>y.name.trim().toLowerCase()===x.locationName.trim().toLowerCase());if(!l){l={id:uid(),name:x.locationName,type:"Outro",status:"unknown",account:"",notes:"Criado pela importação"};state.locations.push(l);cLoc++}let b=state.balances.find(y=>y.assetId===a.id&&y.locationId===l.id);const checkedAt=["confirmed","address"].includes(x.proof)?now():null;if(b){Object.assign(b,{qty:x.qty,proof:x.proof,network:x.network,notes:x.notes,checkedAt});uBal++}else{b={id:uid(),assetId:a.id,locationId:l.id,qty:x.qty,proof:x.proof,network:x.network,notes:x.notes,checkedAt};state.balances.push(b);cBal++}if(checkedAt)ccRecordCheck(b)});
  save();return {cLoc,cAsset,cBal,uAsset,uBal};
}
$("bulkImportBtn").onclick=()=>{$("bulkImportText").value="";$("bulkImportResult").textContent="";openModal("bulkImportModal")};
$("fillTemplateBtn").onclick=()=>{$("bulkImportText").value=ccTemplate();$("bulkImportText").focus()};
$("bulkImportRunBtn").onclick=async()=>{const parsed=ccParseBulk($("bulkImportText").value);if(parsed.errors.length)return $("bulkImportResult").innerHTML=`<span style="color:var(--bad)">${esc(parsed.errors.slice(0,6).join(" • "))}</span>`;if(!parsed.assets.length&&!parsed.locations.length&&!parsed.balances.length)return $("bulkImportResult").textContent="Nada para importar.";if(!confirm(`Importar ${parsed.assets.length} ativo(s), ${parsed.locations.length} local(is) e ${parsed.balances.length} saldo(s)?`))return;const r=ccImportBulk(parsed);$("bulkImportResult").innerHTML=`<span style="color:var(--ok)">Importado: ${r.cAsset} novo(s) ativo(s), ${r.cLoc} local(is), ${r.cBal} saldo(s). Atualizados: ${r.uAsset} ativo(s), ${r.uBal} saldo(s).</span>`;if(parsed.assets.length)updatePrices().catch(()=>{})};

let ccAuditQueue=[],ccAuditIndex=0;
function ccAuditAsset(){return state.assets.find(a=>a.id===ccAuditQueue[ccAuditIndex])}
function ccStartAudit(){if(!state.assets.length)return alert("Cadastre ou importe pelo menos um ativo primeiro.");ccAuditQueue=[...state.assets].sort((a,b)=>((missingQty(a)>1e-10||isUncheckedAsset(a))?0:1)-((missingQty(b)>1e-10||isUncheckedAsset(b))?0:1)).map(a=>a.id);ccAuditIndex=0;openModal("auditModal");ccRenderAudit()}
function ccRenderAudit(){
  const a=ccAuditAsset(),body=$("auditBody");if(!a){const s=summary();body.innerHTML=`<div class="audit-finish"><div class="audit-check">✓</div><h3>Auditoria concluída</h3><p>${state.assets.length} ativo(s) revisados • ${s.mismatch} divergência(s) restantes.</p><div class="actions" style="justify-content:center"><button class="btn primary" onclick="closeModal('auditModal')">Concluir</button><a class="btn" href="#/investigar" onclick="closeModal('auditModal')">Ver pendências</a></div></div>`;return}
  const expected=Number(a.expectedQty||0),found=foundQty(a),missing=missingQty(a),pct=Math.round((ccAuditIndex/ccAuditQueue.length)*100),locs=state.locations;
  body.innerHTML=`<div class="audit-progress"><span>Ativo ${ccAuditIndex+1} de ${ccAuditQueue.length}</span><strong>${pct}%</strong><div class="progress-track"><div class="progress-bar" style="width:${pct}%"></div></div></div><div class="audit-asset"><div class="coin">${esc(a.symbol.slice(0,3))}</div><div><h3>${esc(a.symbol)} ${a.name?`• ${esc(a.name)}`:""}</h3><p>Registrado: <strong>${fmtQty(expected)}</strong> • encontrado: <strong>${fmtQty(found)}</strong> • falta: <strong>${fmtQty(missing)}</strong></p></div></div>${locs.length?`<div class="form-grid"><div><label>Onde você encontrou?</label><select id="auditLocation">${locs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join("")}</select></div><div><label>Saldo real agora</label><input id="auditQty" type="number" step="any" min="0" placeholder="0"></div><div><label>Prova</label><select id="auditProof"><option value="confirmed">🟢 Confirmado agora</option><option value="address">🔵 Verificado por endereço</option><option value="unchecked">🟠 Não conferido</option><option value="inaccessible">🔴 Inacessível</option><option value="lost">⚫ Perdido/encerrado</option></select></div><div><label>Rede (opcional)</label><input id="auditNetwork" placeholder="Ethereum, Tron, MultiversX..."></div></div><div class="actions audit-actions"><button class="btn primary" onclick="ccSaveAudit(true)">Salvar e próximo</button><button class="btn" onclick="ccSaveAudit(false)">+ Outro local</button><button class="btn ghost" onclick="ccSkipAudit()">Pular</button></div>`:`<div class="notice">Você ainda não cadastrou nenhum local. Adicione uma exchange ou wallet antes de registrar o saldo encontrado.</div><div class="actions" style="margin-top:10px"><a href="#/locais" class="btn primary" onclick="closeModal('auditModal')">Adicionar local</a><button class="btn ghost" onclick="ccSkipAudit()">Pular ativo</button></div>`}`;
}
window.ccSaveAudit=advance=>{const a=ccAuditAsset();if(!a)return;const qty=ccNumber($("auditQty")?.value);if(!Number.isFinite(qty))return alert("Informe o saldo encontrado.");const locationId=$("auditLocation").value,proof=$("auditProof").value,network=$("auditNetwork").value.trim();let b=state.balances.find(x=>x.assetId===a.id&&x.locationId===locationId),checkedAt=["confirmed","address"].includes(proof)?now():null;if(b)Object.assign(b,{qty,proof,network,checkedAt});else{b={id:uid(),assetId:a.id,locationId,qty,proof,network,notes:"Auditoria guiada",checkedAt};state.balances.push(b)}if(checkedAt)ccRecordCheck(b);save();if(advance)ccAuditIndex++;ccRenderAudit()};
window.ccSkipAudit=()=>{ccAuditIndex++;ccRenderAudit()};
$("startAuditBtn").onclick=ccStartAudit;
$("startAuditDataBtn").onclick=ccStartAudit;
renderAll();
