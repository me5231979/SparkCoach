// A small mock enterprise web app ("Records") for CI. It mimics common patterns: a list with repeated row buttons,
// a record page with sections, a modal dialog with labelled fields and a select, and a success banner.
// No framework, no network. Every page carries fake personal data (see data.mjs).
import { createServer } from "node:http";
import { RECORDS } from "./data.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} · Records</title>
<style>
 body{font:14px system-ui,sans-serif;margin:0;background:#f4f5f7;color:#1b1d22} header{background:#24324a;color:#fff;padding:10px 16px}
 main{padding:16px;max-width:900px} table{border-collapse:collapse;width:100%;background:#fff} td,th{border:1px solid #dde;padding:6px 8px;text-align:left}
 section{background:#fff;border:1px solid #dde;border-radius:6px;padding:12px;margin:12px 0} button{padding:6px 10px;margin-right:6px}
 [role=dialog]{position:fixed;inset:60px auto auto 50%;transform:translateX(-50%);background:#fff;border:1px solid #889;border-radius:8px;padding:16px;width:420px;box-shadow:0 10px 40px #0004}
 label{display:block;margin:8px 0 2px} input,select{width:100%;padding:6px} .banner{background:#dff5e3;border:1px solid #7c9;padding:8px;border-radius:6px}
</style></head><body><header>Records</header><main>${body}</main></body></html>`;

function list() {
  const rows = RECORDS.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.ssn)}</td><td>${esc(r.salary)}</td><td>${esc(r.owner)}</td>
    <td><button type="button" onclick="location.href='/records/${r.id}'">View</button></td></tr>`).join("");
  return page("Records", `<section aria-labelledby="h"><h1 id="h">Records</h1>
    <table><thead><tr><th>Name</th><th>SSN</th><th>Salary</th><th>Owner</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

function record(r) {
  return page(r.name, `
  <section aria-labelledby="d"><h2 id="d">Details</h2>
    <p>Name: <span class="cell">${esc(r.name)}</span></p><p>SSN: ${esc(r.ssn)}</p><p>Salary: ${esc(r.salary)}</p>
    <p>Email: ${esc(r.email)}</p><p>Note: ${esc(r.note)}</p>
    <label for="nick">Preferred name</label><input id="nick" value="${esc(r.name)}">
    <button type="button" id="edit">Edit Details</button>
  </section>
  <section aria-labelledby="o"><h2 id="o">Owner</h2><p>Current owner: ${esc(r.owner)}</p>
    <button type="button" id="change">Change Owner</button></section>
  <div id="banner"></div>
  <div role="dialog" aria-modal="true" aria-labelledby="dlg" id="dialog" hidden>
    <h2 id="dlg">Change Owner</h2>
    <form id="f">
      <label for="eff">Effective Date</label><input id="eff" type="date">
      <label for="reason">Reason</label>
      <select id="reason"><option value="">Choose a reason</option><option value="REASSIGN">Reassignment</option><option value="LEAVE">Leave</option></select>
      <label for="owner">New Owner</label><input id="owner" type="text" autocomplete="off">
      <p><button type="submit">Submit</button><button type="button" id="cancel">Cancel</button></p>
    </form>
  </div>
  <script>
    const d = document.getElementById("dialog");
    document.getElementById("change").onclick = () => { d.hidden = false; };
    document.getElementById("cancel").onclick = () => { d.hidden = true; };
    document.getElementById("f").onsubmit = (e) => {
      e.preventDefault();
      setTimeout(() => { d.hidden = true; const b = document.getElementById("banner"); b.className = "banner"; b.setAttribute("role", "status"); b.textContent = "Change submitted for ${esc(r.name)}."; }, 200);
    };
  </script>`);
}

export function start(port = Number(process.env.PORT) || 4310) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const send = (code, html) => { res.writeHead(code, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); res.end(html); };
    if (url.pathname === "/" || url.pathname === "/records") return send(200, list());
    const m = url.pathname.match(/^\/records\/(\d+)$/);
    const r = m && RECORDS.find((x) => x.id === m[1]);
    if (r) return send(200, record(r));
    send(404, page("Not found", "<p>Not found</p>"));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) start().then(() => console.log("Records fixture on http://localhost:4310"));
