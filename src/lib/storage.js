"use strict";

/* ------------------------------------------------------------------
   ตัวจัดเก็บไฟล์ — ชั้นเดียวที่รู้ว่าไฟล์อยู่ที่ไหนจริง ๆ

   *** จุดสำคัญที่สุดของโปรเจกต์นี้ ***
   ทั้งระบบเรียกรูปผ่าน /img/:id เท่านั้น ไม่มีที่ไหนรู้ว่าไฟล์อยู่ใน Mongo
   วันที่พื้นที่ Mongo เกิน 60% แล้วอยากย้ายไป Cloudflare R2
   ให้เขียน adapter ตัวใหม่ในไฟล์นี้ที่มี put/get/del เหมือนกัน แล้วสลับ DRIVER
   ส่วนอื่นของแอปไม่ต้องแก้แม้แต่บรรทัดเดียว
-------------------------------------------------------------------*/

const crypto = require("crypto");
const { Binary, ObjectId } = require("mongodb");
const { col, COLLECTIONS } = require("../db");

const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png", "application/pdf"]);

/* ---------- adapter: เก็บใน MongoDB (ใช้อยู่ตอนนี้) ---------- */
const mongoDriver = {
  name: "mongo",

  async put({ buffer, mime, meta }) {
    const doc = {
      data: new Binary(buffer),          // BSON Binary ไม่ใช่สตริง base64 (base64 พอง 33%)
      mime,
      bytes: buffer.length,
      hash: crypto.createHash("sha1").update(buffer).digest("hex"),
      kind: meta.kind || "gallery",      // gallery | thumb | doc
      ref: meta.ref || null,             // { type:'project'|'plant'|'job', id:'...' }
      alt: meta.alt || "",
      width: meta.width || null,
      height: meta.height || null,
      sort: meta.sort ?? 0,
      takenAt: meta.takenAt || null,
      createdAt: new Date(),
    };
    const r = await col(COLLECTIONS.files).insertOne(doc);
    return { id: r.insertedId.toString(), bytes: doc.bytes, mime };
  },

  async get(id) {
    if (!ObjectId.isValid(id)) return null;
    const doc = await col(COLLECTIONS.files).findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return { buffer: doc.data.buffer ? Buffer.from(doc.data.buffer) : Buffer.from(doc.data), mime: doc.mime, meta: doc };
  },

  async head(id) {
    if (!ObjectId.isValid(id)) return null;
    return col(COLLECTIONS.files).findOne(
      { _id: new ObjectId(id) },
      { projection: { data: 0 } }
    );
  },

  async del(id) {
    if (!ObjectId.isValid(id)) return false;
    const r = await col(COLLECTIONS.files).deleteOne({ _id: new ObjectId(id) });
    return r.deletedCount > 0;
  },
};

/* ---------- adapter: Cloudflare R2 (เตรียมไว้สำหรับอนาคต) ----------
   วิธีเปิดใช้เมื่อถึงเวลา
   1. npm i @aws-sdk/client-s3
   2. ตั้ง env: R2_ACCOUNT_ID R2_ACCESS_KEY R2_SECRET_KEY R2_BUCKET
   3. ตั้ง STORAGE_DRIVER=r2
   4. รันสคริปต์ย้ายไฟล์เก่า scripts/migrate-files-to-r2.js (เขียนตอนนั้น)
   โครง put/get/del เหมือนกันทุกอย่าง ที่เหลือของแอปไม่ต้องแก้
------------------------------------------------------------------- */

function pickDriver() {
  const want = (process.env.STORAGE_DRIVER || "mongo").toLowerCase();
  if (want === "mongo") return mongoDriver;
  console.warn(`[storage] ยังไม่มี adapter "${want}" — ใช้ mongo แทน`);
  return mongoDriver;
}

const driver = pickDriver();

function checkMime(mime) {
  if (!ALLOWED.has(mime)) {
    const e = new Error(`ไม่รองรับไฟล์ชนิด ${mime} — รับเฉพาะ WebP, JPEG, PNG และ PDF`);
    e.status = 415;
    throw e;
  }
}

module.exports = {
  driverName: driver.name,
  checkMime,
  put: (args) => driver.put(args),
  get: (id) => driver.get(id),
  head: (id) => driver.head(id),
  del: (id) => driver.del(id),
};
