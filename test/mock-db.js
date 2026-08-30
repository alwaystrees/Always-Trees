"use strict";
/* ฐานข้อมูลจำลองในหน่วยความจำ ใช้เฉพาะตอนทดสอบ ไม่ได้ใช้ตอนรันจริง
   รองรับเท่าที่โค้ดในโปรเจกต์นี้เรียกใช้จริงเท่านั้น */

const { ObjectId } = require("mongodb");

const COLLECTIONS = {
  files: "files", plants: "plants", projects: "projects", leads: "leads",
  customers: "customers", jobs: "jobs", documents: "documents",
  inventory: "inventory", content: "content", settings: "settings",
};

const store = new Map();
const data = (n) => { if (!store.has(n)) store.set(n, []); return store.get(n); };

const eq = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

function match(doc, filter) {
  for (const [k, v] of Object.entries(filter || {})) {
    if (k === "$or") { if (!v.some((f) => match(doc, f))) return false; continue; }
    const val = k.split(".").reduce((o, p) => (o == null ? o : o[p]), doc);
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof ObjectId)) {
      for (const [op, arg] of Object.entries(v)) {
        if (op === "$ne" && eq(val, arg)) return false;
        else if (op === "$in" && !arg.some((x) => eq(val, x))) return false;
        else if (op === "$nin" && arg.some((x) => eq(val, x))) return false;
        else if (op === "$lt" && !(val < arg)) return false;
        else if (op === "$gte" && !(val >= arg)) return false;
        else if (op === "$regex" && !new RegExp(arg, v.$options || "").test(String(val ?? ""))) return false;
        else if (op === "$exists" && (val !== undefined) !== arg) return false;
      }
    } else if (!eq(val, v)) return false;
  }
  return true;
}

function sortDocs(rows, spec) {
  if (!spec) return rows;
  const keys = Object.entries(spec);
  return rows.sort((a, b) => {
    for (const [k, dir] of keys) {
      const x = a[k], y = b[k];
      if (x === y) continue;
      return (x > y ? 1 : -1) * dir;
    }
    return 0;
  });
}

function cursor(rows) {
  let out = rows.slice();
  const api = {
    sort(s) { out = sortDocs(out, s); return api; },
    skip(n) { out = out.slice(n); return api; },
    limit(n) { out = out.slice(0, n); return api; },
    toArray: async () => out.slice(),
    [Symbol.asyncIterator]() {
      let i = 0;
      return { next: async () => (i < out.length ? { value: out[i++], done: false } : { done: true }) };
    },
  };
  return api;
}

function collection(name) {
  const rows = data(name);
  return {
    async createIndex() { return "ok"; },
    find(filter = {}, opts = {}) {
      let hit = rows.filter((d) => match(d, filter));
      if (opts.projection) {
        const drop = Object.entries(opts.projection).filter(([, v]) => v === 0).map(([k]) => k);
        hit = hit.map((d) => { const c = { ...d }; drop.forEach((k) => delete c[k]); return c; });
      }
      return cursor(hit);
    },
    async findOne(filter = {}, opts = {}) {
      const d = rows.find((r) => match(r, filter));
      if (!d) return null;
      if (opts.projection) {
        const c = { ...d };
        Object.entries(opts.projection).forEach(([k, v]) => { if (v === 0) delete c[k]; });
        return c;
      }
      return d;
    },
    async insertOne(doc) {
      const _id = doc._id ?? new ObjectId();
      rows.push({ ...doc, _id });
      return { insertedId: _id, acknowledged: true };
    },
    async updateOne(filter, update, opts = {}) {
      const i = rows.findIndex((r) => match(r, filter));
      if (i === -1) {
        if (!opts.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        const _id = filter._id ?? new ObjectId();
        rows.push({ _id, ...(update.$setOnInsert || {}), ...(update.$set || {}) });
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: _id };
      }
      rows[i] = { ...rows[i], ...(update.$set || {}) };
      Object.keys(update.$unset || {}).forEach((k) => { delete rows[i][k]; });
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    },
    async findOneAndUpdate(filter, update, opts = {}) {
      const i = rows.findIndex((r) => match(r, filter));
      if (i === -1) return null;
      rows[i] = { ...rows[i], ...(update.$set || {}) };
      const d = { ...rows[i] };
      if (opts.projection) Object.entries(opts.projection).forEach(([k, v]) => { if (v === 0) delete d[k]; });
      return d;
    },
    async deleteOne(filter) {
      const i = rows.findIndex((r) => match(r, filter));
      if (i === -1) return { deletedCount: 0 };
      rows.splice(i, 1);
      return { deletedCount: 1 };
    },
    async deleteMany(filter) {
      let n = 0;
      for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], filter)) { rows.splice(i, 1); n++; }
      return { deletedCount: n };
    },
    async countDocuments(filter = {}) { return rows.filter((d) => match(d, filter)).length; },
    aggregate() {
      const bytes = rows.reduce((s, d) => s + (d.bytes || 0), 0);
      return { toArray: async () => [{ _id: null, n: rows.length, bytes }] };
    },
  };
}

module.exports = {
  COLLECTIONS,
  connect: async () => module.exports.getDb(),
  getDb: () => ({ command: async () => ({ ok: 1, dataSize: 1_200_000, indexSize: 90_000 }) }),
  col: collection,
  close: async () => {},
  storageStats: async () => {
    const files = data("files");
    const fileBytes = files.reduce((s, d) => s + (d.bytes || 0), 0);
    const used = 1_290_000 + fileBytes;
    return {
      usedBytes: used, limitBytes: 512 * 1024 * 1024,
      percent: Math.round((used / (512 * 1024 * 1024)) * 1000) / 10,
      fileCount: files.length, fileBytes, textBytes: used - fileBytes,
    };
  },
  _store: store,
};
