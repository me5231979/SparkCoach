import type { ReactNode } from "react";
import { BrandMark, ThemeStyle } from "../../lib/theme";
import { requireCtx } from "../../lib/session";
import { leaveOrg } from "./operator/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const c = await requireCtx();
  return (
    <>
      <ThemeStyle branding={c.org.branding} />
      <header className="top">
        <div className="wrap">
          <BrandMark branding={c.org.branding} />
          <nav aria-label="Main">
            {c.can("author") && <a href="/studio">Studio</a>}
            {c.can("manager") && <a href="/insight">Insight</a>}
            {c.can("admin") && <a href="/settings">Settings</a>}
            <a href="/welcome">Get the extension</a>
            {c.can("operator") && <a href="/operator">Customers</a>}
          </nav>
          <span className="muted">{c.org.name}</span>
          {c.acting && <form action={leaveOrg}><button title="Back to your own company">Leave</button></form>}
          <form action="/logout" method="post"><button>Sign out</button></form>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
