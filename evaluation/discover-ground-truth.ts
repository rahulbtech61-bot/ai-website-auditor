import fs from "fs";
import path from "path";

type Website = {
  id: string;
  url: string;
};

type AuditData = {
  technicalFiles?: {
    robots?: {
      exists?: boolean;
      status?: number;
    };
    sitemap?: {
      exists?: boolean;
      status?: number;
    };
  };

  brokenLinks?: unknown[];

  pages?: Array<{
    title?: string;
    metaDescription?: string;
    canonical?: string;
    h1?: string[];
  }>;

  crawler?: {
    pagesScanned?: number;
    maxPages?: number;
  };
};

const evaluationDir = path.join(
  process.cwd(),
  "evaluation"
);

const websites: Website[] = JSON.parse(
  fs.readFileSync(
    path.join(evaluationDir, "websites.json"),
    "utf-8"
  )
);

async function auditWebsite(
  url: string
): Promise<AuditData | null> {
  try {
    const response = await fetch(
      "http://localhost:3000/api/audit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      }
    );

    if (!response.ok) {
      console.log(
        `HTTP ${response.status}`
      );

      return null;
    }

    const data = await response.json();

    if (!data.success) {
      return null;
    }

    return data.data;
  } catch {
    return null;
  }
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log("     GROUND TRUTH DISCOVERY");
  console.log("========================================");
  console.log("");

  for (const website of websites) {
    console.log("----------------------------------------");
    console.log(`${website.id}: ${website.url}`);
    console.log("----------------------------------------");

    const audit =
      await auditWebsite(website.url);

    if (!audit) {
      console.log("❌ Audit failed");
      console.log("");
      continue;
    }

    const page =
      audit.pages?.[0];

    const titleExists =
      Boolean(
        page?.title &&
        page.title.trim().length > 0
      );

    const metaExists =
      Boolean(
        page?.metaDescription &&
        page.metaDescription.trim().length > 0
      );

    const canonicalExists =
      Boolean(
        page?.canonical &&
        page.canonical.trim().length > 0
      );

    const robotsExists =
      Boolean(
        audit.technicalFiles?.robots?.exists
      );

    const sitemapExists =
      Boolean(
        audit.technicalFiles?.sitemap?.exists
      );

    const h1Count =
      page?.h1?.length || 0;

    const brokenLinks =
      audit.brokenLinks?.length || 0;

    console.log(
      `Title:            ${titleExists ? "YES" : "NO"}`
    );

    console.log(
      `Meta Description: ${metaExists ? "YES" : "NO"}`
    );

    console.log(
      `Canonical:        ${canonicalExists ? "YES" : "NO"}`
    );

    console.log(
      `Robots.txt:       ${robotsExists ? "YES" : "NO"}`
    );

    console.log(
      `Sitemap:          ${sitemapExists ? "YES" : "NO"}`
    );

    console.log(
      `H1 Count:         ${h1Count}`
    );

    console.log(
      `Broken Links:     ${brokenLinks}`
    );

    console.log(
      `Pages Scanned:    ${audit.crawler?.pagesScanned || 0}`
    );

    console.log("");
  }

  console.log("========================================");
  console.log("       DISCOVERY COMPLETE");
  console.log("========================================");
  console.log("");
}

main();