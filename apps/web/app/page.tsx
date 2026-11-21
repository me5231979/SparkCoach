import { redirect } from "next/navigation";
import { isSetUp } from "@spark/db";
import { currentUser } from "../lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!process.env.DATABASE_URL) return <main className="narrow"><h1>Spark</h1><p>The database isn't configured yet.</p></main>;
  if (!(await isSetUp())) redirect("/setup");
  redirect((await currentUser()) ? "/studio" : "/login");
}
