"use strict";

/* ------------------------------------------------------------------
   ตัวสร้าง REST endpoint แบบสำเร็จรูป
   ใช้กับทุกคอลเลกชันที่เป็น "รายการที่เพิ่ม แก้ ลบ ได้" เหมือนกันหมด
   จะได้ไม่ต้องเขียนโค้ดซ้ำ 8 รอบ

     GET    /api/<name>          รายการ (?q= ค้นหา, ?limit= ?skip= ?sort=)
     GET    /api/<name>/:id      รายการเดียว
     POST   /api/<name>          เพิ่ม
     PUT    /api/<name>/:id      แก้ (merge เฉพาะฟิลด์ที่ส่งมา)
     DELETE /api/<name>/:id      ลบ
-------------------------------------------------------------------*/

const express = require("express");
const { ObjectId } = require("mongodb");
const { col } = require("../db");
const { requireAdmin } = require("./auth");

const oid = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

function clean(doc) {
  const out = { ...doc };
  delete out._id;
  delete out.createdAt;
  return out;
}

function shape(d) {
  if (!d) return d;
  const { _id, ...rest } = d;
  return { id: _id.toString(), ...rest };
}

/**
 * @param {string} name        ชื่อคอลเลกชัน
 * @param {object} opts
 *   publicRead  true = ให้คนทั่วไปอ่านได้ (แคตตาล็อก ผลงาน)
 *   publicFilter ฟังก์ชันเติมเงื่อนไขตอนคนทั่วไปอ่าน เช่น เฉพาะที่เผยแพร่แล้ว
 *   searchFields ฟิลด์ที่ ?q= จะค้น
 *   defaultSort
 */
function makeResource(name, opts = {}) {
  const {
    publicRead = false,
    publicFilter = () => ({}),
    searchFields = ["name"],
    defaultSort = { createdAt: -1 },
  } = opts;

  const r = express.Router();
  const readGuard = publicRead ? (req, res, next) => next() : requireAdmin;

  r.get("/", readGuard, async (req, res, next) => {
    try {
      const q = (req.query.q || "").trim();
      const limit = Math.min(parseInt(req.query.limit || "500", 10), 2000);
      const skip = parseInt(req.query.skip || "0", 10);

      const filter = { ...(req._isAdmin ? {} : publicFilter(req)) };
      if (q) {
        filter.$or = searchFields.map((f) => ({ [f]: { $regex: q, $options: "i" } }));
      }
      for (const [k, v] of Object.entries(req.query)) {
        if (["q", "limit", "skip", "sort"].includes(k)) continue;
        filter[k] = v;
      }

      let sort = defaultSort;
      if (req.query.sort) {
        const s = String(req.query.sort);
        sort = s.startsWith("-") ? { [s.slice(1)]: -1 } : { [s]: 1 };
      }

      const [items, total] = await Promise.all([
        col(name).find(filter).sort(sort).skip(skip).limit(limit).toArray(),
        col(name).countDocuments(filter),
      ]);
      res.json({ total, items: items.map(shape) });
    } catch (e) { next(e); }
  });

  r.get("/:id", readGuard, async (req, res, next) => {
    try {
      const _id = oid(req.params.id);
      if (!_id) return res.status(404).json({ error: "ไม่พบรายการ" });
      const filter = { _id, ...(req._isAdmin ? {} : publicFilter(req)) };
      const doc = await col(name).findOne(filter);
      if (!doc) return res.status(404).json({ error: "ไม่พบรายการ" });
      res.json(shape(doc));
    } catch (e) { next(e); }
  });

  r.post("/", requireAdmin, async (req, res, next) => {
    try {
      const doc = { ...clean(req.body), createdAt: new Date(), updatedAt: new Date() };
      const result = await col(name).insertOne(doc);
      res.status(201).json(shape({ _id: result.insertedId, ...doc }));
    } catch (e) { next(e); }
  });

  r.put("/:id", requireAdmin, async (req, res, next) => {
    try {
      const _id = oid(req.params.id);
      if (!_id) return res.status(404).json({ error: "ไม่พบรายการ" });
      const $set = { ...clean(req.body), updatedAt: new Date() };
      const doc = await col(name).findOneAndUpdate(
        { _id }, { $set }, { returnDocument: "after" }
      );
      if (!doc) return res.status(404).json({ error: "ไม่พบรายการ" });
      res.json(shape(doc));
    } catch (e) { next(e); }
  });

  r.delete("/:id", requireAdmin, async (req, res, next) => {
    try {
      const _id = oid(req.params.id);
      if (!_id) return res.status(404).json({ error: "ไม่พบรายการ" });
      const out = await col(name).deleteOne({ _id });
      res.json({ deleted: out.deletedCount });
    } catch (e) { next(e); }
  });

  return r;
}

module.exports = { makeResource, shape, oid };
