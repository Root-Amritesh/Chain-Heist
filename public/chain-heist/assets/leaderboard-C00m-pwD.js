const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./storage-mJ6fXDOC.js","./storage-CrnTR1Zj.css"])))=>i.map(i=>d[i]);
import{o as y,f as d,_ as v}from"./storage-mJ6fXDOC.js";/* empty css             */const c=document.getElementById("lb-list"),r=document.getElementById("activity-feed");function n(e){if(!e||e.length===0){c.innerHTML='<div class="lb-empty"><div class="lb-empty-icon">🔓</div>No heists yet — be the first to rewrite history.</div>';return}c.innerHTML=e.slice(0,20).map((o,t)=>{const l=t===0?"top-1":t===1?"top-2":t===2?"top-3":"",s=t===0?"👑":t===1?"🥈":t===2?"🥉":`#${t+1}`,p=(o.runHash||"").slice(0,16)+"...";return`
          <div class="lb-entry ${l}" style="animation-delay: ${t*.05}s">
            <div class="lb-rank">${s}</div>
            <div class="lb-info">
              <div class="lb-name">${b(o.name||"ANON")}</div>
              <div class="lb-meta">
                <span>Combo: ${o.combo||0}x</span>
                <span>Blocks: ${o.blocks||0}</span>
                <span>L${o.level||1}</span>
              </div>
              <div class="lb-hash">${p}</div>
            </div>
            <div class="lb-score">${(o.score||0).toLocaleString()}</div>
          </div>
        `}).join("")}function b(e){const o=document.createElement("div");return o.textContent=e,o.innerHTML}function i(e){const o=document.createElement("div");o.className="whale-alert",o.textContent=`🐋 NEW #1 — ${e.name} with ${e.score.toLocaleString()} pts!`,document.body.appendChild(o),setTimeout(()=>o.remove(),5e3)}function a(e){const o=document.createElement("div");o.className="activity-item",o.textContent=e,r.prepend(o),r.children.length>8&&r.lastChild.remove(),setTimeout(()=>o.remove(),8e3)}y(e=>{e.type==="leaderboard:update"&&e.payload&&(n(e.payload.leaderboard),e.payload.newEntry&&a(`⛏️ ${e.payload.newEntry.name} scored ${e.payload.newEntry.score.toLocaleString()}`)),e.type==="whale:alert"&&e.payload&&e.payload.entry&&i(e.payload.entry),e.type==="player:progress"&&e.payload&&a(`🎮 ${e.payload.name} started L${e.payload.level}`),e.type==="block:mined"&&e.payload&&a(`🔨 ${e.payload.name} mined block ${e.payload.block} (${e.payload.progress}/${e.payload.total})`)});async function m(){try{const{getSocket:e}=await v(async()=>{const{getSocket:t}=await import("./storage-mJ6fXDOC.js").then(l=>l.a);return{getSocket:t}},__vite__mapDeps([0,1]),import.meta.url),o=await e();if(!o)return;o.on("leaderboard:update",t=>{n(t.leaderboard),t.newEntry&&a(`⛏️ ${t.newEntry.name} scored ${t.newEntry.score.toLocaleString()}`)}),o.on("whale:alert",t=>{t.entry&&i(t.entry)}),o.on("player:progress",t=>{a(`🎮 ${t.name} started L${t.level}`)}),o.on("block:mined",t=>{a(`🔨 ${t.name} mined block ${t.block} (${t.progress}/${t.total})`)})}catch{}}d().then(n);m();setInterval(()=>{d().then(n)},15e3);
