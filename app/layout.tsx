import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteAudit AI",
  description:
    "AI powered website auditing and SEO analysis platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}