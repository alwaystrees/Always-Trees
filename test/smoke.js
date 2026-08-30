"use strict";
/* ทดสอบว่าระบบทำงานครบเส้นทางหลัก โดยใช้ฐานข้อมูลจำลอง
   รัน:  node test/smoke.js                                   */

const path = require("path");
const bcrypt = require("bcryptjs");

process.env.NODE_ENV = "test";
process.env.PORT = "4321";
process.env.MONGODB_URI = "mongodb://mock";
process.env.BASE_URL = "https://alwaystrees.onrender.com";
process.env.NOINDEX = "true";
process.env.JWT_SECRET = "test-secret-test-secret";
process.env.CRON_TOKEN = "test-cron-token";
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("รหัสผ่านทดสอบ1234", 8);

/* เสียบฐานข้อมูลจำลองแทนของจริง ก่อนที่ server.js จะถูกโหลด */
const dbPath = require.resolve("../src/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: require("./mock-db") };

const BASE = "http://127.0.0.1:4321";
let pass = 0, fail = 0;
const results = [];

function check(name, ok, detail = "") {
  results.push(`${ok ? "  ผ่าน  " : "  ตก    "} ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
}

async function get(p, opts = {}) {
  const r = await fetch(BASE + p, { redirect: "manual", ...opts });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json().catch(() => ({}))
    : ct.includes("zip") ? Buffer.from(await r.arrayBuffer())
    : await r.text();
  return { status: r.status, body, headers: r.headers };
}

(async () => {
  require("../server");
  await new Promise((r) => setTimeout(r, 900));

  /* ---------- เว็บสาธารณะ ---------- */
  let r = await get("/");
  check("หน้าแรกเปิดได้", r.status === 200);
  check("แทนค่า BASE_URL ในหน้าแรกแล้ว",
    r.body.includes("https://alwaystrees.onrender.com") && !r.body.includes("{{BASE_URL}}"));
  check("ตั้ง noindex ตอนอยู่บน onrender.com", (r.headers.get("x-robots-tag") || "").includes("noindex"));

  r = await get("/tool/");
  check("หน้าเครื่องมือจัดสวนเปิดได้", r.status === 200 && !r.body.includes("{{BASE_URL}}"));

  r = await get("/catalog/");
  check("หน้าแคตตาล็อกเปิดได้", r.status === 200 && !r.body.includes("{{BASE_URL}}"));

  r = await get("/js/plant-art.js");
  check("ไฟล์วาดต้นไม้โหลดได้", r.status === 200 && r.body.includes("FORMS"));

  r = await get("/img/garden-front-after.webp");
  check("รูปนิ่งบนหน้าเว็บโหลดได้ ไม่ถูก /img/:id ดักไปก่อน",
    r.status === 200 && (r.headers.get("content-type") || "").includes("image"),
    `HTTP ${r.status} ${r.headers.get("content-type") || ""}`);
  r = await get("/img/ffffffffffffffffffffffff");
  check("รูปในฐานข้อมูลที่ไม่มีจริง ตอบ 404", r.status === 404);

  r = await get("/robots.txt");
  check("robots.txt ปิดการเก็บข้อมูลตอน noindex", r.body.includes("Disallow: /"));

  r = await get("/ไม่มีหน้านี้");
  check("หน้า 404 ทำงาน", r.status === 404);

  /* ---------- health ---------- */
  r = await get("/api/health");
  check("/api/health ตอบ ok และแตะฐานข้อมูล", r.status === 200 && r.body.ok === true && r.body.db === "up");

  /* ---------- กันคนนอกเข้าหลังบ้าน ---------- */
  r = await get("/admin/");
  check("คนไม่ได้ล็อกอินถูกส่งไปหน้าเข้าสู่ระบบ", r.status === 302 && r.headers.get("location").includes("login"));
  r = await get("/api/leads");
  check("API หลังบ้านตอบ 401 เมื่อยังไม่ล็อกอิน", r.status === 401);
  r = await get("/api/admin/backup/export");
  check("ดาวน์โหลดข้อมูลต้องล็อกอินก่อน", r.status === 401);

  /* ---------- ฟอร์มติดต่อ เปิดให้ส่งได้ ---------- */
  r = await get("/api/leads", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "", phone: "" }),
  });
  check("ปฏิเสธเมื่อกรอกไม่ครบ", r.status === 400);

  r = await get("/api/leads", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "คุณทดสอบ", phone: "088-892-6429", message: "อยากได้สวนหน้าบ้าน",
      source: "design-tool", planText: "ชั้นหลัง · อโศกอินเดีย × 4",
      planJson: { W: 8, items: [{ k: "asoke", x: 1, y: 1, h: 5.8 }] },
    }),
  });
  check("ส่งแบบจากเครื่องมือจัดสวนเข้าระบบได้", r.status === 201 && r.body.ok === true);

  r = await get("/api/leads", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "บอท", phone: "1", website: "spam" }),
  });
  check("กับดักบอททำงาน (ไม่บันทึกลงระบบ)", r.status === 200);

  /* ---------- เข้าสู่ระบบ ---------- */
  r = await get("/api/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "ผิดแน่นอน" }),
  });
  check("รหัสผ่านผิดเข้าไม่ได้", r.status === 401);

  const loginRes = await fetch(BASE + "/api/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "รหัสผ่านทดสอบ1234" }),
  });
  const rawCookie = (loginRes.headers.getSetCookie?.() || [])[0] || "";
  const cookie = rawCookie.split(";")[0] || "";
  check("รหัสผ่านถูกเข้าได้และได้คุกกี้", loginRes.status === 200 && cookie.startsWith("at_session="));
  check("คุกกี้เป็นแบบ session — ปิดเบราว์เซอร์แล้วหลุด", !/max-age|expires/i.test(rawCookie));
  check("คุกกี้อ่านจากสคริปต์ไม่ได้", /httponly/i.test(rawCookie));

  const auth = { headers: { cookie } };

  r = await get("/admin/", auth);
  check("เข้าหน้าหลังบ้านได้หลังล็อกอิน", r.status === 200 && r.body.includes("ออลเวย์ทรี แบ็คออฟฟิศ"));

  r = await get("/api/admin/summary", auth);
  check("หน้าภาพรวมดึงข้อมูลได้", r.status === 200 && typeof r.body.storage.percent === "number");
  check("นับลูกค้าใหม่ได้ถูก", r.body.leadsNew === 1, `ได้ ${r.body.leadsNew}`);

  r = await get("/api/leads?sort=-createdAt", auth);
  check("อ่านรายการลูกค้าได้", r.status === 200 && r.body.items.length === 1);
  check("เก็บแบบสวนที่ลูกค้าส่งมาด้วย", !!r.body.items[0].planText);
  const leadId = r.body.items[0].id;

  r = await get("/api/leads/" + leadId, {
    ...auth, method: "PUT",
    headers: { ...auth.headers, "content-type": "application/json" },
    body: JSON.stringify({ status: "ติดต่อแล้ว" }),
  });
  check("เปลี่ยนสถานะลูกค้าได้", r.status === 200 && r.body.status === "ติดต่อแล้ว");

  /* ---------- หลังบ้านจริง + สะพานเชื่อมแคตตาล็อก ---------- */
  const seed = require("../data/plants.json").items;
  check("ไฟล์พันธุ์ไม้ตั้งต้นมี 112 รายการ", seed.length === 112, `ได้ ${seed.length}`);
  check("ไม่มีคีย์ราคาในไฟล์พันธุ์ไม้",
    !seed.some((p) => Object.keys(p).some((k) => /price|cost|mat|lab|markup|ราคา|ทุน|กำไร/i.test(k))));

  /* หลังบ้านไม่ได้เก็บพันธุ์ไม้ในรูปแบบเดียวกับ plants.json
     มันเก็บ cat เป็นชื่อไทย · alt เป็น array · id จริงอยู่ใน srcId
     ทดสอบด้วยรูปแบบนั้น เพราะนั่นคือสิ่งที่ถูกส่งมาจริงตอนกดบันทึก */
  const TH = { sung: "ไม้ระดับสูง", rua: "ไม้ริมรั้ว", tam: "ไม้ระดับต่ำ", klum: "ไม้คลุมดิน", hin: "หิน" };
  const adminShaped = seed.map((p, i) => ({
    ...p,
    id: "adm_" + i,                       // id ภายในของหลังบ้าน ไม่ใช่ id ที่แคตตาล็อกใช้
    srcId: p.id,
    cat: TH[p.cat] || p.cat,
    alt: p.alt ? String(p.alt).split(",").map((s) => s.trim()) : [],
    mat: 999, mk: 40,                     // ราคาทุนปนมาด้วย ต้องถูกกรองทิ้ง
  }));

  const stateDB = {
    company: { name: "Always Trees Co., LTD" },
    plants: adminShaped,
    customers: [{
      id: "c1", name: "คุณทดสอบ",
      photos: [{ id: "p1", kind: "after", cap: "สวนหน้าบ้าน",
        // รูป WebP เล็ก ๆ ของจริง ใช้ทดสอบว่าเซิร์ฟเวอร์ดึงออกไปเก็บเป็นไฟล์
        src: "data:image/webp;base64," + Buffer.from(
          "RIFF$\u0000\u0000\u0000WEBPVP8 \u0018\u0000\u0000\u0000\u0010\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
          "binary").toString("base64") }],
    }],
    docs: [], items: [], jobs: [], contents: [],
  };

  r = await get("/api/admin/state", {
    ...auth, method: "PUT",
    headers: { ...auth.headers, "content-type": "application/json" },
    body: JSON.stringify(stateDB),
  });
  check("บันทึกสถานะหลังบ้านขึ้นเซิร์ฟเวอร์ได้", r.status === 200 && r.body.ok === true);
  check("คัดลอกพันธุ์ไม้ไปยังแคตตาล็อกครบ 112", r.body.plants?.synced === 112, `ได้ ${r.body.plants?.synced}`);
  check("ดึงรูป base64 ออกไปเก็บเป็นไฟล์แล้ว", r.body.movedImages === 1, `ย้าย ${r.body.movedImages} ใบ`);
  const photoSrc = r.body.db.customers[0].photos[0].src;
  check("แทน src ของรูปด้วย /img/<id> แล้ว", /^\/img\/[0-9a-f]{24}$/.test(photoSrc), photoSrc);

  r = await get(photoSrc);
  check("เปิดรูปจาก /img/<id> ได้", r.status === 200);

  r = await get("/api/admin/state", auth);
  check("อ่านสถานะหลังบ้านกลับมาได้", r.status === 200 && r.body.db.plants.length === 112);

  /* ---------- แคตตาล็อก ---------- */
  r = await get("/api/plants");
  check("คนทั่วไปอ่านแคตตาล็อกได้โดยไม่ต้องล็อกอิน", r.status === 200 && r.body.items.length === 112);
  check("ไม่มีคีย์ราคาหลุดออก API สาธารณะ",
    !r.body.items.some((p) => Object.keys(p).some((k) => /price|cost|\bmat\b|\blab\b|markup|ราคา|ทุน|กำไร/i.test(k))));
  const withW = r.body.items.filter((p) => p.w_m > 0).length;
  check("เติมทรงพุ่มจากเครื่องมือจัดสวนแล้ว", withW === 61, `${withW} จาก 112 รายการ`);

  /* หัวใจของบั๊ก "กดหมวดแล้วขึ้นทั้งหมด" และ "รหัสกับประเภทไม่สอดคล้อง" */
  const SLUGS = ["sung", "rua", "tam", "klum", "hin"];
  const badCat = r.body.items.filter((p) => SLUGS.indexOf(p.cat) < 0);
  check("หมวดถูกแปลงเป็นรหัสที่แคตตาล็อกกรองได้ ไม่ใช่ชื่อไทย",
    badCat.length === 0, badCat.length ? `ยังเป็นชื่อไทย ${badCat.length} รายการ` : "ครบทั้ง 112");
  const PRE = { sung: "TL", rua: "HG", tam: "SH", klum: "GC", hin: "ST" };
  const badCode = r.body.items.filter((p) => !String(p.code || "").startsWith(PRE[p.cat] + "-"));
  check("รหัสขึ้นต้นตรงกับหมวดทุกรายการ", badCode.length === 0,
    badCode.length ? badCode.slice(0, 3).map((p) => p.code + "/" + p.cat).join(" ") : "0 จาก 112 ที่ไม่ตรง");
  const byCat = {};
  r.body.items.forEach((p) => { byCat[p.cat] = (byCat[p.cat] || 0) + 1; });
  check("จำนวนในแต่ละหมวดตรงกับต้นฉบับ",
    byCat.sung === 31 && byCat.rua === 20 && byCat.tam === 30 && byCat.klum === 17 && byCat.hin === 14,
    JSON.stringify(byCat));
  check("id ที่ส่งถึงหน้าลูกค้าเป็น id เดิม ไม่ใช่ id ภายในของหลังบ้าน",
    r.body.items.every((p) => !String(p.id).startsWith("adm_")));
  check("alt ถูกแปลงกลับเป็นข้อความ ไม่ใช่ array",
    r.body.items.every((p) => p.alt === undefined || typeof p.alt === "string"));

  r = await get("/api/plants?q=ราชพฤกษ์");
  check("ค้นหาพันธุ์ไม้ได้", r.status === 200 && r.body.items.length >= 1);

  r = await get("/catalog/");
  check("หน้าแคตตาล็อกฝังข้อมูลสดจากฐานข้อมูล",
    r.status === 200 && r.body.includes('"source":"always-trees-admin"') && r.body.includes("ราชพฤกษ์"));
  check("ปิดโหมดแก้ไขในแคตตาล็อกแล้ว", r.body.includes('$("#editbtn").hidden = true;'));
  check("แคตตาล็อกแสดงรหัสพันธุ์ไม้", r.body.includes('class="pcode"') && r.body.includes("TL-001"));
  check("แคตตาล็อกมีกล่องข้อควรระวัง", r.body.includes("warnbox") && r.body.includes("ข้อควรระวังก่อนเลือกปลูก"));

  r = await get("/admin/", auth);
  check("หน้าหลังบ้านฝังข้อมูลสดจากฐานข้อมูล",
    r.status === 200 && r.body.includes("app-data") && r.body.includes("คุณทดสอบ"));
  check("หลังบ้านบันทึกผ่าน API แล้ว ไม่ใช่ republish artifact",
    r.body.includes("/api/admin/state") && !r.body.includes("await a.publish(buildDoc())"));

  /* ---------- ข้อมูลบริษัท ---------- */
  r = await get("/api/settings/company", {
    ...auth, method: "PUT",
    headers: { ...auth.headers, "content-type": "application/json" },
    body: JSON.stringify({ taxId: "0123456789012", address: "กรุงเทพฯ", lineOA: "@alwaystrees" }),
  });
  check("บันทึกข้อมูลบริษัทได้", r.status === 200);
  r = await get("/api/public/company");
  check("หน้าเว็บสาธารณะดึงข้อมูลบริษัทได้", r.status === 200 && r.body.taxId === "0123456789012");

  /* ---------- สำรองข้อมูล ---------- */
  r = await get("/api/admin/backup/status", auth);
  check("สถานะสำรองข้อมูลเตือนเมื่อยังไม่เคยดาวน์โหลด", r.status === 200 && r.body.warn === true);

  r = await get("/api/admin/backup/export", auth);
  const zipOk = r.status === 200 && Buffer.isBuffer(r.body)
    && r.body.slice(0, 2).toString() === "PK" && r.body.length > 300;
  check("ดาวน์โหลดข้อมูลทั้งหมดได้เป็นไฟล์ zip", zipOk, zipOk ? `${(r.body.length / 1024).toFixed(1)} KB` : "");

  const unzipper = require("unzipper");
  if (zipOk) {
    const dir = await unzipper.Open.buffer(r.body);
    const names = dir.files.map((f) => f.path);
    check("ในไฟล์สำรองมี manifest.json", names.includes("manifest.json"));
    check("ในไฟล์สำรองมีข้อมูลลูกค้า", names.includes("data/leads.json"));
    check("ในไฟล์สำรองมีข้อมูลแคตตาล็อก", names.includes("data/plants.json"));
    const leads = JSON.parse((await dir.files.find((f) => f.path === "data/leads.json").buffer()).toString());
    check("ข้อมูลในไฟล์สำรองครบถ้วน", leads.length === 1 && leads[0].name === "คุณทดสอบ");
  }

  r = await get("/api/admin/backup/status", auth);
  check("บันทึกวันที่ดาวน์โหลดล่าสุดแล้ว", r.body.lastBackupAt !== null && r.body.warn === false);

  /* ---------- cron ---------- */
  r = await get("/api/cron/backup-reminder", { method: "POST" });
  check("cron ต้องมีโทเคน", r.status === 401);
  r = await get("/api/cron/backup-reminder", { method: "POST", headers: { "x-cron-token": "test-cron-token" } });
  check("cron แจ้งเตือนทำงาน (ข้ามส่งอีเมลเพราะยังไม่ตั้ง BREVO_API_KEY)",
    r.status === 200 && r.body.sent === false);

  /* ---------- อายุเซสชัน ---------- */
  r = await get("/api/me", auth);
  check("บอกเวลาที่เหลือก่อนถามรหัสใหม่ได้",
    r.body.admin === true && r.body.expiresIn > 0 && r.body.expiresIn <= r.body.idleMinutes * 60,
    `เหลือ ${r.body.expiresIn} วิ จากเพดาน ${r.body.idleMinutes} นาที`);

  r = await get("/api/admin/state", { ...auth, method: "HEAD" });
  check("ตรวจว่าบันทึกถาวรพร้อมใช้ได้ (HEAD)", r.status === 200);
  r = await get("/api/admin/state", { method: "HEAD" });
  check("ยังไม่ล็อกอิน ตรวจแล้วต้องได้ 401", r.status === 401);

  {
    const jwt = require("jsonwebtoken");
    const stale = jwt.sign({ role: "admin", lif: Date.now() - 13 * 3600_000 },
      process.env.JWT_SECRET, { expiresIn: "30m" });
    const rr = await get("/api/admin/state", { headers: { cookie: "at_session=" + stale } });
    check("เกินเพดานรวม 12 ชม. ต้องล็อกอินใหม่ แม้โทเคนยังไม่หมดอายุ", rr.status === 401);
    const old = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "30m" });
    const ro = await get("/api/admin/state", { headers: { cookie: "at_session=" + old } });
    check("โทเคนรุ่นเก่าที่ไม่มีเวลาล็อกอิน ใช้ไม่ได้", ro.status === 401);
  }

  /* ---------- สุขภาพระบบ ---------- */
  r = await get("/api/health");
  check("/api/health ตอบ 200 เสมอ ตัวปลุกจึงไม่รายงานว่าล้มเหลว", r.status === 200 && r.body.ok === true);
  r = await get("/api/health/db");
  check("/api/health/db บอกสถานะฐานข้อมูลตามจริง", r.status === 200 && r.body.db === "up");

  /* ---------- ออกจากระบบ ---------- */
  r = await get("/api/logout", { ...auth, method: "POST" });
  check("ออกจากระบบได้", r.status === 200);

  /* ---------- สรุป ---------- */
  console.log("\n" + results.join("\n"));
  console.log(`\n  ผ่าน ${pass} · ตก ${fail}\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ทดสอบล้มเหลว:", e); process.exit(1); });
