import { LEVELS } from "@spark/core";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "64px auto", padding: "0 16px" }}>
      <h1>Spark</h1>
      <p>Build coaches that teach your people your own processes, in your own systems, with help that fades as they learn.</p>
      <p>Studio, Insight and Admin are coming soon.</p>
      <ul>{Object.values(LEVELS).map((l) => <li key={l.name}><b>{l.name}</b>: {l.says}</li>)}</ul>
    </main>
  );
}
