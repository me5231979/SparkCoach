import { headers } from "next/headers";
import { AI_MODELS, aiSettings, encryptionReady, listBrandDocs, listPeople, pendingInvites } from "@spark/db";
import { AiSettings } from "./AiSettings";
import { requireCtx } from "../../../lib/session";
import { invite, saveDomains } from "./actions";
import { BrandKit } from "./BrandKit";

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; invite?: string; for?: string }> }) {
  const c = await requireCtx("admin");
  const sp = await searchParams;
  const [people, invites, docs, ai] = await Promise.all([listPeople(c.org.id), pendingInvites(c.org.id), listBrandDocs(c.org.id), aiSettings(c.org.id)]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <>
      <h1>Settings · {c.org.name}</h1>
      {sp.error && <p className="error" role="alert">{sp.error}</p>}
      {sp.saved && <p className="ok" role="status">Saved.</p>}

      <h2>AI</h2>
      <AiSettings keyHint={ai?.keyHint ?? null} model={ai?.model ?? null} models={AI_MODELS} managed={!!ai?.features.managedAi} encryption={encryptionReady()} />

      <h2>Brand kit</h2>
      <BrandKit initial={c.org.branding} docs={docs} />

      <h2>Approved systems</h2>
      <form action={saveDomains} className="card">
        <p className="muted">The web systems your coaches may run on. The extension only works on these exact hosts, nowhere else.</p>
        <label htmlFor="domains">Hosts (one per line)</label>
        <textarea id="domains" name="domains" rows={4} defaultValue={c.org.approvedDomains.join("\n")} placeholder={"hr.example.com\nerp.example.com"} style={{ fontFamily: "inherit" }} />
        <p><button className="primary">Save systems</button></p>
      </form>

      <h2 id="people">People</h2>
      {sp.invite && (
        <div className="ok" role="status">Send this invite link to {sp.for}. It works once and expires in 14 days:
          <input readOnly value={`${origin}/invite/${sp.invite}`} aria-label="Invite link" style={{ marginTop: 6 }} /></div>
      )}
      <form action={invite} className="card">
        <div className="grid2">
          <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
          <div><label>Roles</label>
            <div className="row">{[["author", "Author (makes coaches)"], ["manager", "Manager (sees Insight)"], ["admin", "Admin"]].map(([v, l]) => (
              <label key={v} className="row" style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" name="roles" value={v} /> {l}</label>))}</div>
            <p className="muted">Everyone is a learner.</p></div>
        </div>
        <button className="primary">Create invite link</button>
      </form>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Roles</th></tr></thead>
        <tbody>
          {people.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.email}</td><td className="muted">{p.roles.join(", ")}</td></tr>)}
          {invites.map((i) => <tr key={i.email}><td className="muted">Invited</td><td>{i.email}</td><td className="muted">{i.roles.join(", ")}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}
