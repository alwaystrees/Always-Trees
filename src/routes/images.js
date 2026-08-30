"use strict";

/* ------------------------------------------------------------------
   รูปทั้งหมดของเว็บวิ่งผ่านที่นี่ที่เดียว
   หน้าเว็บอ้างรูปด้วย  <img src="/img/<id>">  เท่านั้น
   ไม่มีที่ไหนในระบบรู้ว่าไฟล์จริงอยู่ใน Mongo หรือ R2
-------------------------------------------------------------------*/

const express = require("express");
const multer = require("multer");
const config = require("../config");
const storage = require("../lib/storage");
const { col, COLLECTIONS } = require("../db");
const { requireAdmin } = require("../lib/auth");
const { shape, oid } = require("../lib/resource");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.images.maxBytes, files: 20 },
});

/* ---------- อ่านรูป (เปิดให้ทุกคน) ----------
   id ของรูปในฐานข้อมูลเป็นเลขฐานสิบหก 24 ตัวเสมอ
   ชื่ออื่นเช่น /img/garden-front-after.webp คือไฟล์นิ่งในโฟลเดอร์ public
   ต้องปล่อยผ่านไปให้ express.static จัดการ ไม่งั้นรูปบนหน้าเว็บจะ 404 ทั้งหมด */
const FILE_ID = /^[0-9a-f]{24}$/i;

router.get("/img/:id", async (req, res, next) => {
  try {
    if (!FILE_ID.test(req.params.id)) return next();
    const file = await storage.get(req.params.id);
    if (!file) return res.status(404).end();

    // id ผูกกับไฟล์ตัวนั้นตลอดไป เนื้อหาไม่มีวันเปลี่ยน จึงแคชยาวได้เต็มที่
    res.set("Cache-Control", config.images.cacheControl);
    res.set("Content-Type", file.mime);
    res.set("Content-Length", String(file.buffer.length));
    if (file.meta?.hash) res.set("ETag", `"${file.meta.hash}"`);

    if (req.get("if-none-match") === `"${file.meta?.hash}"`) return res.status(304).end();
    res.end(file.buffer);
  } catch (e) { next(e); }
});

/* ---------- อัปโหลด (เฉพาะแอดมิน) ----------
   เบราว์เซอร์ต้องย่อรูปเป็น WebP ก่อนส่งเสมอ (ดู public/admin/js/upload.js)
   ฝั่งนี้แค่ตรวจชนิดกับขนาด แล้วส่งต่อให้ตัวจัดเก็บ
--------------------------------------------------------------- */
router.post("/api/files", requireAdmin, upload.array("files", 20), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: "ไม่มีไฟล์ที่ส่งมา" });

    const meta = {
      kind: req.body.kind || "gallery",
      alt: req.body.alt || "",
      takenAt: req.body.takenAt ? new Date(req.body.takenAt) : null,
      ref: req.body.refType && req.body.refId
        ? { type: req.body.refType, id: req.body.refId }
        : null,
    };

    const out = [];
    for (const [i, f] of req.files.entries()) {
      storage.checkMime(f.mimetype);
      const saved = await storage.put({
        buffer: f.buffer,
        mime: f.mimetype,
        meta: {
          ...meta,
          sort: parseInt(req.body.sort || "0", 10) + i,
          width: req.body.width ? parseInt(req.body.width, 10) : null,
          height: req.body.height ? parseInt(req.body.height, 10) : null,
        },
      });
      out.push({ ...saved, url: `/img/${saved.id}` });
    }
    res.status(201).json({ files: out });
  } catch (e) { next(e); }
});

/* ---------- รายการไฟล์ (เฉพาะแอดมิน) ---------- */
router.get("/api/files", requireAdmin, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.refType) filter["ref.type"] = req.query.refType;
    if (req.query.refId) filter["ref.id"] = req.query.refId;
    if (req.query.kind) filter.kind = req.query.kind;

    const items = await col(COLLECTIONS.files)
      .find(filter, { projection: { data: 0 } })   // อย่าดึงตัวไฟล์ออกมาโดยไม่จำเป็น
      .sort({ sort: 1, createdAt: 1 })
      .limit(Math.min(parseInt(req.query.limit || "300", 10), 1000))
      .toArray();

    res.json({ items: items.map((d) => ({ ...shape(d), url: `/img/${d._id}` })) });
  } catch (e) { next(e); }
});

/* ---------- แก้คำบรรยายภาพหรือลำดับ ---------- */
router.put("/api/files/:id", requireAdmin, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(404).json({ error: "ไม่พบไฟล์" });
    const $set = {};
    for (const k of ["alt", "sort", "kind", "ref", "takenAt"]) {
      if (k in req.body) $set[k] = k === "takenAt" && req.body[k] ? new Date(req.body[k]) : req.body[k];
    }
    const doc = await col(COLLECTIONS.files).findOneAndUpdate(
      { _id }, { $set }, { returnDocument: "after", projection: { data: 0 } }
    );
    if (!doc) return res.status(404).json({ error: "ไม่พบไฟล์" });
    res.json({ ...shape(doc), url: `/img/${doc._id}` });
  } catch (e) { next(e); }
});

/* ---------- ลบไฟล์ ---------- */
router.delete("/api/files/:id", requireAdmin, async (req, res, next) => {
  try {
    const ok = await storage.del(req.params.id);
    res.json({ deleted: ok ? 1 : 0 });
  } catch (e) { next(e); }
});

module.exports = router;
