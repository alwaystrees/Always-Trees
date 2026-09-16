"use strict";
/* ------------------------------------------------------------------
   เทสต์สมุดเงิน — ตรวจว่าเลขเงินถูกต้องจริงในเบราว์เซอร์จริง
   รันด้วย  node test/ledger.js   (จะเปิดเซิร์ฟเวอร์ทดสอบให้เอง)
-------------------------------------------------------------------*/
const { spawn } = require("child_process");
const path = require("path");
const PORT = process.env.TEST_PORT || 4322;
const BASE = "http://127.0.0.1:" + PORT;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function up() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(BASE + "/api/health"); if (r.ok) return true; } catch (e) {}
    await wait(400);
  }
  return false;
}
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "serve.js")],
    { stdio: "ignore", env: Object.assign({}, process.env, { PORT: String(PORT) }) });
  const stop = () => { try { srv.kill(); } catch (e) {} };
  process.on("exit", stop);
  if (!await up()) { console.log("เปิดเซิร์ฟเวอร์ทดสอบไม่สำเร็จ"); stop(); process.exit(1); }
  try { await run(); } finally { stop(); }
})();

async function run() {
const { chromium } = require(process.env.PW || '/opt/node-tools/node_modules/playwright-core');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: 'light' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto(BASE + '/admin/login.html', { waitUntil: 'domcontentloaded' });
await p.fill('#pw', 'test1234test'); await p.click('#go'); await p.waitForTimeout(2500);

const r = await p.evaluate(() => {
  const out = [], ok = (name, got, want) => out.push({ name, got, want, pass: Math.abs(got - want) < 0.51 });
  if (!DB.items.length) seed();
  // ลูกค้า + งาน
  const c = { id: 'c_t', name: 'คุณทดสอบ', addr: '', phone: '', note: '' };
  DB.customers.push(c);
  const j = { id: 'j_t', customerId: c.id, title: 'สวนหน้าบ้านทดสอบ', status: 'ยืนยันงาน' };
  DB.jobs.push(j);
  // ใบแจ้งหนี้ 100,000 ไม่มี VAT ไม่หัก ณ ที่จ่าย เพื่อให้ตัวเลขตรวจง่าย
  const mk = (type, amt, refs) => {
    const d = { id: 'd_' + type + Math.random().toString(36).slice(2,6), type, no: type + '-TEST-' + Math.floor(Math.random()*1e4),
      date: todayISO(), due: todayISO(), status: 'draft', customerId: c.id, jobId: j.id, subject: 'ทดสอบ',
      vatMode: 'none', whtMode: 'none', lines: [{ id: 'l1', lvl: 1, desc: 'งานทดสอบ', unit: 'งาน', qty: 1, pm: amt, pl: 0, cm: 0, cl: 0, mk: 0 }],
      extras: [], terms: [], refs: refs || [] };
    DB.docs.push(d); return d;
  };
  const iv = mk('IV', 100000);
  ok('ยอดตามเอกสาร', calcDoc(iv).net, 100000);
  ok('ยังไม่จ่าย คงเหลือเต็มจำนวน', docBalance(iv), 100000);

  // รับชำระบางส่วน
  DB.pays.push({ id: 'p1', date: todayISO(), kind: 'in', docId: iv.id, custId: c.id, jobId: j.id, amount: 30000, wht: 0, fee: 0, method: 'transfer' });
  ok('รับบางส่วนแล้ว คงเหลือ', docBalance(iv), 70000);
  ok('ค้างรับรวมทั้งระบบ', totalDue(d => d.customerId === c.id), 70000);

  // ภาษีที่ลูกค้าหักไว้ นับเป็นชำระแล้ว แต่ไม่ใช่เงินเข้า
  DB.pays.push({ id: 'p2', date: todayISO(), kind: 'in', docId: iv.id, custId: c.id, jobId: j.id, amount: 19000, wht: 1000, fee: 0, method: 'transfer' });
  ok('ภาษีที่ลูกค้าหักนับเป็นชำระแล้ว', docBalance(iv), 50000);

  // มัดจำ: รับล่วงหน้า แล้วหักเข้าใบ
  DB.pays.push({ id: 'p3', date: todayISO(), kind: 'deposit', docId: '', custId: c.id, jobId: j.id, amount: 20000, wht: 0, fee: 0, method: 'cash' });
  ok('มัดจำคงเหลือ', depBalance(c.id, j.id), 20000);
  DB.pays.push({ id: 'p4', date: todayISO(), kind: 'apply', docId: iv.id, custId: c.id, jobId: j.id, amount: 20000, wht: 0, fee: 0, method: '' });
  ok('หักมัดจำแล้ว มัดจำเหลือ 0', depBalance(c.id, j.id), 0);
  ok('หักมัดจำแล้ว คงเหลือในใบ', docBalance(iv), 30000);

  // ใบลดหนี้ 10,000
  const cn = mk('CN', 10000, [iv.id]);
  ok('ใบลดหนี้ลดยอดที่ต้องเก็บ', docBalance(iv), 20000);

  // ยกเลิกใบลดหนี้ → ยอดกลับ
  cn.status = 'void';
  ok('ใบลดหนี้ที่ยกเลิกไม่ถูกนับ', docBalance(iv), 30000);
  cn.status = 'draft';

  // เงินเข้าจริง ไม่รวมภาษีที่ลูกค้าหัก และหักค่าธรรมเนียม
  ok('เงินเข้าจริง', cashIn(todayISO(), todayISO()), 30000 + 19000 + 20000);

  // แปลงเป็นใบกำกับ: ใบเดิมต้องไม่ถูกนับซ้ำ
  const tx = mk('TX', 100000, [iv.id]);
  ok('ใบเดิมถูกต่อยอดแล้ว ไม่นับซ้ำ', docBalance(iv), 0);
  ok('ยอดค้างย้ายไปใบใหม่', docBalance(tx), 100000);
  tx.status = 'void';
  ok('ใบที่ยกเลิกไม่มียอดค้าง', docBalance(tx), 0);
  ok('ใบเดิมกลับมามียอดค้างเมื่อใบใหม่ถูกยกเลิก', docBalance(iv), 20000);
  DB.docs = DB.docs.filter(x => x.id !== tx.id);

  // งวดชำระ
  iv.terms = [
    { id: 't1', name: 'งวดที่ 1', amount: 50000, cond: '', due: todayISO() },
    { id: 't2', name: 'งวดที่ 2', amount: 30000, cond: '', due: todayISO() },
    { id: 't3', name: 'งวดที่ 3', amount: 20000, cond: '', due: todayISO() }
  ];
  const st = termStatus(iv);   // เก็บมาแล้ว 80,000 (30k+20k+20k มัดจำ+10k ลดหนี้)
  out.push({ name: 'งวดที่ 1 ครบแล้ว', got: st[0].full ? 1 : 0, want: 1, pass: st[0].full });
  out.push({ name: 'งวดที่ 2 ครบแล้ว', got: st[1].full ? 1 : 0, want: 1, pass: st[1].full });
  out.push({ name: 'งวดที่ 3 ยังไม่ครบ', got: st[2].left, want: 20000, pass: Math.abs(st[2].left - 20000) < 0.51 });
  return out;
});

let fail = 0;
for (const t of r) { if (!t.pass) fail++; console.log((t.pass ? '  ผ่าน  ' : '  ตก    ') + t.name + '  (ได้ ' + t.got + ' ควรได้ ' + t.want + ')'); }
if (errs.length) { console.log('\nJS error:', errs.slice(0,3)); fail++; }
console.log('\n  ผ่าน ' + (r.length - fail) + ' · ตก ' + fail);
await b.close();
process.exit(fail ? 1 : 0);
}
