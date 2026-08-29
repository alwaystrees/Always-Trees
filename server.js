"use strict";

const path = require("path");
const express = require("express");
const compression = require("compression");
const cookieParser = require("cookie-parser");

const config = require("./src/config");
const { connect, close } = require("./src/db");
const auth = require("./src/lib/auth");
const pages = require("./src/lib/pages");

const apiRoutes = require("./src/routes/api");
const imageRoutes = require("./src/routes/images");
const backupRoutes = require("./src/routes/backup");
const adminState = require("./src/routes/adminstate");
const inject = require("./src/lib/inject");

const app = express();
app.set("trust proxy", 1);          // Render อยู่หลัง proxy จึงต้องเปิดเพื่อให้ req.ip ถูก
app.disable("x-powered-by");

app.use(compression());
app.use(cookieParser());
app.use(auth.markAdmin);

/* ---------- หัวข้อความปลอดภัยพื้นฐาน ---------- */
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-Frame-Options", "SAMEORIGIN");
  // ตอนยังอยู่บน .onrender.com บอก Google อย่าเพิ่งเก็บข้อมูล
  // พอขึ้นโดเมนจริงแล้วตั้ง NOINDEX=false ที่ Render → Environment
  if (config.noindex) res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

/* ---------- API ---------- */
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiRoutes);
app.use("/", imageRoutes);          // /img/:id และ /api/files
app.use("/", backupRoutes);         // /api/admin/backup/* และ /api/cron/*
app.use("/", adminState.router);    // /api/admin/state

/* ---------- หน้าหลังบ้าน ต้องล็อกอินก่อน ----------
   หน้าหลักฝังข้อมูลสดจากฐานข้อมูลลงใน <script id="app-data"> ก่อนส่ง
   โค้ด loadDB ในหลังบ้านจึงทำงานได้เหมือนเดิมโดยไม่ต้องแก้ */
app.get("/admin/login.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public/admin/login.html")));

app.get(["/admin", "/admin/", "/admin/index.html"], auth.requireAdmin,
  async (req, res, next) => {
    try {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "no-store");
      res.send(await inject.adminPage());
    } catch (e) { next(e); }
  });

app.use("/admin", auth.requireAdmin,
  express.static(path.join(__dirname, "public/admin"), { index: false }));

/* ---------- เว็บสาธารณะ ----------
   หน้า HTML ผ่านตัวแทนค่าตัวแปรก่อน เพื่อให้โดเมนมาจาก BASE_URL ตัวเดียว */
app.use(pages.pageMiddleware({
  "/": "index.html",
  "/index.html": "index.html",
  "/tool": "tool/index.html",
  "/tool/": "tool/index.html",
  "/tool/index.html": "tool/index.html",
}));

/* แคตตาล็อกฝังพันธุ์ไม้สดจากฐานข้อมูลลงใน <script id="plantdata"> ก่อนส่ง
   แก้ที่หลังบ้าน → กดบันทึก → รีเฟรชหน้านี้แล้วเห็นผลทันที ไม่ต้องส่งออก/วางทับอีก */
app.get(["/catalog", "/catalog/", "/catalog/index.html"], async (req, res, next) => {
  try {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=0, must-revalidate");
    res.send(await inject.catalogPage());
  } catch (e) { next(e); }
});

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (/\.(webp|jpg|jpeg|png|svg|ico|woff2?)$/i.test(filePath)) {
      res.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (filePath.endsWith(".html")) {
      res.set("Cache-Control", "public, max-age=0, must-revalidate");
    }
  },
}));

/* robots.txt สร้างสด เพื่อให้สลับตาม NOINDEX ได้โดยไม่ต้องแก้ไฟล์ */
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain");
  if (config.noindex) return res.send("User-agent: *\nDisallow: /\n");
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
});

app.get("/sitemap.xml", (_req, res) => {
  const urls = ["/", "/tool/", "/catalog/"];
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${config.baseUrl}${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`
  );
});

/* ---------- 404 และตัวจับข้อผิดพลาด ---------- */
app.use((req, res) => {
  if (/^\/api\//.test(req.originalUrl || req.url || "")) return res.status(404).json({ error: "ไม่พบ endpoint นี้" });
  res.status(404).sendFile(path.join(__dirname, "public/404.html"));
});

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error("[error]", err);
  if (res.headersSent) return;
  if (/^\/(api|img)\//.test(req.originalUrl || req.url || "")) {
    return res.status(status).json({ error: err.message || "เกิดข้อผิดพลาดในระบบ" });
  }
  res.status(status).send("เกิดข้อผิดพลาดในระบบ");
});

/* ---------- เริ่มทำงาน ---------- */
(async () => {
  try {
    await connect();
    const server = app.listen(config.port, () => {
      console.log(`[web] Always Trees ทำงานที่พอร์ต ${config.port}`);
      console.log(`[web] BASE_URL = ${config.baseUrl}`);
      console.log(`[web] ${config.noindex ? "ตั้ง noindex ไว้ (ยังไม่ให้ Google เก็บข้อมูล)" : "เปิดให้ Google เก็บข้อมูลแล้ว"}`);
    });
    const shutdown = async (sig) => {
      console.log(`[web] ปิดระบบ (${sig})`);
      server.close(async () => { await close(); process.exit(0); });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (e) {
    console.error("[web] เริ่มระบบไม่สำเร็จ:", e);
    process.exit(1);
  }
})();
