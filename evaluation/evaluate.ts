import fs from "fs";
import path from "path";

type Website = {
  id: string;
  url: string;
};

type GroundTruth = {
  siteId: string;
  checks: {
    title_exists: boolean;
    meta_description_exists: boolean;
    canonical_exists: boolean;
    robots_exists: boolean;
    sitemap_exists: boolean;
    h1_count: number;
    broken_links: number;
  };
};

type AuditData = {
  technicalFiles?: {
    robots?: {
      exists?: boolean;
    };
    sitemap?: {
      exists?: boolean;
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

const groundTruth: GroundTruth[] = JSON.parse(
  fs.readFileSync(
    path.join(evaluationDir, "ground-truth.json"),
    "utf-8"
  )
);

function calculateMetrics(
  actual: boolean[],
  predicted: boolean[]
) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (let i = 0; i < actual.length; i++) {
    if (actual[i] && predicted[i]) tp++;
    else if (!actual[i] && predicted[i]) fp++;
    else if (actual[i] && !predicted[i]) fn++;
    else tn++;
  }

  const positiveCases = tp + fn;

  const precision =
    tp + fp === 0
      ? null
      : tp / (tp + fp);

  const recall =
    tp + fn === 0
      ? null
      : tp / (tp + fn);

  const f1 =
    precision === null ||
    recall === null ||
    precision + recall === 0
      ? null
      : (2 * precision * recall) /
        (precision + recall);

  return {
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    f1,
    positiveCases,
  };
}

function percent(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}

async function auditWebsite(
  url: string
): Promise<AuditData | null> {
  try {
    const response = await fetch(
      "http://localhost:3000/api/audit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      }
    );

    if (!response.ok) {
      console.log(
        `Audit failed for ${url}: HTTP ${response.status}`
      );

      return null;
    }

    const data = await response.json();

    if (!data.success) {
      console.log(
        `Audit failed for ${url}`
      );

      return null;
    }

    return data.data;
  } catch {
    console.log(
      `Could not connect to auditor for ${url}`
    );

    return null;
  }
}

function getPredictions(
  audit: AuditData
) {
  const pages = audit.pages || [];
  const firstPage = pages[0];

  return {
    title_exists: Boolean(
      firstPage?.title &&
      firstPage.title.trim().length > 0
    ),

    meta_description_exists: Boolean(
      firstPage?.metaDescription &&
      firstPage.metaDescription.trim().length > 0
    ),

    canonical_exists: Boolean(
      firstPage?.canonical &&
      firstPage.canonical.trim().length > 0
    ),

    robots_exists: Boolean(
      audit.technicalFiles?.robots?.exists
    ),

    sitemap_exists: Boolean(
      audit.technicalFiles?.sitemap?.exists
    ),

    h1_count:
      firstPage?.h1?.length || 0,

    broken_links:
      audit.brokenLinks?.length || 0,
  };
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log("       SITEAUDIT BENCHMARK");
  console.log("========================================");
  console.log("");

  const booleanChecks = [
    "title_exists",
    "meta_description_exists",
    "canonical_exists",
    "robots_exists",
    "sitemap_exists",
  ] as const;

  const actualByCheck: Record<
    string,
    boolean[]
  > = {};

  const predictedByCheck: Record<
    string,
    boolean[]
  > = {};

  for (const check of booleanChecks) {
    actualByCheck[check] = [];
    predictedByCheck[check] = [];
  }

  const missedChecks: string[] = [];
  const falsePositiveChecks: string[] = [];

  let totalExpectedPages = 0;
  let totalScannedPages = 0;
  let testedSites = 0;

  for (const website of websites) {
    console.log(
      `Testing: ${website.url}`
    );

    const ground = groundTruth.find(
      (item) =>
        item.siteId === website.id
    );

    if (!ground) {
      console.log(
        `No ground truth found for ${website.id}`
      );
      continue;
    }

    const audit =
      await auditWebsite(website.url);

    if (!audit) {
      continue;
    }

    testedSites++;

    const prediction =
      getPredictions(audit);

    for (const check of booleanChecks) {
      const actual =
        ground.checks[check];

      const predicted =
        prediction[check];

      actualByCheck[check].push(
        actual
      );

      predictedByCheck[check].push(
        predicted
      );

      if (actual && !predicted) {
        missedChecks.push(
          `${website.id} → ${check}`
        );
      }

      if (!actual && predicted) {
        falsePositiveChecks.push(
          `${website.id} → ${check}`
        );
      }
    }

    const expectedH1 =
      ground.checks.h1_count;

    const predictedH1 =
      prediction.h1_count;

    if (expectedH1 !== predictedH1) {
      console.log(
        `⚠️ ${website.id} → H1 mismatch`
      );

      console.log(
        `   Expected: ${expectedH1}`
      );

      console.log(
        `   Predicted: ${predictedH1}`
      );
    }

    const expectedBrokenLinks =
      ground.checks.broken_links;

    const predictedBrokenLinks =
      prediction.broken_links;

    if (
      expectedBrokenLinks !==
      predictedBrokenLinks
    ) {
      console.log(
        `⚠️ ${website.id} → broken links mismatch`
      );

      console.log(
        `   Expected: ${expectedBrokenLinks}`
      );

      console.log(
        `   Predicted: ${predictedBrokenLinks}`
      );
    }

    const expectedPages = 1;

    const scannedPages =
      audit.crawler?.pagesScanned || 0;

    totalExpectedPages +=
      expectedPages;

    totalScannedPages += Math.min(
      scannedPages,
      expectedPages
    );
  }

  const allActual: boolean[] = [];
  const allPredicted: boolean[] = [];

  for (const check of booleanChecks) {
    allActual.push(
      ...actualByCheck[check]
    );

    allPredicted.push(
      ...predictedByCheck[check]
    );
  }

  const metrics =
    calculateMetrics(
      allActual,
      allPredicted
    );

  const coverage =
    totalExpectedPages === 0
      ? 0
      : totalScannedPages /
        totalExpectedPages;

  console.log("");
  console.log("CRAWLER");
  console.log("----------------------------------------");

  console.log(
    `Precision: ${percent(metrics.precision)}`
  );

  console.log(
    `Recall:    ${percent(metrics.recall)}`
  );

  console.log(
    `F1 Score:  ${percent(metrics.f1)}`
  );

  console.log(
    `Coverage:  ${percent(coverage)}`
  );

  console.log("");
  console.log("DETAILS");
  console.log("----------------------------------------");

  console.log(
    `Websites tested: ${testedSites}`
  );

  console.log(
    `True Positives:  ${metrics.tp}`
  );

  console.log(
    `False Positives: ${metrics.fp}`
  );

  console.log(
    `False Negatives: ${metrics.fn}`
  );

  console.log("");
  console.log("CHECK-BY-CHECK");
  console.log("----------------------------------------");

  for (const check of booleanChecks) {
    const result =
      calculateMetrics(
        actualByCheck[check],
        predictedByCheck[check]
      );

    console.log(
      `${check.padEnd(28)} F1: ${percent(result.f1)}`
    );
  }

  console.log("");
  console.log("NUMERIC CHECKS");
  console.log("----------------------------------------");

  console.log(
    "H1 count: evaluated"
  );

  console.log(
    "Broken links: evaluated"
  );

  console.log("");

  if (missedChecks.length > 0) {
    console.log("MISSED CHECKS");
    console.log("----------------------------------------");

    for (const item of missedChecks) {
      console.log(`❌ ${item}`);
    }

    console.log("");
  }

  if (
    falsePositiveChecks.length > 0
  ) {
    console.log("FALSE POSITIVES");
    console.log("----------------------------------------");

    for (
      const item of falsePositiveChecks
    ) {
      console.log(`⚠️ ${item}`);
    }

    console.log("");
  }

  if (
    missedChecks.length === 0 &&
    falsePositiveChecks.length === 0
  ) {
    console.log(
      "No boolean missed checks or false positives."
    );

    console.log("");
  }

  console.log(
    "========================================"
  );

  console.log(
    "       EVALUATION COMPLETE"
  );

  console.log(
    "========================================"
  );

  console.log("");
}

main();