"use strict";

/* ------------------------------------------------------------------
   ค่าตั้งต้นทั้งหมดอยู่ที่เดียว
   *** BASE_URL คือจุดเดียวที่เก็บโดเมน ***
   วันย้ายจาก alwaystrees.onrender.com ไป alwaystrees.co.th
   แก้ค่านี้ที่ Render → Environment แล้วจบ ไม่ต้องแตะโค้ด
-------------------------------------------------------------------*/

const required = (key) => {
  const v = process.env[key];
  if (!v) {
    console.error(`[config] ขาดค่า ${key} — ตั้งใน Render → Environment`);
    process.exit(1);
  }
  return v;
};

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  env: process.env.NODE_ENV || "development",

  // โดเมนของเว็บ ใช้ทำ canonical, og:url, ลิงก์ในอีเมล
  baseUrl: (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),

  // true = บอก Google อย่าเก็บข้อมูล ใช้ตอนยังอยู่บน .onrender.com
  // พอขึ้นโดเมนจริงแล้วให้ตั้งเป็น false
  noindex: process.env.NOINDEX !== "false",

  mongo: {
    uri: required("MONGODB_URI"),
    dbName: process.env.MONGODB_DB || "alwaystrees",
  },

  admin: {
    // สร้างค่านี้ด้วย `npm run hash -- รหัสผ่านที่ต้องการ`
    passwordHash: process.env.ADMIN_PASSWORD_HASH || "",
    jwtSecret: process.env.JWT_SECRET || "",
    sessionDays: 14,
  },

  images: {
    // ขนาดสูงสุดที่ยอมรับต่อไฟล์ (เบราว์เซอร์ย่อมาแล้วควรไม่เกิน 400 KB)
    maxBytes: parseInt(process.env.IMAGE_MAX_BYTES || String(2 * 1024 * 1024), 10),
    // แคชรูปหนึ่งปี รูปไม่เคยเปลี่ยนเนื้อหาเพราะ id ผูกกับไฟล์
    cacheControl: "public, max-age=31536000, immutable",
  },

  // แจ้งเตือนสำรองข้อมูล — ถ้าไม่ได้ตั้ง BREVO_API_KEY ระบบจะข้ามไปเฉย ๆ
  mail: {
    brevoKey: process.env.BREVO_API_KEY || "",
    from: process.env.MAIL_FROM || "alwaystrees.at@gmail.com",
    fromName: "Always Trees",
    to: process.env.BACKUP_REMINDER_TO || "alwaystrees.at@gmail.com",
  },

  // โทเคนที่ GitHub Actions ใช้เรียก /api/cron/*
  cronToken: process.env.CRON_TOKEN || "",

  // เตือนในหน้าหลังบ้านเมื่อไม่ได้ดาวน์โหลดข้อมูลเกินกี่วัน
  backupWarnDays: parseInt(process.env.BACKUP_WARN_DAYS || "40", 10),

  company: {
    name: "Always Trees Co., LTD",
    nameTh: "บริษัท ออลเวย์ ทรีส์ จำกัด",
    phone: "088-892-6429",
    email: "alwaystrees.at@gmail.com",
    facebook: "https://www.facebook.com/profile.php?id=61556970192316",
    messenger: "https://m.me/61556970192316",
  },
};

if (!config.admin.jwtSecret) {
  if (config.env === "production") {
    console.error("[config] ขาดค่า JWT_SECRET — ตั้งใน Render → Environment");
    process.exit(1);
  }
  config.admin.jwtSecret = "dev-only-secret-do-not-use-in-production";
}

module.exports = config;
