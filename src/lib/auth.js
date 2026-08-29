"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");

const COOKIE = "at_session";

function sign() {
  return jwt.sign({ role: "admin" }, config.admin.jwtSecret, {
    expiresIn: `${config.admin.sessionDays}d`,
  });
}

function setCookie(res) {
  res.cookie(COOKIE, sign(), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.env === "production",
    maxAge: config.admin.sessionDays * 24 * 60 * 60 * 1000,
    path: "/",
  });
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
  req._isAdmin = false;
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      jwt.verify(token, config.admin.jwtSecret);
      req._isAdmin = true;
    } catch { /* คุกกี้หมดอายุหรือถูกแก้ ถือว่าไม่ใช่แอดมิน */ }
  }
  next();
}

/* กันหน้าและ API ของหลังบ้าน */
function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return deny(req, res);
  try {
    jwt.verify(token, config.admin.jwtSecret);
    return next();
  } catch {
    return deny(req, res);
  }
}

function deny(req, res) {
  // ต้องใช้ originalUrl ไม่ใช่ req.path เพราะใน sub-router ค่า req.path
  // จะถูกตัดส่วนที่ mount ออกไปแล้ว ("/api/leads" กลายเป็น "/")
  const url = req.originalUrl || req.url || "";
  if (url.startsWith("/api/")) {
    return res.status(401).json({ error: "ต้องเข้าสู่ระบบก่อน" });
  }
  return res.redirect("/admin/login.html");
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
  setCookie,
  clearCookie,
  verifyPassword,
  markAdmin,
  requireAdmin,
  requireCron,
  loginLimiter,
};
