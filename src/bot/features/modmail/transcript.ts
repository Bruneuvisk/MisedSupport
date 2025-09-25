import type { MailMessage } from "./types.js";

export function transcriptHtml(guildName: string, userTag: string, messages: MailMessage[]) {
  const esc = (s = "") => s.replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]!));
  const rows = messages.map(m => {
    const who = m.from === "user" ? "Usuário" : m.from === "staff" ? "Staff" : "Sistema";
    const time = new Date(m.createdAt).toLocaleString();
    const text = esc(m.content || "");
    const atts = (m.attachments || [])
      .map(a => `<div class="att"><a href="${esc(a.url)}" target="_blank">${esc(a.name)}</a></div>`).join("");
    return `<div class="msg ${m.from}">
      <div class="meta"><b>${who}</b> • ${time}</div>
      ${text ? `<div class="content">${text}</div>` : ""}
      ${atts}
    </div>`;
  }).join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>ModMail Transcript - ${esc(userTag)}</title>
<style>
body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;background:#0b0e12;color:#e7e7e7;margin:24px}
.header{margin-bottom:16px}
.msg{padding:12px;border-radius:8px;background:#12161d;margin:10px 0}
.msg.user{border-left:4px solid #31c48d}
.msg.staff{border-left:4px solid #60a5fa}
.msg.system{border-left:4px solid #fbbf24}
.meta{opacity:.8;font-size:12px;margin-bottom:6px}
.content{white-space:pre-wrap}
.att a{color:#60a5fa;text-decoration:none}
</style>
</head>
<body>
  <div class="header">
    <h2>ModMail Transcript</h2>
    <div>Servidor: <b>${esc(guildName)}</b></div>
    <div>Usuário: <b>${esc(userTag)}</b></div>
    <div>Mensagens: ${messages.length}</div>
  </div>
  ${rows}
</body></html>`;
}
