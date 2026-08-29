"use strict";

const express = require("express");
const config = require("../config");
const { col, COLLECTIONS, storageStats, getDb } = require("../db");
const { makeResource } = require("../lib/resource");
const auth = require("../lib/auth");

const router = express.Router();

/* ------------------------------------------------------------------
   /api/health
   GitHub Actions ยิงมาทุก 10 นาที ช่วง 06:00–22:00 น. ไทย
   คำสั่ง ping แตะ Mongo ด้วย เพื่อให้ได้สองอย่างในนัดเดียว
     - Render ไม่หลับ
     - Atlas ไม่ถูกหยุดที่ 30 วันเพราะไม่มีการเชื่อมต่อ
-------------------------------------------------------------------*/
router.get("/health", async (_req, res) => {
  const t0 = Date.now();
  try {
    await getDb().command({ ping: 1 });
    res.json({ ok: true, db: "up", ms: Date.now() - t0, at: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ ok: false, db: "down", error: e.message });
  }
});

/* ---------- เข้าสู่ระบบหลังบ้าน ---------- */
router.post("/login", auth.loginLimiter, express.json(), async (req, res) => {
  const ok = await auth.verifyPassword(req.body?.password);
  if (!ok) {
    req._loginFail();
    return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
  }
  req._loginOk();
  auth.setCookie(res);
  res.json({ ok: true });
});

router.post("/logout", (_req, res) => {
  auth.clearCookie(res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  res.json({ admin: !!req._isAdmin });
});

/* ---------- ฟอร์มติดต่อ และแบบที่ส่งจากเครื่องมือจัดสวน ----------
   เปิดให้คนทั่วไปส่งได้ แต่ห้ามอ่าน
--------------------------------------------------------------- */
const leadWindow = new Map();
router.post("/leads", express.json({ limit: "512kb" }), async (req, res, next) => {
  try {
    const ip = req.ip || "x";
    const now = Date.now();
    const hits = (leadWindow.get(ip) || []).filter((t) => now - t < 3600_000);
    if (hits.length >= 8) return res.status(429).json({ error: "ส่งบ่อยเกินไป ลองใหม่อีกครั้งภายหลัง" });
    hits.push(now);
    leadWindow.set(ip, hits);

    const b = req.body || {};
    if (b.website) return res.json({ ok: true });            // กับดักบอท ฟิลด์ที่คนมองไม่เห็น
    const name = String(b.name || "").trim().slice(0, 120);
    const contact = String(b.phone || b.line || b.email || "").trim().slice(0, 120);
    if (!name || !contact) {
      return res.status(400).json({ error: "กรุณากรอกชื่อและช่องทางติดต่ออย่างน้อยหนึ่งช่อง" });
    }

    const doc = {
      name,
      phone: String(b.phone || "").trim().slice(0, 60),
      line: String(b.line || "").trim().slice(0, 60),
      email: String(b.email || "").trim().slice(0, 120),
      message: String(b.message || "").trim().slice(0, 4000),
      source: ["form", "design-tool", "catalog"].includes(b.source) ? b.source : "form",
      planJson: b.planJson && typeof b.planJson === "object" ? b.planJson : null,
      planText: String(b.planText || "").slice(0, 8000),
      status: "ใหม่",
      createdAt: new Date(),
    };
    const r = await col(COLLECTIONS.leads).insertOne(doc);
    res.status(201).json({ ok: true, id: r.insertedId.toString() });
  } catch (e) { next(e); }
});

/* ---------- ข้อมูลรวมหน้าแรกของหลังบ้าน ---------- */
router.get("/admin/summary", auth.requireAdmin, async (_req, res, next) => {
  try {
    const [leadsNew, jobsActive, quotesOpen, storage] = await Promise.all([
      col(COLLECTIONS.leads).countDocuments({ status: "ใหม่" }),
      col(COLLECTIONS.jobs).countDocuments({ status: { $nin: ["ปิดงาน", "ยกเลิก"] } }),
      col(COLLECTIONS.documents).countDocuments({ type: "QT", status: { $in: ["รอตอบ", "ส่งแล้ว"] } }),
      storageStats(),
    ]);
    const backup = await col(COLLECTIONS.settings).findOne({ _id: "backup" });
    const days = backup?.lastBackupAt
      ? Math.floor((Date.now() - backup.lastBackupAt.getTime()) / 86400000)
      : null;
    res.json({
      leadsNew, jobsActive, quotesOpen, storage,
      backup: {
        lastBackupAt: backup?.lastBackupAt || null,
        daysSince: days,
        warn: days === null || days >= config.backupWarnDays,
      },
    });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------------
   คอลเลกชันที่เป็นรายการเพิ่ม-แก้-ลบ ใช้ตัวสร้าง endpoint สำเร็จรูป
-------------------------------------------------------------------*/
router.use("/plants", makeResource(COLLECTIONS.plants, {
  publicRead: true,
  publicFilter: () => ({ published: { $ne: false } }),
  searchFields: ["name", "alt", "sci", "note"],
  defaultSort: { cat: 1, name: 1 },
}));

router.use("/projects", makeResource(COLLECTIONS.projects, {
  publicRead: true,
  publicFilter: () => ({ published: true }),
  searchFields: ["title", "category", "brief"],
  defaultSort: { sortOrder: 1, createdAt: -1 },
}));

router.use("/leads", makeResource(COLLECTIONS.leads, {
  searchFields: ["name", "phone", "line", "email", "message"],
}));
router.use("/customers", makeResource(COLLECTIONS.customers, {
  searchFields: ["name", "phone", "email", "address", "taxId"],
  defaultSort: { name: 1 },
}));
router.use("/jobs", makeResource(COLLECTIONS.jobs, {
  searchFields: ["title", "note"],
}));
router.use("/documents", makeResource(COLLECTIONS.documents, {
  searchFields: ["no", "customerName", "note"],
}));
router.use("/inventory", makeResource(COLLECTIONS.inventory, {
  searchFields: ["name", "sku", "note"],
  defaultSort: { cat: 1, name: 1 },
}));
router.use("/content", makeResource(COLLECTIONS.content, {
  searchFields: ["title", "caption"],
  defaultSort: { dueAt: 1 },
}));

/* ---------- ตั้งค่า เก็บเป็น document เดียวต่อคีย์ ---------- */
router.get("/settings/:key", auth.requireAdmin, async (req, res, next) => {
  try {
    const doc = await col(COLLECTIONS.settings).findOne({ _id: req.params.key });
    res.json(doc || { _id: req.params.key });
  } catch (e) { next(e); }
});

router.put("/settings/:key", auth.requireAdmin, express.json(), async (req, res, next) => {
  try {
    const body = { ...req.body };
    delete body._id;
    await col(COLLECTIONS.settings).updateOne(
      { _id: req.params.key },
      { $set: { ...body, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ข้อมูลบริษัทสำหรับหน้าเว็บสาธารณะ (เฉพาะที่เปิดเผยได้) */
router.get("/public/company", async (_req, res, next) => {
  try {
    const s = await col(COLLECTIONS.settings).findOne({ _id: "company" });
    res.json({
      ...config.company,
      taxId: s?.taxId || null,
      address: s?.address || null,
      lineOA: s?.lineOA || null,
    });
  } catch (e) { next(e); }
});

module.exports = router;
