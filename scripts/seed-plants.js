#!/usr/bin/env node
"use strict";
/* ------------------------------------------------------------------
   นำเข้าพันธุ์ไม้จาก data/plants.json เข้าฐานข้อมูล
     node scripts/seed-plants.js               ใส่ทับตาม id เดิม ของที่ไม่มีในไฟล์ยังอยู่
     node scripts/seed-plants.js --replace     ล้างของเดิมทิ้งก่อน

   จับคู่ด้วย id เสมอ (t01 h05 s12) — id ห้ามเปลี่ยน ตามกฎในเอกสารส่งมอบ
   ใส่เข้าทั้ง collection plants และสถานะหลังบ้าน (DB.plants)
   เพื่อให้ทั้งสองฝั่งเห็นชุดเดียวกันตั้งแต่วันแรก
-------------------------------------------------------------------*/
const fs = require("fs");
const path = require("path");
const { connect, col, close, COLLECTIONS } = require("../src/db");

const PRICE_KEY = /price|cost|mat|lab|markup|\bmk\b|ราคา|ทุน|กำไร/i;

(async () => {
  const file = path.join(__dirname, "..", "data", "plants.json");
  if (!fs.existsSync(file)) { console.error("ไม่พบไฟล์ data/plants.json"); process.exit(1); }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = Array.isArray(raw) ? raw : (raw.items || raw.plants || raw.data || []);
  if (!rows.length) { console.error("ไฟล์ไม่มีรายการพันธุ์ไม้"); process.exit(1); }

  // กันราคาหลุดขึ้นเว็บสาธารณะ ตรวจซ้ำอีกชั้นก่อนเข้าฐานข้อมูล
  const leaked = new Set();
  const clean = rows.map((p) => {
    const out = {};
    for (const [k, v] of Object.entries(p)) {
      if (PRICE_KEY.test(k)) { leaked.add(k); continue; }
      out[k] = v;
    }
    return out;
  });
  if (leaked.size) console.warn("⚠ ตัดคีย์ราคาออก:", [...leaked].join(", "));

  await connect();
  const c = col(COLLECTIONS.plants);
  if (process.argv.includes("--replace")) {
    console.log(`ลบของเดิม ${(await c.deleteMany({})).deletedCount} รายการ`);
  }

  let added = 0, updated = 0;
  for (const p of clean) {
    if (!p.id) continue;
    const r = await c.updateOne(
      { id: p.id },
      { $set: { ...p, published: p.published !== false, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    if (r.upsertedCount) added++; else if (r.modifiedCount) updated++;
  }

  // ใส่เข้าสถานะหลังบ้านด้วย ถ้ายังไม่เคยมี
  const st = col(COLLECTIONS.settings);
  const cur = await st.findOne({ _id: "adminState" });
  const db = cur?.db || {};
  if (!Array.isArray(db.plants) || !db.plants.length) {
    db.plants = clean;
    db.savedAt = Date.now();
    await st.updateOne({ _id: "adminState" }, { $set: { db, updatedAt: new Date() } }, { upsert: true });
    console.log(`ใส่พันธุ์ไม้เข้าสถานะหลังบ้าน ${clean.length} รายการ`);
  } else {
    console.log(`หลังบ้านมีพันธุ์ไม้อยู่แล้ว ${db.plants.length} รายการ — ไม่แตะต้อง`);
  }

  const total = await c.countDocuments();
  const noW = await c.countDocuments({ $or: [{ w_m: { $in: [0, null] } }, { w_m: { $exists: false } }] });
  console.log(`เพิ่มใหม่ ${added} · อัปเดต ${updated} · รวมในระบบ ${total} รายการ`);
  console.log(`ยังไม่มีค่าทรงพุ่ม (w_m) ${noW} รายการ — ดู data/ต้องถามเจ้าของ.csv`);
  await close();
})().catch((e) => { console.error(e); process.exit(1); });
