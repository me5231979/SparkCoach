import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Spark", description: "Make and deploy coaches for your own processes." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
