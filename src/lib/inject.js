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

/* ---------- หน้าหลังบ้าน ---------- */
async function adminPage() {
  const html = readFile("admin/index.html");
  const db = (await readState()) || {};
  const re = /(<script id="app-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
  if (!re.test(html)) throw new Error("ไม่พบบล็อก app-data ในหน้าหลังบ้าน");
  return html.replace(re, (_m, a, _old, c) => a + safeJSON(db) + c);
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
