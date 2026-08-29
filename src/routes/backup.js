"use strict";

/* ------------------------------------------------------------------
   สำรองข้อมูล กู้คืน และเก็บงานเก่าเข้ากรุ

   Atlas แพลนฟรีไม่สำรองข้อมูลให้เลย ระบบนี้จึงต้องทำให้
   "กดครั้งเดียวได้ไฟล์ครบ" ไม่ใช่ให้คนไปรันคำสั่งเอง
-------------------------------------------------------------------*/

const express = require("express");
const archiver = require("archiver");
const unzipper = require("unzipper");
const multer = require("multer");
const { Binary, ObjectId } = require("mongodb");
const config = require("../config");
const { col, COLLECTIONS, storageStats } = require("../db");
const { requireAdmin, requireCron } = require("../lib/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 400 * 1024 * 1024 } });

const DATA_COLLECTIONS = [
  COLLECTIONS.plants, COLLECTIONS.projects, COLLECTIONS.leads,
  COLLECTIONS.customers, COLLECTIONS.jobs, COLLECTIONS.documents,
  COLLECTIONS.inventory, COLLECTIONS.content, COLLECTIONS.settings,
];

const stamp = () => new Date().toISOString().slice(0, 10);

async function markBackedUp() {
  await col(COLLECTIONS.settings).updateOne(
    { _id: "backup" },
    { $set: { lastBackupAt: new Date() } },
    { upsert: true }
  );
}

/* ---------- สถานะสำรองข้อมูล ใช้แสดงแถบเตือนในหน้าหลังบ้าน ---------- */
router.get("/api/admin/backup/status", requireAdmin, async (_req, res, next) => {
  try {
    const rec = await col(COLLECTIONS.settings).findOne({ _id: "backup" });
    const last = rec?.lastBackupAt || null;
    const days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
    res.json({
      lastBackupAt: last,
      daysSince: days,
      warn: days === null || days >= config.backupWarnDays,
      warnAfterDays: config.backupWarnDays,
      storage: await storageStats(),
    });
  } catch (e) { next(e); }
});

/* ---------- ดาวน์โหลดข้อมูลทั้งหมดเป็น zip ----------
   ในไฟล์: data/<collection>.json + files/<id>.<ext> + manifest.json
--------------------------------------------------------------- */
router.get("/api/admin/backup/export", requireAdmin, async (req, res, next) => {
  try {
    const includeFiles = req.query.files !== "0";
    const name = `always-trees-backup-${stamp()}.zip`;

    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename="${name}"`);

    const zip = archiver("zip", { zlib: { level: 6 } });
    zip.on("warning", (e) => console.warn("[backup]", e.message));
    zip.on("error", (e) => { console.error("[backup]", e); res.destroy(e); });
    zip.pipe(res);

    const counts = {};
    for (const c of DATA_COLLECTIONS) {
      const docs = await col(c).find({}).toArray();
      counts[c] = docs.length;
      zip.append(JSON.stringify(docs, null, 1), { name: `data/${c}.json` });
    }

    let fileCount = 0;
    if (includeFiles) {
      const cursor = col(COLLECTIONS.files).find({});
      const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
      const index = [];
      for await (const f of cursor) {
        const ext = EXT[f.mime] || "bin";
        const fname = `files/${f._id}.${ext}`;
        const buf = f.data?.buffer ? Buffer.from(f.data.buffer) : Buffer.from(f.data);
        zip.append(buf, { name: fname });
        index.push({
          id: f._id.toString(), file: fname, mime: f.mime, bytes: f.bytes,
          kind: f.kind, ref: f.ref, alt: f.alt, sort: f.sort,
          width: f.width, height: f.height,
          takenAt: f.takenAt, createdAt: f.createdAt, hash: f.hash,
        });
        fileCount += 1;
      }
      zip.append(JSON.stringify(index, null, 1), { name: "data/files.index.json" });
    }

    zip.append(JSON.stringify({
      app: "Always Trees",
      exportedAt: new Date().toISOString(),
      baseUrl: config.baseUrl,
      collections: counts,
      fileCount,
      note: "กู้คืนได้ที่หน้าหลังบ้าน → ตั้งค่า → กู้คืนจากไฟล์",
    }, null, 2), { name: "manifest.json" });

    await zip.finalize();
    await markBackedUp();
  } catch (e) { next(e); }
});

/* ---------- กู้คืนจากไฟล์ zip เดิม ----------
   mode=merge   ใส่ทับของเดิมที่ id ตรงกัน ของที่ไม่มีในไฟล์ยังอยู่ (ค่าตั้งต้น)
   mode=replace ล้างของเดิมทิ้งก่อน แล้วใส่ตามไฟล์ทั้งหมด
--------------------------------------------------------------- */
router.post("/api/admin/backup/import", requireAdmin, upload.single("backup"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "ไม่มีไฟล์ที่ส่งมา" });
      const mode = req.body.mode === "replace" ? "replace" : "merge";

      const dir = await unzipper.Open.buffer(req.file.buffer);
      const byPath = new Map(dir.files.map((f) => [f.path, f]));
      const report = { mode, collections: {}, files: 0, skipped: [] };

      const toId = (v) => (typeof v === "string" && ObjectId.isValid(v) ? new ObjectId(v)
        : v && v.$oid && ObjectId.isValid(v.$oid) ? new ObjectId(v.$oid) : v);

      for (const c of DATA_COLLECTIONS) {
        const entry = byPath.get(`data/${c}.json`);
        if (!entry) { report.skipped.push(c); continue; }
        const docs = JSON.parse((await entry.buffer()).toString("utf8"));
        if (mode === "replace") await col(c).deleteMany({});
        let n = 0;
        for (const d of docs) {
          const _id = toId(d._id);
          const body = { ...d };
          delete body._id;
          await col(c).updateOne({ _id }, { $set: body }, { upsert: true });
          n += 1;
        }
        report.collections[c] = n;
      }

      const idxEntry = byPath.get("data/files.index.json");
      if (idxEntry) {
        const index = JSON.parse((await idxEntry.buffer()).toString("utf8"));
        if (mode === "replace") await col(COLLECTIONS.files).deleteMany({});
        for (const meta of index) {
          const entry = byPath.get(meta.file);
          if (!entry) continue;
          const buf = await entry.buffer();
          const _id = ObjectId.isValid(meta.id) ? new ObjectId(meta.id) : new ObjectId();
          await col(COLLECTIONS.files).updateOne(
            { _id },
            {
              $set: {
                data: new Binary(buf), mime: meta.mime, bytes: buf.length, hash: meta.hash,
                kind: meta.kind, ref: meta.ref, alt: meta.alt, sort: meta.sort,
                width: meta.width, height: meta.height,
                takenAt: meta.takenAt ? new Date(meta.takenAt) : null,
                createdAt: meta.createdAt ? new Date(meta.createdAt) : new Date(),
              },
            },
            { upsert: true }
          );
          report.files += 1;
        }
      }

      res.json({ ok: true, ...report });
    } catch (e) { next(e); }
  });

/* ---------- เก็บงานเก่าเข้ากรุ ----------
   ดาวน์โหลดข้อมูลของช่วงปีที่เลือกออกมาก่อน แล้วค่อยลบเพื่อคืนพื้นที่
   ขั้นตอน 2 จังหวะ กันลบพลาด
     1) POST {before:"2567-12-31", confirm:false}  → บอกว่าจะลบอะไรบ้าง ไม่ลบจริง
     2) POST {before:"...", confirm:true, exported:true} → ลบจริง
--------------------------------------------------------------- */
router.post("/api/admin/backup/archive", requireAdmin, async (req, res, next) => {
  try {
    const before = new Date(req.body.before);
    if (isNaN(before)) return res.status(400).json({ error: "วันที่ไม่ถูกต้อง" });

    const targets = [COLLECTIONS.documents, COLLECTIONS.jobs, COLLECTIONS.leads];
    const preview = {};
    for (const c of targets) {
      preview[c] = await col(c).countDocuments({ createdAt: { $lt: before } });
    }
    const jobIds = (await col(COLLECTIONS.jobs)
      .find({ createdAt: { $lt: before } }, { projection: { _id: 1 } }).toArray())
      .map((d) => d._id.toString());
    preview.files = await col(COLLECTIONS.files)
      .countDocuments({ "ref.type": "job", "ref.id": { $in: jobIds } });

    if (!req.body.confirm) {
      return res.json({ preview, willDelete: false, note: "ดาวน์โหลดข้อมูลก่อน แล้วส่ง confirm:true มาอีกครั้งเพื่อลบจริง" });
    }
    if (!req.body.exported) {
      return res.status(400).json({ error: "ต้องกดดาวน์โหลดข้อมูลก่อนจึงจะลบได้" });
    }

    const deleted = {};
    for (const c of targets) {
      const r = await col(c).deleteMany({ createdAt: { $lt: before } });
      deleted[c] = r.deletedCount;
    }
    const fr = await col(COLLECTIONS.files)
      .deleteMany({ "ref.type": "job", "ref.id": { $in: jobIds } });
    deleted.files = fr.deletedCount;

    res.json({ ok: true, deleted, storage: await storageStats() });
  } catch (e) { next(e); }
});

/* ---------- อีเมลแจ้งเตือนรายเดือน ----------
   GitHub Actions ยิงมาที่นี่ทุกวันที่ 1 (ดู .github/workflows/backup-reminder.yml)
   ถ้าไม่ได้ตั้ง BREVO_API_KEY จะข้ามการส่งอีเมลไปเฉย ๆ ไม่พัง
--------------------------------------------------------------- */
router.post("/api/cron/backup-reminder", requireCron, async (_req, res, next) => {
  try {
    const rec = await col(COLLECTIONS.settings).findOne({ _id: "backup" });
    const last = rec?.lastBackupAt || null;
    const days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
    const stats = await storageStats();
    const link = `${config.baseUrl}/admin/#backup`;

    const lastText = last
      ? `ครั้งล่าสุดเมื่อ ${last.toLocaleDateString("th-TH")} (${days} วันที่แล้ว)`
      : "ยังไม่เคยดาวน์โหลดเลยสักครั้ง";

    const html = `
      <div style="font-family:system-ui,sans-serif;line-height:1.8;color:#12211A;max-width:520px">
        <h2 style="font-size:19px;margin:0 0 12px">ถึงเวลาสำรองข้อมูล Always Trees</h2>
        <p style="margin:0 0 8px">${lastText}</p>
        <p style="margin:0 0 8px">พื้นที่ที่ใช้ไป ${stats.percent}% ของ 512 MB · รูปในระบบ ${stats.fileCount} ใบ</p>
        <p style="margin:16px 0">
          <a href="${link}" style="background:#0B8636;color:#fff;text-decoration:none;
             padding:12px 22px;border-radius:999px;display:inline-block;font-weight:500">
            เปิดหน้าหลังบ้านแล้วกดดาวน์โหลด</a>
        </p>
        <p style="margin:0;font-size:13px;color:#77877D">
          ฐานข้อมูลนี้เก็บใบกำกับภาษีซึ่งกฎหมายกำหนดให้เก็บ 5 ปี
          และแพลนฟรีของ MongoDB Atlas ไม่สำรองข้อมูลให้ ถ้าข้อมูลหายคือหายถาวร</p>
      </div>`;

    if (!config.mail.brevoKey) {
      return res.json({ sent: false, reason: "ยังไม่ได้ตั้ง BREVO_API_KEY", daysSince: days, storage: stats });
    }

    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": config.mail.brevoKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { email: config.mail.from, name: config.mail.fromName },
        to: [{ email: config.mail.to }],
        subject: `สำรองข้อมูล Always Trees — ${lastText}`,
        htmlContent: html,
      }),
    });
    if (!r.ok) throw new Error(`Brevo ตอบกลับ ${r.status}: ${await r.text()}`);
    res.json({ sent: true, daysSince: days, storage: stats });
  } catch (e) { next(e); }
});

module.exports = router;
