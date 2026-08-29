#!/usr/bin/env node
"use strict";
/* สร้างค่า ADMIN_PASSWORD_HASH  ใช้:  npm run hash -- รหัสผ่านที่ต้องการ */
const bcrypt = require("bcryptjs");
const pw = process.argv[2];
if (!pw) { console.error("ใช้:  npm run hash -- <รหัสผ่าน>"); process.exit(1); }
if (pw.length < 10) console.warn("⚠  รหัสผ่านสั้นกว่า 10 ตัว แนะนำให้ยาวกว่านี้");
console.log("\nคัดลอกบรรทัดล่างนี้ไปใส่ที่ Render → Environment\n");
console.log("ADMIN_PASSWORD_HASH=" + bcrypt.hashSync(pw, 12) + "\n");
