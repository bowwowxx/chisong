/* ══════════════════════════════════════════════
   持誦 · 金剛經與大悲咒背誦
   經文資料放在 data/*.json，由此檔載入後建構練習單位
   ══════════════════════════════════════════════ */
"use strict";

/* ══════════ 資料載入 ══════════ */
const SUTRAS = {};          // key -> built sutra
const RAW = {};             // key -> raw json
let dataReady = {vajra:false, dabei:false};

function fetchSutra(key){
  return fetch("data/" + key + ".json")
    .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(json => {
      RAW[key] = json;
      SUTRAS[key] = buildSutra(key, json);
      dataReady[key] = true;
    });
}

/* ══════════ 單位建構 ══════════ */
function mergeUnits(seg){
  const parts = seg.split("。").filter(s => s.length);
  const units = []; let buf = "";
  for(const p of parts){
    buf += p + "。";
    if(buf.replace(/。/g, "").length >= 6){ units.push(buf); buf = ""; }
  }
  if(buf){ if(units.length) units[units.length-1] += buf; else units.push(buf); }
  return units;
}

function buildSutra(key, json){
  if(key === "vajra"){
    const segs = json.segs.map(mergeUnits);
    const units = []; segs.forEach((us, si) => us.forEach(u => units.push({t:u, seg:si})));
    return {key, name:json.name, segs, units, segCount:segs.length, drills:[]};
  }
  // dabei
  const segs = []; let start = 0;
  json.bounds.forEach(end => { segs.push(json.lines.slice(start, end)); start = end; });
  const units = []; let si = 0;
  json.lines.forEach((l, i) => {
    if(i >= json.bounds[si]) si++;
    units.push({t:l, seg:si});
  });
  return {key, name:json.name, segs, units, segCount:segs.length, drills:json.drills, lines:json.lines};
}

/* ══════════ 儲存層（localStorage，失敗退回記憶體） ══════════ */
const memStore = {};
let LS = null;
try{ const t="__t"; localStorage.setItem(t,t); localStorage.removeItem(t); LS = localStorage; }catch(e){ LS = null; }
const store = {
  get(k){
    if(LS){ try{ const v = LS.getItem(k); if(v != null) return JSON.parse(v); }catch(e){} }
    return memStore[k] ?? null;
  },
  set(k, v){
    memStore[k] = v;
    if(LS){ try{ LS.setItem(k, JSON.stringify(v)); }catch(e){} }
  }
};
const PKEY = "chisong-v1";
let PROG = store.get(PKEY) || {};   // {id:[interval,dueDay]}
const today = () => Math.floor(Date.now() / 864e5);
let saveTimer = null;
function saveProg(){ clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set(PKEY, PROG), 400); }

/* SRS 排程 */
function grade(id, g){
  const rec = PROG[id] || [0, 0]; let iv = rec[0];
  if(g === "again"){ PROG[id] = [0, today()]; }
  else if(g === "hard"){ iv = Math.max(1, Math.ceil(iv * 1.3)); PROG[id] = [iv, today() + iv]; }
  else { iv = iv === 0 ? 1 : iv === 1 ? 3 : Math.ceil(iv * 2.4); PROG[id] = [iv, today() + iv]; }
  saveProg();
}
const isDue = id => PROG[id] && PROG[id][1] <= today();
const isNew = id => !PROG[id];

/* ══════════ 狀態 ══════════ */
let cur = "vajra";
let curView = "read";
let boundaryOnly = false;
let readFont = 22;
const queues = {};   // per sutra+mode session queue

function esc(s){ return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

/* ══════════ 誦讀 ══════════ */
function renderRead(){
  const el = document.getElementById("readText");
  if(!dataReady[cur]){ el.textContent = "載入中⋯"; return; }
  const s = SUTRAS[cur];
  el.style.fontSize = readFont + "px";
  let html = "";
  s.segs.forEach((seg, i) => {
    if(i > 0) html += '<span class="segbreak"></span>';
    if(cur === "dabei") html += '<span class="segno">' + "一二三四"[i] + '</span>';
    html += (cur === "vajra") ? esc(seg.join("")) : esc(seg.join("。") + "。");
  });
  el.innerHTML = html;
  document.querySelector("#view-read .vscroll").scrollLeft = 999999;
}

/* ══════════ 題目佇列 ══════════ */
const NEW_LIMIT = {recall:3, seam:8, drill:8};
function itemsFor(mode){
  const s = SUTRAS[cur];
  if(mode === "recall") return s.segs.map((_, i) => ({id:`${cur}-x-${i}`, seg:i}));
  if(mode === "seam"){
    const arr = [];
    for(let i = 0; i < s.units.length - 1; i++){
      const b = s.units[i].seg !== s.units[i+1].seg;
      if(boundaryOnly && !b) continue;
      arr.push({id:`${cur}-j-${i}`, i, boundary:b});
    }
    return arr;
  }
  return s.drills.map((d, k) => ({id:`${cur}-d-${k}`, d}));
}
function buildQueue(mode){
  const all = itemsFor(mode);
  const due = all.filter(x => isDue(x.id));
  const news = all.filter(x => isNew(x.id)).slice(0, NEW_LIMIT[mode]);
  shuffle(due);
  return due.concat(news);
}
function shuffle(a){ for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
function qkey(mode){ return cur + "-" + mode + (mode === "seam" ? (boundaryOnly ? "-b" : "-a") : ""); }
function getQueue(mode, rebuild){
  const k = qkey(mode);
  if(rebuild || !queues[k]) queues[k] = buildQueue(mode);
  return queues[k];
}

function loadingHTML(){ return '<div class="done"><div class="big">載 入 中</div></div>'; }

/* ══════════ 提取 ══════════ */
function renderRecall(){
  const box = document.getElementById("recallCard");
  if(!dataReady[cur]){ box.innerHTML = loadingHTML(); return; }
  const q = getQueue("recall");
  if(!q.length){ box.innerHTML = doneHTML(); bindDone(box, "recall"); return; }
  const item = q[0], s = SUTRAS[cur];
  const segText = cur === "vajra" ? s.segs[item.seg].join("") : s.segs[item.seg].join("。") + "。";
  const cue = item.seg === 0 ? "（全經開頭）" : lastUnitOfSeg(item.seg - 1);
  const first = segText[0];
  box.innerHTML = `
    <div class="meta"><span>第 ${item.seg+1} 段 / 共 ${s.segCount} 段</span><span>剩 ${q.length} 題</span></div>
    <div class="cuelabel">前　段　末　句</div>
    <div class="cuewrap"><div class="cue">${esc(cue)}</div></div>
    <div class="answrap" id="ansWrap">
      <div class="ansmask">
        <div>心 中 默 背 此 段</div>
        <button class="chipbtn" id="hintBtn">提示首字</button>
        <div class="hintchar" id="hintChar" hidden>${esc(first)}</div>
      </div>
      <div class="ansreveal"><div class="vscroll"><div class="vtext" style="font-size:20px">${esc(segText)}</div></div></div>
    </div>
    <div class="actions" id="flipRow"><button class="flipbtn">翻 開 對 照</button></div>
    <div class="actions gradebar" id="gradeRow" style="display:none">
      <button class="g-again">忘了</button><button class="g-hard">模糊</button><button class="g-good">記得</button>
    </div>`;
  wireCard(box, "recall", item);
}
function lastUnitOfSeg(si){
  const s = SUTRAS[cur];
  const us = s.segs[si];
  if(cur === "vajra") return us[us.length-1];
  return us[us.length-1] + "。";
}

/* ══════════ 接縫 ══════════ */
function renderSeam(){
  const box = document.getElementById("seamCard");
  const info = document.getElementById("seamInfo");
  if(!dataReady[cur]){ box.innerHTML = loadingHTML(); info.textContent = ""; return; }
  const q = getQueue("seam");
  const s = SUTRAS[cur];
  info.textContent = boundaryOnly ? `段界接縫共 ${itemsFor("seam").length} 處` : "";
  if(!q.length){ box.innerHTML = doneHTML(); bindDone(box, "seam"); return; }
  const item = q[0];
  const i = item.i;
  const prev2 = i > 0 ? s.units[i-1].t : "";
  const cueTxt = (cur === "dabei")
    ? (prev2 ? prev2 + "。" : "") + s.units[i].t + "。"
    : prev2 + s.units[i].t;
  const ansTxt = cur === "dabei" ? s.units[i+1].t + "。" : s.units[i+1].t;
  box.innerHTML = `
    <div class="meta">
      <span>第 ${s.units[i].seg+1} 段 ${item.boundary ? '<span class="tag">段界</span>' : ""}</span>
      <span>剩 ${q.length} 題</span>
    </div>
    <div class="cuelabel">前　句</div>
    <div class="cuewrap"><div class="cue">${esc(cueTxt)}</div></div>
    <div class="answrap" id="ansWrap">
      <div class="ansmask"><div>下 一 句 是 什 麼</div>
        <button class="chipbtn" id="hintBtn">提示首字</button>
        <div class="hintchar" id="hintChar" hidden>${esc(ansTxt[0])}</div>
      </div>
      <div class="ansreveal"><div class="vscroll"><div class="vtext" style="font-size:22px">${esc(ansTxt)}</div></div></div>
    </div>
    <div class="actions" id="flipRow"><button class="flipbtn">翻 開 對 照</button></div>
    <div class="actions gradebar" id="gradeRow" style="display:none">
      <button class="g-again">忘了</button><button class="g-hard">模糊</button><button class="g-good">記得</button>
    </div>`;
  wireCard(box, "seam", item);
}

/* 共用：翻卡＋評分 */
function wireCard(box, mode, item){
  const wrap = box.querySelector("#ansWrap");
  const hintBtn = box.querySelector("#hintBtn");
  if(hintBtn) hintBtn.onclick = () => { box.querySelector("#hintChar").hidden = false; hintBtn.hidden = true; };
  box.querySelector(".flipbtn").onclick = () => {
    wrap.classList.add("showing");
    box.querySelector("#flipRow").style.display = "none";
    box.querySelector("#gradeRow").style.display = "flex";
  };
  const q = getQueue(mode);
  const advance = (g) => {
    grade(item.id, g);
    q.shift();
    if(g === "again") q.push(item);   /* 忘了的題目排回本場尾端 */
    render(mode);
  };
  box.querySelector(".g-again").onclick = () => advance("again");
  box.querySelector(".g-hard").onclick = () => advance("hard");
  box.querySelector(".g-good").onclick = () => advance("good");
}

/* ══════════ 辨異（大悲咒） ══════════ */
function renderDrill(){
  const box = document.getElementById("drillCard");
  if(cur !== "dabei"){ box.innerHTML = '<div class="done">辨異模式僅供大悲咒</div>'; return; }
  if(!dataReady[cur]){ box.innerHTML = loadingHTML(); return; }
  const q = getQueue("drill");
  if(!q.length){ box.innerHTML = doneHTML(); bindDone(box, "drill"); return; }
  const item = q[0], d = item.d, L = SUTRAS.dabei.lines;
  const cueTxt = d.cue.map(i => L[i]).join("。") + "。";
  const opts = [d.ans, ...d.dis].map(i => ({i, t:L[i]}));
  shuffle(opts);
  box.innerHTML = `
    <div class="meta"><span>相似句辨異</span><span>剩 ${q.length} 題</span></div>
    <div class="cuelabel">前　句</div>
    <div class="cuewrap"><div class="cue">${esc(cueTxt)}</div></div>
    <div class="cuelabel" style="text-align:center;padding-top:14px">下一句是？</div>
    <div class="opts">${opts.map(o => `<button class="opt" data-i="${o.i}">${esc(o.t)}</button>`).join("")}</div>
    <div class="actions" id="nextRow" style="display:none"><button class="flipbtn">下 一 題</button></div>`;
  box.querySelectorAll(".opt").forEach(btn => {
    btn.onclick = () => {
      const pick = +btn.dataset.i;
      const right = pick === d.ans;
      box.querySelectorAll(".opt").forEach(b => {
        b.disabled = true;
        if(+b.dataset.i === d.ans) b.classList.add("right");
        else if(b === btn && !right) b.classList.add("wrong");
      });
      grade(item.id, right ? "good" : "again");
      q.shift();
      if(!right) q.push(item);
      box.querySelector("#nextRow").style.display = "flex";
      box.querySelector("#nextRow .flipbtn").onclick = () => render("drill");
    };
  });
}

/* ══════════ 完成畫面 ══════════ */
function doneHTML(){
  return `<div class="done">
    <div class="big">今 日 完 成</div>
    <div>熟的已排到之後複習</div>
    <button class="chipbtn" data-extra="1">加 練 五 題</button>
  </div>`;
}
function bindDone(box, mode){
  const b = box.querySelector("[data-extra]");
  if(!b) return;
  b.onclick = () => {
    const seen = itemsFor(mode).filter(x => PROG[x.id]);
    shuffle(seen);
    const k = qkey(mode);
    queues[k] = seen.slice(0, 5);
    if(!queues[k].length){ b.textContent = "尚無已練題目"; return; }
    render(mode);
  };
}

/* ══════════ 進度 ══════════ */
function renderStats(){
  const box = document.getElementById("statsBox");
  if(!dataReady[cur]){ box.innerHTML = loadingHTML(); return; }
  const s = SUTRAS[cur];
  const modes = [["recall", "提取（段）"], ["seam", "接縫（句）"]];
  if(cur === "dabei") modes.push(["drill", "辨異"]);
  let html = "";
  const savedBoundary = boundaryOnly; boundaryOnly = false;
  for(const [m, label] of modes){
    const all = itemsFor(m);
    const seen = all.filter(x => PROG[x.id]).length;
    const due = all.filter(x => isDue(x.id)).length;
    html += `<div class="statrow"><span class="k">${label}</span><span class="v">${seen} / ${all.length}<span style="color:var(--zhu);font-size:14px">　待複習 ${due}</span></span></div>`;
  }
  boundaryOnly = savedBoundary;
  html += `<div class="notice">進度依「忘了／模糊／記得」自動排程：熟的間隔拉長，生的密集重考。每天打開先清「待複習」，再吃少量新題。</div>`;
  html += `<button class="danger" id="resetBtn">清除本經全部進度</button>`;
  box.innerHTML = html;
  document.getElementById("resetBtn").onclick = () => {
    if(!confirm(`確定清除「${s.name}」的練習進度？此動作無法復原。`)) return;
    for(const id of Object.keys(PROG)) if(id.startsWith(cur + "-")) delete PROG[id];
    saveProg();
    Object.keys(queues).forEach(k => { if(k.startsWith(cur + "-")) delete queues[k]; });
    renderStats();
  };
}

/* ══════════ 導覽 ══════════ */
function render(view){
  curView = view;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("on"));
  document.getElementById("view-" + view).classList.add("on");
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("on", b.dataset.v === view));
  if(view === "read") renderRead();
  else if(view === "recall") renderRecall();
  else if(view === "seam") renderSeam();
  else if(view === "drill") renderDrill();
  else renderStats();
}

function switchSutra(k){
  cur = k;
  document.getElementById("sw-vajra").classList.toggle("on", k === "vajra");
  document.getElementById("sw-dabei").classList.toggle("on", k === "dabei");
  document.getElementById("navDrill").hidden = (k === "vajra");
  if(k === "vajra" && curView === "drill") curView = "seam";
  render(curView);
}

document.querySelectorAll("nav button").forEach(b => b.onclick = () => render(b.dataset.v));
document.getElementById("sw-vajra").onclick = () => switchSutra("vajra");
document.getElementById("sw-dabei").onclick = () => switchSutra("dabei");
document.getElementById("boundaryOnly").onclick = function(){
  boundaryOnly = !boundaryOnly;
  this.classList.toggle("on", boundaryOnly);
  render("seam");
};
document.getElementById("fontUp").onclick = () => { readFont = Math.min(30, readFont + 2); renderRead(); };
document.getElementById("fontDown").onclick = () => { readFont = Math.max(16, readFont - 2); renderRead(); };

/* ══════════ 啟動：兩份經文平行載入，金剛經到了立刻先畫 ══════════ */
fetchSutra("vajra")
  .then(() => { if(cur === "vajra") render(curView); })
  .catch(() => {
    document.getElementById("readText").textContent =
      "經文載入失敗。若是直接雙擊開啟本檔（file://），瀏覽器會擋 fetch；請部署到 GitHub Pages 或本機起個 http 伺服器。";
  });
fetchSutra("dabei")
  .then(() => { if(cur === "dabei") render(curView); })
  .catch(() => {});
