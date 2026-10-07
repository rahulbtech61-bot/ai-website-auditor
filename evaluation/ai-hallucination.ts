import fs from "fs";

const websites = JSON.parse(
  fs.readFileSync("evaluation/websites.json", "utf-8")
);

const BASE_URL = "http://localhost:3000";

type AuditData = any;
type AIData = any;

function normalize(value: any): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isEmpty(value: any): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    value === false
  );
}

function getPageFacts(page: any) {
  return {
    url: page.url || "",
    title: page.title || "",
    metaDescription: page.metaDescription || "",
    canonical: page.canonical || "",
    h1Count: page.h1?.length ?? page.h1Count ?? 0,
    h2Count: page.h2?.length ?? page.h2Count ?? 0,
    h3Count: page.h3?.length ?? page.h3Count ?? 0,
    wordCount: page.wordCount ?? 0,
    imageCount: page.imageCount ?? 0,
    imagesWithoutAlt: page.imagesWithoutAlt ?? 0,
    linkCount: page.linkCount ?? 0,
    internalLinks: page.internalLinks ?? 0,
    externalLinks: page.externalLinks ?? 0,
    viewport: page.viewport || "",
    favicon: page.favicon || "",
    language: page.language || "",
  };
}

function getCrawlerContext(audit: AuditData) {
  const pages = (audit.pages || []).map(getPageFacts);

  return {
    website: {
      url: audit.website?.url || "",
      domain: audit.website?.domain || "",
      locationDetected:
        audit.website?.location?.detected ?? false,
      locations:
        audit.website?.location?.values || [],
    },

    crawler: {
      pagesScanned:
        audit.crawler?.pagesScanned ?? 0,
      maxPages:
        audit.crawler?.maxPages ?? 0,
    },

    technicalFiles: {
      robotsExists:
        audit.technicalFiles?.robots?.exists ?? false,
      robotsStatus:
        audit.technicalFiles?.robots?.status ?? null,

      sitemapExists:
        audit.technicalFiles?.sitemap?.exists ?? false,
      sitemapStatus:
        audit.technicalFiles?.sitemap?.status ?? null,
    },

    brokenLinks: audit.brokenLinks || [],

    summary: {
      totalIssues:
        audit.summary?.totalIssues ?? 0,
      critical:
        audit.summary?.critical ?? 0,
      important:
        audit.summary?.important ?? 0,
      minor:
        audit.summary?.minor ?? 0,
      brokenLinks:
        audit.summary?.brokenLinks ??
        audit.brokenLinks?.length ??
        0,
    },

    pages,
  };
}

function findPage(
  audit: AuditData,
  pageUrl: string
) {
  const wanted = normalize(pageUrl);

  return (audit.pages || []).find(
    (page: any) =>
      normalize(page.url) === wanted
  );
}

function checkEvidence(
  evidence: any,
  audit: AuditData
): boolean {
  if (!evidence) {
    return false;
  }

  const field = normalize(evidence.field);
  const value = evidence.value;

  if (!field) {
    return false;
  }

  /*
   * Website-level fields
   */

  if (
    field === "robots_exists" ||
    field === "robots.exists"
  ) {
    return (
      Boolean(
        audit.technicalFiles?.robots?.exists
      ) === Boolean(value)
    );
  }

  if (
    field === "sitemap_exists" ||
    field === "sitemap.exists"
  ) {
    return (
      Boolean(
        audit.technicalFiles?.sitemap?.exists
      ) === Boolean(value)
    );
  }

  if (
    field === "location_detected" ||
    field === "location.detected"
  ) {
    return (
      Boolean(
        audit.website?.location?.detected
      ) === Boolean(value)
    );
  }

  if (
    field === "pages_scanned" ||
    field === "crawler.pages_scanned"
  ) {
    return (
      Number(audit.crawler?.pagesScanned || 0) ===
      Number(value)
    );
  }

  if (
    field === "broken_links" ||
    field === "summary.broken_links"
  ) {
    return (
      Number(
        audit.summary?.brokenLinks ??
          audit.brokenLinks?.length ??
          0
      ) === Number(value)
    );
  }

  /*
   * Page-level fields
   */

  const pageUrl =
    evidence.page ||
    evidence.url ||
    "";

  if (pageUrl) {
    const page = findPage(
      audit,
      pageUrl
    );

    if (!page) {
      return false;
    }

    const pageFacts = getPageFacts(page);

    if (
      field === "title_exists" ||
      field === "title.exists"
    ) {
      return (
        Boolean(pageFacts.title) ===
        Boolean(value)
      );
    }

    if (
      field === "meta_description_exists" ||
      field === "meta.exists"
    ) {
      return (
        Boolean(pageFacts.metaDescription) ===
        Boolean(value)
      );
    }

    if (
      field === "canonical_exists" ||
      field === "canonical.exists"
    ) {
      return (
        Boolean(pageFacts.canonical) ===
        Boolean(value)
      );
    }

    if (
      field === "h1_count" ||
      field === "h1.count"
    ) {
      return (
        Number(pageFacts.h1Count) ===
        Number(value)
      );
    }

    if (
      field === "h2_count" ||
      field === "h2.count"
    ) {
      return (
        Number(pageFacts.h2Count) ===
        Number(value)
      );
    }

    if (
      field === "h3_count" ||
      field === "h3.count"
    ) {
      return (
        Number(pageFacts.h3Count) ===
        Number(value)
      );
    }

    if (
      field === "word_count" ||
      field === "content.word_count"
    ) {
      return (
        Number(pageFacts.wordCount) ===
        Number(value)
      );
    }

    if (
      field === "image_count" ||
      field === "images.count"
    ) {
      return (
        Number(pageFacts.imageCount) ===
        Number(value)
      );
    }

    if (
      field === "images_without_alt" ||
      field === "images_without_alt.count"
    ) {
      return (
        Number(pageFacts.imagesWithoutAlt) ===
        Number(value)
      );
    }

    if (
      field === "link_count" ||
      field === "links.count"
    ) {
      return (
        Number(pageFacts.linkCount) ===
        Number(value)
      );
    }

    if (
      field === "internal_links" ||
      field === "links.internal"
    ) {
      return (
        Number(pageFacts.internalLinks) ===
        Number(value)
      );
    }

    if (
      field === "external_links" ||
      field === "links.external"
    ) {
      return (
        Number(pageFacts.externalLinks) ===
        Number(value)
      );
    }

    if (field === "title") {
      return (
        normalize(pageFacts.title) ===
        normalize(value)
      );
    }

    if (
      field === "meta_description" ||
      field === "meta"
    ) {
      return (
        normalize(
          pageFacts.metaDescription
        ) === normalize(value)
      );
    }

    if (field === "canonical") {
      return (
        normalize(pageFacts.canonical) ===
        normalize(value)
      );
    }

    if (field === "viewport") {
      return (
        normalize(pageFacts.viewport) ===
        normalize(value)
      );
    }

    if (field === "favicon") {
      return (
        normalize(pageFacts.favicon) ===
        normalize(value)
      );
    }

    if (field === "language") {
      return (
        normalize(pageFacts.language) ===
        normalize(value)
      );
    }

    return false;
  }

  return false;
}

async function auditWebsite(url: string) {
  const response = await fetch(
    `${BASE_URL}/api/audit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.error || `Audit failed: ${response.status}`
    );
  }

  return data.data;
}

async function runAIAnalysis(
  auditData: AuditData
) {
  const response = await fetch(
    `${BASE_URL}/api/ai-audit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auditData,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.error ||
        `AI audit failed: ${response.status}`
    );
  }

  return data.data;
}

async function main() {
  let totalFactualClaims = 0;
  let supportedClaims = 0;
  let unsupportedClaims = 0;

  let totalRecommendations = 0;
  let failedWebsites = 0;

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "AI FACTUAL CLAIM EVALUATION"
  );
  console.log(
    "=============================================="
  );
  console.log(
    "Recommendations are NOT counted as hallucinations."
  );
  console.log("");

  for (const website of websites) {
    try {
      const auditData =
        await auditWebsite(website.url);

      const aiData =
        await runAIAnalysis(auditData);

      const factualObservations =
        Array.isArray(
          aiData?.factualObservations
        )
          ? aiData.factualObservations
          : [];

      let siteSupported = 0;
      let siteUnsupported = 0;

      for (const observation of factualObservations) {
        totalFactualClaims++;

        const supported =
          checkEvidence(
            observation.evidence,
            auditData
          );

        if (supported) {
          supportedClaims++;
          siteSupported++;
        } else {
          unsupportedClaims++;
          siteUnsupported++;
        }
      }

      const recommendationCount =
        (aiData?.priorityActions?.length || 0) +
        (aiData?.recommendations?.length || 0) +
        (aiData?.contentRecommendations
          ?.length || 0) +
        (aiData?.seoRecommendations
          ?.length || 0) +
        (aiData?.technicalRecommendations
          ?.length || 0) +
        (aiData?.pageImprovements
          ?.length || 0);

      totalRecommendations +=
        recommendationCount;

      const supportRate =
        factualObservations.length > 0
          ? (
              (siteSupported /
                factualObservations.length) *
              100
            ).toFixed(1)
          : "N/A";

      console.log(
        `${website.url}: ` +
          `${factualObservations.length} factual claims, ` +
          `${siteSupported} supported, ` +
          `${siteUnsupported} unsupported, ` +
          `support ${supportRate}%`
      );

      console.log(
        `  Recommendations excluded: ${recommendationCount}`
      );
    } catch (error: any) {
      failedWebsites++;

      console.log(
        `${website.url}: ERROR - ${error.message}`
      );
    }
  }

  const factualSupportRate =
    totalFactualClaims > 0
      ? (supportedClaims /
          totalFactualClaims) *
        100
      : 0;

  const factualHallucinationRate =
    totalFactualClaims > 0
      ? (unsupportedClaims /
          totalFactualClaims) *
        100
      : 0;

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "FINAL AI FACTUAL EVALUATION"
  );
  console.log(
    "=============================================="
  );

  console.log(
    `Websites tested: ${websites.length}`
  );

  console.log(
    `Successful websites: ${
      websites.length - failedWebsites
    }`
  );

  console.log(
    `Failed websites: ${failedWebsites}`
  );

  console.log(
    `Factual claims: ${totalFactualClaims}`
  );

  console.log(
    `Supported factual claims: ${supportedClaims}`
  );

  console.log(
    `Unsupported factual claims: ${unsupportedClaims}`
  );

  console.log(
    `Recommendations excluded: ${totalRecommendations}`
  );

  console.log(
    `Factual support rate: ${factualSupportRate.toFixed(
      1
    )}%`
  );

  console.log(
    `Factual hallucination rate: ${factualHallucinationRate.toFixed(
      1
    )}%`
  );

  console.log(
    "=============================================="
  );
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});