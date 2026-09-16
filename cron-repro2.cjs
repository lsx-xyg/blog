const fs = require("fs");
const postgres = require("postgres");
const crypto = require("crypto");
(async () => {
  const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const encKey = process.env.ENC; // 外部传入
  const keyBuf = Buffer.from(encKey, "base64");
  const decrypt = (ciphertext) => {
    const [iv, data, tag] = ciphertext.split(":");
    const d = crypto.createDecipheriv("aes-256-gcm", keyBuf, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  };
  const client = postgres(env.DATABASE_URL_UNPOOLED);
  const rows = await client`SELECT key, value FROM settings WHERE key IN ('cron.job_api_key','cron.secret')`;
  await client.end({ timeout: 3 });
  const get = (k) => { const r = rows.find(x => x.key === k); return r ? decrypt(r.value) : null; };
  const apiKey = get("cron.job_api_key");
  const secret = get("cron.secret");
  console.log("解密后 jobApiKey 长度:", apiKey.length, "前缀:", apiKey.slice(0, 5));
  console.log("解密后 secret 长度:", secret.length);
  console.log("--- 直连 cron-job.org /jobs ---");
  const r = await fetch("https://api.cron-job.org/jobs", { headers: { Authorization: `Bearer ${apiKey}` } });
  const t = await r.text();
  console.log("HTTP", r.status, "体:", t.slice(0, 300));
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
