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

function publicPlant(p) {
  const out = {};
  for (const [k, v] of Object.entries(p || {})) {
    if (PRICE_KEY.test(k)) continue;
    out[k] = v;
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
    await c.updateOne(
      { id: p.id },
      { $set: { ...p, published: p.published !== false, updatedAt: new Date() },
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
