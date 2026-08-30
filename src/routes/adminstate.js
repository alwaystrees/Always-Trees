"use strict";

/* ------------------------------------------------------------------
   สะพานเชื่อมหลังบ้านเข้ากับฐานข้อมูล

   หลังบ้าน (admin-always-trees.html) เก็บทุกอย่างไว้ใน object ชื่อ DB
   เดิมมันบันทึกด้วยการ republish ตัวเองทับ artifact ซึ่งมีเพดาน 16 MB
   ตอนนี้เปลี่ยนเป็น
     โหลด  →  เซิร์ฟเวอร์ฝัง DB ลงใน <script id="app-data"> ก่อนส่งหน้าออกไป
              (โค้ด loadDB เดิมไม่ต้องแก้แม้แต่บรรทัดเดียว)
     บันทึก →  PUT /api/admin/state

   สองอย่างที่เซิร์ฟเวอร์ทำให้ระหว่างบันทึก
   1. ดึงรูป base64 ที่ฝังอยู่ใน DB ออกไปเก็บใน collection files
      แล้วแทนที่ด้วย /img/<id> — เพดาน 16 MB จึงหมดไป
   2. คัดลอก DB.plants ไปไว้ใน collection plants
      เพื่อให้ /api/plants และหน้าแคตตาล็อกอ่านชุดเดียวกัน
      → หลังบ้านเป็นที่แก้ที่เดียว ตามกฎในเอกสารส่งมอบ
-------------------------------------------------------------------*/

const express = require("express");
const { col, COLLECTIONS, storageStats } = require("../db");
const { requireAdmin } = require("../lib/auth");
const storage = require("../lib/storage");

const router = express.Router();
const STATE_KEY = "adminState";

/* ---------- ดึงรูป base64 ออกจาก DB แล้วเก็บเป็นไฟล์ ---------- */
const DATA_URI = /^data:(image\/(?:webp|jpeg|png)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/;

async function extractImages(node, ctx) {
  if (Array.isArray(node)) {
    for (const v of node) await extractImages(v, ctx);
    return;
  }
  if (!node || typeof node !== "object") return;

  for (const [key, val] of Object.entries(node)) {
    if (typeof val === "string" && val.startsWith("data:")) {
      const m = DATA_URI.exec(val);
      if (!m) continue;
      const buffer = Buffer.from(m[2], "base64");
      if (buffer.length > 12 * 1024 * 1024) continue;   // ใหญ่ผิดปกติ ปล่อยไว้ก่อน
      const saved = await storage.put({
        buffer,
        mime: m[1],
        meta: {
          kind: key === "src" ? "gallery" : key,
          alt: node.cap || node.name || "",
          ref: node.id ? { type: "admin", id: String(node.id) } : null,
          takenAt: node.date ? new Date(node.date) : null,
        },
      });
      node[key] = `/img/${saved.id}`;
      ctx.moved += 1;
      ctx.bytes += buffer.length;
    } else if (val && typeof val === "object") {
      await extractImages(val, ctx);
    }
  }
}

/* ---------- คัดลอกพันธุ์ไม้ไปไว้ใน collection plants ----------
   ห้ามให้ราคาหลุดออกไปเด็ดขาด จึงกรองคีย์ต้องห้ามซ้ำอีกชั้นตรงนี้
   (ชั้นแรกอยู่ในตัวส่งออกของหลังบ้านเอง)                          */
const PRICE_KEY = /price|cost|mat|lab|markup|\bmk\b|ราคา|ทุน|กำไร/i;

/* หลังบ้านเก็บ cat เป็นชื่อไทย ("ไม้ระดับสูง") แต่แคตตาล็อกกรองด้วยรหัสสั้น
   ("sung") — ถ้าคัดลอกดิบ ๆ หน้าลูกค้าจะกรองตามหมวดไม่ได้ และป้ายหมวด
   จะไม่ตรงกับตัวนำหน้ารหัส TL/HG/SH/GC/ST
   ตรงนี้จึงแปลงให้เป็นรูปแบบเดียวกับ data/plants.json ก่อนเสมอ
   (ตรงกับฟังก์ชัน plantPublic ในหลังบ้าน) */
const CAT_SLUG = {
  "ไม้ระดับสูง": "sung",
  "ไม้ริมรั้ว": "rua",
  "ไม้ระดับต่ำ": "tam",
  "ไม้คลุมดิน": "klum",
  "หิน": "hin",
};
const SLUGS = new Set(Object.values(CAT_SLUG));
const CODE_PRE = { sung: "TL", rua: "HG", tam: "SH", klum: "GC", hin: "ST" };

function catSlug(v) {
  const s = String(v || "").trim();
  if (SLUGS.has(s)) return s;
  if (CAT_SLUG[s]) return CAT_SLUG[s];
  if (/สูง|ยืนต้น|ปาล์ม/.test(s)) return "sung";
  if (/รั้ว|พุ่มสูง|ไผ่|เลื้อย/.test(s)) return "rua";
  if (/คลุมดิน|หญ้า/.test(s)) return "klum";
  if (/หิน|กรวด|ทราย|วัสดุ/.test(s)) return "hin";
  return "tam";
}

const PUBLIC_FIELDS = ["id", "code", "cat", "name", "alt", "sci", "form", "size", "layer",
  "height_m", "w_m", "r_m", "light", "water", "care", "care_note", "colors", "scent",
  "bloom", "warnings", "flood_ok", "tags", "note", "img"];

function publicPlant(raw) {
  const p = raw || {};
  const out = {};
  for (const k of PUBLIC_FIELDS) {
    if (PRICE_KEY.test(k)) continue;
    let v = p[k];
    if (k === "id") { out.id = p.srcId || p.id; continue; }
    if (k === "cat") { out.cat = catSlug(p.cat); continue; }
    if (k === "alt") { if (v && v.length) out.alt = Array.isArray(v) ? v.join(", ") : v; continue; }
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) continue;
    // 0 ในช่องขนาดแปลว่า "ยังไม่ได้กรอก" ไม่ใช่ศูนย์จริง อย่าเขียนทับค่าที่มีอยู่
    if ((k === "w_m" || k === "r_m" || k === "height_m") && Number(v) === 0) continue;
    out[k] = v;
  }
  // รหัสต้องขึ้นต้นตรงกับหมวดเสมอ ไม่งั้นหน้าลูกค้าจะเห็น TL- อยู่ในหมวดหิน
  const pre = CODE_PRE[out.cat];
  if (pre && out.code && !String(out.code).startsWith(pre + "-")) {
    const num = String(out.code).match(/(\d{2,})\s*$/);
    out.code = num ? `${pre}-${num[1]}` : `${pre}-${out.code}`;
  }
  return out;
}

async function syncPlants(plants) {
  if (!Array.isArray(plants) || !plants.length) return { synced: 0, removed: 0 };
  const c = col(COLLECTIONS.plants);
  const keep = [];
  for (const raw of plants) {
    const p = publicPlant(raw);
    if (!p.id) continue;
    keep.push(p.id);
    // ล้างช่องที่หลังบ้านลบทิ้งแล้วออกจากเอกสารเดิมด้วย ไม่งั้นค่าเก่าค้างบนหน้าลูกค้า
    const unset = {};
    for (const k of PUBLIC_FIELDS) if (!(k in p)) unset[k] = "";
    // ขนาดที่หลังบ้านยังไม่ได้กรอก (ค่า 0) ไม่นับว่า "ลบ" จึงไม่ล้างของเดิมทิ้ง
    ["id", "w_m", "r_m", "height_m"].forEach((k) => delete unset[k]);
    await c.updateOne(
      { id: p.id },
      { $set: { ...p, published: raw.published !== false, updatedAt: new Date() },
        $unset: unset,
        $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  // ลบพันธุ์ไม้ที่ถูกลบออกจากหลังบ้านแล้ว เพื่อไม่ให้ค้างบนหน้าลูกค้า
  const r = await c.deleteMany({ id: { $nin: keep } });
  return { synced: keep.length, removed: r.deletedCount };
}

/* ---------- อ่านสถานะทั้งหมดของหลังบ้าน ---------- */
async function readState() {
  const doc = await col(COLLECTIONS.settings).findOne({ _id: STATE_KEY });
  return doc?.db || null;
}

/* หน้าหลังบ้านยิง HEAD มาตอนเปิด เพื่อดูว่า "บันทึกถาวร" พร้อมใช้จริงไหม
   ตอบเบา ๆ ไม่ต้องอ่านฐานข้อมูลทั้งก้อน */
router.head("/api/admin/state", requireAdmin, (_req, res) => res.status(200).end());

router.get("/api/admin/state", requireAdmin, async (_req, res, next) => {
  try {
    res.json({ db: (await readState()) || {}, storage: await storageStats() });
  } catch (e) { next(e); }
});

/* ---------- บันทึกสถานะทั้งหมด ---------- */
router.put("/api/admin/state", requireAdmin,
  express.json({ limit: "48mb" }),
  async (req, res, next) => {
    try {
      const db = req.body;
      if (!db || typeof db !== "object" || Array.isArray(db)) {
        return res.status(400).json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" });
      }

      const ctx = { moved: 0, bytes: 0 };
      await extractImages(db, ctx);

      db.savedAt = Date.now();
      await col(COLLECTIONS.settings).updateOne(
        { _id: STATE_KEY },
        { $set: { db, updatedAt: new Date() } },
        { upsert: true }
      );

      const plants = await syncPlants(db.plants);

      res.json({
        ok: true,
        db,                       // ส่งกลับให้หน้าเว็บ เพราะ src ของรูปเปลี่ยนเป็น URL แล้ว
        movedImages: ctx.moved,
        plants,
        storage: await storageStats(),
      });
    } catch (e) { next(e); }
  });

module.exports = { router, readState, STATE_KEY, syncPlants };
