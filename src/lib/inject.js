"use strict";

/* ------------------------------------------------------------------
   ฝังข้อมูลสดลงในหน้า HTML ก่อนส่งออกไป

   ทั้งหลังบ้านและแคตตาล็อกเดิมอ่านข้อมูลจากบล็อก JSON ในหน้าตัวเอง
   เราจึงไม่ต้องแก้โค้ดฝั่งหน้าเว็บเลย แค่เปลี่ยนเนื้อในบล็อกนั้น
   ให้เป็นข้อมูลจากฐานข้อมูลตอนเสิร์ฟ

     หลังบ้าน   <script id="app-data" …>{…}</script>
     แคตตาล็อก  <!--ATC_DATA_BEGIN--><script id="plantdata" …>{…}</script><!--ATC_DATA_END-->
-------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
const config = require("../config");
const { col, COLLECTIONS } = require("../db");
const { readState } = require("../routes/adminstate");

const ROOT = path.join(__dirname, "..", "..", "public");
const cache = new Map();

function readFile(rel) {
  if (config.env === "production" && cache.has(rel)) return cache.get(rel);
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  cache.set(rel, html);
  return html;
}

/* JSON ที่ปลอดภัยสำหรับวางในแท็ก <script> */
const safeJSON = (v) =>
  JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/* ยามเฝ้าเซสชัน — ต่อท้ายหน้าหลังบ้านตอนเสิร์ฟ ไม่ได้แก้ไฟล์ต้นฉบับ
   หน้าที่: รู้ตัวว่าหมดเวลาแล้วเด้งไปหน้าล็อกอินเอง ไม่ใช่ค้างอยู่เฉย ๆ
   และมีปุ่มล็อกไว้กดเองตอนลุกจากโต๊ะ */
const SESSION_GUARD = `
<style>
#at-lock{position:fixed;right:14px;bottom:14px;z-index:99999;border:none;cursor:pointer;
  font:500 13px/1 "Prompt","Noto Sans Thai",system-ui,sans-serif;padding:10px 16px;border-radius:999px;
  background:#12211A;color:#fff;box-shadow:0 8px 20px -8px rgba(0,0,0,.55);opacity:.55;transition:opacity .2s}
#at-lock:hover{opacity:1}
/* ตอนเปิดหน้าต่างซ้อน ปุ่มนี้จะไปทับปุ่ม "บันทึก" มุมขวาล่าง จึงต้องซ่อน */
body.has-modal #at-lock{display:none}
#at-warn{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99999;display:none;
  font:500 14px/1.5 "Prompt","Noto Sans Thai",system-ui,sans-serif;padding:12px 20px;border-radius:14px;
  background:#B3452A;color:#fff;box-shadow:0 10px 26px -10px rgba(0,0,0,.6)}
</style>
<button id="at-lock" type="button" title="ออกจากระบบทันที">ล็อกหน้าจอ</button>
<div id="at-warn" role="alert"></div>
<script>
(function(){
  var warn=document.getElementById('at-warn'),btn=document.getElementById('at-lock'),dead=false;
  function bye(){ if(dead) return; dead=true; location.replace('/admin/login.html?timeout=1'); }
  btn.addEventListener('click',function(){
    fetch('/api/logout',{method:'POST'}).catch(function(){}).then(function(){
      location.replace('/admin/login.html');
    });
  });
  async function check(){
    try{
      var r=await fetch('/api/me',{cache:'no-store'});
      var d=await r.json();
      if(!d.admin) return bye();
      if(d.expiresIn<=120){
        warn.style.display='block';
        warn.textContent='อีก '+Math.max(0,Math.round(d.expiresIn))+' วินาทีจะหมดเวลาใช้งาน — บันทึกงานก่อน';
      }else{ warn.style.display='none'; }
    }catch(e){ /* เน็ตหลุดชั่วคราว ไม่ต้องเตะออก */ }
  }
  setInterval(check,45000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) check(); });
  window.addEventListener('focus',check);
  check();
})();
<\/script>
`;

/* ---------- หน้าหลังบ้าน ---------- */
async function adminPage() {
  const html = readFile("admin/index.html");
  const db = (await readState()) || {};
  const re = /(<script id="app-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
  if (!re.test(html)) throw new Error("ไม่พบบล็อก app-data ในหน้าหลังบ้าน");
  const out = html.replace(re, (_m, a, _old, c) => a + safeJSON(db) + c);
  /* ต่อท้ายไฟล์ตรง ๆ ห้ามไปแทรกที่ </body>
     เพราะในหน้าหลังบ้านมี "</body>" อยู่ในสตริงของเทมเพลตพิมพ์เอกสาร
     ถ้าไปแทนตรงนั้นจะทำให้โค้ดทั้งก้อนพัง และตัวไฟล์เองก็ไม่มี </body> จริง */
  return out + SESSION_GUARD;
}

/* ---------- หน้าแคตตาล็อก ---------- */
async function catalogPage() {
  let html = readFile("catalog/index.html");

  const items = await col(COLLECTIONS.plants)
    .find({ published: { $ne: false } }, { projection: { _id: 0, createdAt: 0, updatedAt: 0, published: 0 } })
    .sort({ cat: 1, code: 1 })
    .toArray();

  const payload = {
    version: 2,
    updated: new Date().toISOString().slice(0, 10),
    source: "always-trees-admin",
    items,
  };

  const re = /(<script id="plantdata" type="application\/json">)([\s\S]*?)(<\/script>)/;
  if (!re.test(html)) throw new Error("ไม่พบบล็อก plantdata ในหน้าแคตตาล็อก");
  html = html.replace(re, (_m, a, _old, c) => a + safeJSON(payload) + c);

  // ตอนอยู่บน .onrender.com ยังไม่ให้ Google เก็บข้อมูล
  if (config.noindex && !/name="robots"/i.test(html)) {
    html = html.replace(/<\/head>/i, '  <meta name="robots" content="noindex, nofollow">\n</head>');
  }
  return html;
}

module.exports = { adminPage, catalogPage };
