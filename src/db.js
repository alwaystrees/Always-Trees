"use strict";

const { MongoClient } = require("mongodb");
const config = require("./config");

let client = null;
let db = null;

/* ------------------------------------------------------------------
   คอลเลกชันทั้งหมดในระบบ
   files แยกออกมาต่างหากเสมอ — หนึ่งรูปหนึ่ง document
   ห้ามฝังรูปลงใน document ของงานหรือของต้นไม้
-------------------------------------------------------------------*/
const COLLECTIONS = {
  files: "files",           // รูปและไฟล์แนบ เก็บเป็น BSON Binary
  plants: "plants",         // แคตตาล็อกต้นไม้
  projects: "projects",     // ผลงาน
  leads: "leads",           // ลูกค้าที่ทักเข้ามา + แบบที่ส่งจากเครื่องมือ
  customers: "customers",   // ฐานข้อมูลลูกค้า
  jobs: "jobs",             // งานของลูกค้าแต่ละราย
  documents: "documents",   // ใบเสนอราคา ใบแจ้งหนี้ ใบวางบิล ใบกำกับภาษี
  inventory: "inventory",   // คลังของและราคา
  content: "content",       // บอร์ดคอนเท้น
  settings: "settings",     // ข้อมูลบริษัท เลขที่เอกสารล่าสุด สถานะสำรองข้อมูล
};

async function connect() {
  if (db) return db;
  client = new MongoClient(config.mongo.uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000,
  });
  await client.connect();
  db = client.db(config.mongo.dbName);
  await ensureIndexes();
  console.log(`[db] เชื่อมต่อ MongoDB สำเร็จ (${config.mongo.dbName})`);
  return db;
}

async function ensureIndexes() {
  const c = (n) => db.collection(n);
  await Promise.all([
    c(COLLECTIONS.files).createIndex({ "ref.type": 1, "ref.id": 1, sort: 1 }),
    c(COLLECTIONS.files).createIndex({ createdAt: -1 }),
    c(COLLECTIONS.plants).createIndex({ cat: 1, name: 1 }),
    c(COLLECTIONS.plants).createIndex({ name: "text", alt: "text", sci: "text" }),
    c(COLLECTIONS.projects).createIndex({ slug: 1 }, { unique: true, sparse: true }),
    c(COLLECTIONS.projects).createIndex({ published: 1, sortOrder: 1 }),
    c(COLLECTIONS.leads).createIndex({ createdAt: -1 }),
    c(COLLECTIONS.leads).createIndex({ status: 1 }),
    c(COLLECTIONS.customers).createIndex({ name: 1 }),
    c(COLLECTIONS.jobs).createIndex({ customerId: 1, status: 1 }),
    c(COLLECTIONS.documents).createIndex({ no: 1 }, { unique: true, sparse: true }),
    c(COLLECTIONS.documents).createIndex({ customerId: 1, type: 1, createdAt: -1 }),
    c(COLLECTIONS.inventory).createIndex({ cat: 1, name: 1 }),
    c(COLLECTIONS.content).createIndex({ status: 1, dueAt: 1 }),
  ]);
}

function getDb() {
  if (!db) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูล เรียก connect() ก่อน");
  return db;
}

const col = (name) => getDb().collection(name);

/* พื้นที่ที่ใช้ไป — ใช้แสดงมาตรวัดในหน้าหลังบ้าน */
async function storageStats() {
  const stats = await getDb().command({ dbStats: 1, scale: 1 });
  const filesAgg = await col(COLLECTIONS.files)
    .aggregate([{ $group: { _id: null, n: { $sum: 1 }, bytes: { $sum: "$bytes" } } }])
    .toArray();
  const f = filesAgg[0] || { n: 0, bytes: 0 };
  const limit = 512 * 1024 * 1024; // โควตาคลัสเตอร์ฟรีของ Atlas
  const used = stats.dataSize + (stats.indexSize || 0);
  return {
    usedBytes: used,
    limitBytes: limit,
    percent: Math.round((used / limit) * 1000) / 10,
    fileCount: f.n,
    fileBytes: f.bytes,
    textBytes: Math.max(0, used - f.bytes),
  };
}

async function close() {
  if (client) await client.close();
  client = null;
  db = null;
}

module.exports = { connect, getDb, col, close, storageStats, COLLECTIONS };
