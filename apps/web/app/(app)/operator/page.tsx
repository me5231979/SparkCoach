import { headers } from "next/headers";
import { listOrgs } from "@spark/db";
import { requireCtx } from "../../../lib/session";
import { addCustomer, openOrg, savePlan } from "./actions";

export default async function Operator({ searchParams }: { searchParams: Promise<{ error?: string; invite?: string; for?: string }> }) {
  await requireCtx("operator");
  const { error, invite, for: who } = await searchParams;
  const orgs = await listOrgs();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <>
      <h1>Customers</h1>
      <p className="muted">Each customer gets their own walled-off space: their coaches, people, brand kit and records.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {invite && (
        <div className="ok" role="status">
          Send this invite link to {who}. It works once and expires in 14 days:
          <input readOnly value={`${origin}/invite/${invite}`} aria-label="Invite link" style={{ marginTop: 6 }} />
        </div>
      )}
      <form action={addCustomer} className="card">
        <h2 style={{ marginTop: 0 }}>Add a customer</h2>
        <div className="grid2">
          <div><label htmlFor="name">Company name</label><input id="name" name="name" required /></div>
          <div><label htmlFor="adminEmail">Their admin's email (optional)</label><input id="adminEmail" name="adminEmail" type="email" /></div>
        </div>
        <p><button className="primary">Add customer</button></p>
      </form>
      <table>
        <thead><tr><th>Company</th><th>Systems</th><th>AI</th><th>Plan and add-ons</th><th></th></tr></thead>
        <tbody>
          {orgs.map((o) => (
            <tr key={o.id}>
              <td>{o.name}{o.isOperator && <span className="pill" style={{ marginLeft: 8 }}>You</span>}</td>
              <td className="muted">{o.approvedDomains.join(", ") || "None yet"}</td>
              <td className="muted">{o.aiKeyHint ? "Own key" : o.features.managedAi ? "Managed AI" : "No key"}</td>
              <td>{!o.isOperator && (
                <form action={savePlan} className="row">
                  <input type="hidden" name="orgId" value={o.id} />
                  <select name="plan" defaultValue={o.plan} aria-label="Plan" style={{ width: "auto" }}>
                    <option value="platform">Platform (self-serve)</option><option value="managed">Managed (we build &amp; run)</option><option value="pilot">Pilot</option>
                  </select>
                  {([["managedAi", "Managed AI"], ["reports", "Reports"], ["whiteLabel", "White label"]] as const).map(([k, l]) => (
                    <label key={k} className="row" style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" name={k} defaultChecked={!!o.features[k]} /> {l}</label>
                  ))}
                  <button>Save</button>
                </form>
              )}</td>
              <td>{!o.isOperator && <form action={openOrg}><input type="hidden" name="orgId" value={o.id} /><button>Open</button></form>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
