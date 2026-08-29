"use strict";

/* ------------------------------------------------------------------
   เสิร์ฟไฟล์ HTML โดยแทนค่าตัวแปรก่อนส่ง
   ทำให้โดเมนในหน้าเว็บ (canonical, og:url, og:image) มาจาก BASE_URL
   ตัวเดียวใน environment — วันย้ายโดเมนไม่ต้องแก้ไฟล์ HTML เลย

   อ่านจากดิสก์ครั้งเดียวแล้วเก็บไว้ในหน่วยความจำ (ยกเว้นตอน dev)
-------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
const config = require("./../config");

const ROOT = path.join(__dirname, "..", "..", "public");
const cache = new Map();

function tokens() {
  return {
    "{{BASE_URL}}": config.baseUrl,
    "{{ROBOTS}}": config.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    "{{PHONE}}": config.company.phone,
    "{{EMAIL}}": config.company.email,
    "{{MESSENGER}}": config.company.messenger,
    "{{FACEBOOK}}": config.company.facebook,
    "{{YEAR}}": String(new Date().getFullYear()),
  };
}

function render(relPath) {
  const key = relPath;
  if (config.env === "production" && cache.has(key)) return cache.get(key);

  const file = path.join(ROOT, relPath);
  if (!file.startsWith(ROOT)) throw new Error("เส้นทางไฟล์ไม่ถูกต้อง");
  let html = fs.readFileSync(file, "utf8");
  for (const [k, v] of Object.entries(tokens())) html = html.split(k).join(v);

  // ตอนอยู่บน .onrender.com ยัด meta noindex เข้าไปให้ด้วย
  if (config.noindex && !/name="robots"/i.test(html)) {
    html = html.replace(/<\/head>/i, '  <meta name="robots" content="noindex, nofollow">\n</head>');
  }
  cache.set(key, html);
  return html;
}

/** middleware: ถ้าเป็นคำขอหน้า HTML ที่เรารู้จัก ให้เสิร์ฟแบบแทนค่าตัวแปร */
function pageMiddleware(map) {
  return (req, res, next) => {
    const rel = map[req.path];
    if (!rel) return next();
    try {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "public, max-age=0, must-revalidate");
      res.send(render(rel));
    } catch (e) { next(e); }
  };
}

module.exports = { render, pageMiddleware, ROOT };
