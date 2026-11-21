import type { ReactNode } from "react";

export const metadata = { title: "Spark by Matchlight", description: "Build screen-aware coaches for your own processes." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f7f7f8", color: "#1a1a1a" }}>{children}</body>
    </html>
  );
}
