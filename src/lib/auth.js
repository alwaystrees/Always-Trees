"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");

const COOKIE = "at_session";

/* ------------------------------------------------------------------
   อายุการล็อกอิน — ตั้งใจให้สั้น เพราะหลังบ้านมีราคาทุนและข้อมูลลูกค้า

   1. คุกกี้เป็นแบบ session ไม่มี maxAge  → ปิดเบราว์เซอร์ = หลุดทันที
   2. โทเคนหมดอายุใน idleMinutes         → เปิดค้างไว้ไม่แตะ = ถามรหัสใหม่
   3. ทุกครั้งที่ใช้งานจะต่ออายุให้ใหม่    → ทำงานอยู่จะไม่โดนเตะกลางคัน
   4. ครบ absoluteHours นับจากตอนล็อกอิน  → ถามรหัสใหม่ ต่อให้ใช้งานตลอด
-------------------------------------------------------------------*/

function sign(loginAt) {
  return jwt.sign({ role: "admin", lif: loginAt }, config.admin.jwtSecret, {
    expiresIn: `${config.admin.idleMinutes}m`,
  });
}

function setCookie(res, loginAt) {
  res.cookie(COOKIE, sign(loginAt || Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.env === "production",
    // ไม่ใส่ maxAge/expires โดยตั้งใจ = session cookie ปิดเบราว์เซอร์แล้วหาย
    path: "/",
  });
}

/* ตรวจโทเคนหนึ่งใบ คืน payload ถ้ายังใช้ได้ คืน null ถ้าหมดอายุ/ถูกแก้/เกินเพดานรวม */
function readToken(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  let p;
  try {
    p = jwt.verify(token, config.admin.jwtSecret);
  } catch {
    return null;                       // หมดอายุเพราะไม่ได้แตะนานเกิน idleMinutes
  }
  const loginAt = Number(p.lif) || 0;
  if (!loginAt) return null;           // โทเคนรุ่นเก่าก่อนแก้ระบบ ให้ล็อกอินใหม่
  if (Date.now() - loginAt > config.admin.absoluteHours * 3600_000) return null;
  return p;
}

function clearCookie(res) {
  res.clearCookie(COOKIE, { path: "/" });
}

async function verifyPassword(password) {
  if (!config.admin.passwordHash) {
    console.error("[auth] ยังไม่ได้ตั้ง ADMIN_PASSWORD_HASH — เข้าหลังบ้านไม่ได้");
    return false;
  }
  return bcrypt.compare(String(password || ""), config.admin.passwordHash);
}

/* ติดธงว่าคนเรียกเป็นแอดมินหรือไม่ ไม่บล็อกใคร ใช้ก่อน route ทั้งหมด
   เพื่อให้ endpoint ที่คนทั่วไปอ่านได้ รู้ว่าควรกรองเฉพาะที่เผยแพร่แล้วหรือไม่ */
function markAdmin(req, _res, next) {
  const p = readToken(req);
  req._isAdmin = !!p;
  req._session = p || null;
  next();
}

/* กันหน้าและ API ของหลังบ้าน — และต่ออายุให้ทุกครั้งที่ยังใช้งานอยู่ */
function requireAdmin(req, res, next) {
  const p = req._session || readToken(req);
  if (!p) {
    clearCookie(res);
    return deny(req, res);
  }
  req._isAdmin = true;
  req._session = p;
  // ต่ออายุแบบเลื่อนหน้าต่าง แต่ไม่เกินเพดานรวมที่ผูกไว้ใน lif
  setCookie(res, Number(p.lif));
  return next();
}

function deny(req, res) {
  // ต้องใช้ originalUrl ไม่ใช่ req.path เพราะใน sub-router ค่า req.path
  // จะถูกตัดส่วนที่ mount ออกไปแล้ว ("/api/leads" กลายเป็น "/")
  const url = req.originalUrl || req.url || "";
  if (url.startsWith("/api/")) {
    return res.status(401).json({ error: "หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่" });
  }
  return res.redirect("/admin/login.html?timeout=1");
}

/* กัน endpoint ที่ GitHub Actions เรียก */
function requireCron(req, res, next) {
  if (!config.cronToken) return res.status(503).json({ error: "ยังไม่ได้ตั้ง CRON_TOKEN" });
  const given = req.get("x-cron-token") || req.query.token || "";
  if (given !== config.cronToken) return res.status(401).json({ error: "โทเคนไม่ถูกต้อง" });
  next();
}

/* จำกัดจำนวนครั้งที่ลองรหัสผ่าน กันเดารหัส */
const attempts = new Map();
function loginLimiter(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const rec = attempts.get(ip) || { n: 0, until: 0 };
  if (rec.until > now) {
    return res.status(429).json({ error: "ลองผิดหลายครั้งเกินไป รออีกสักครู่แล้วลองใหม่" });
  }
  req._loginFail = () => {
    rec.n += 1;
    if (rec.n >= 6) {
      rec.n = 0;
      rec.until = now + 10 * 60 * 1000; // ล็อก 10 นาที
    }
    attempts.set(ip, rec);
  };
  req._loginOk = () => attempts.delete(ip);
  next();
}

module.exports = {
  COOKIE,
  readToken,
  setCookie,
  clearCookie,
  verifyPassword,
  markAdmin,
  requireAdmin,
  requireCron,
  loginLimiter,
};
