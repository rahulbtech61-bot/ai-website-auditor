import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

type AuditIssue = {
  severity: "critical" | "important" | "minor";
  category: string;
  message: string;
  why: string;
  recommendation: string;
  suggestedFix: string;
};

type PageAudit = {
  url: string;
  status: number | null;
  title: string;
  metaDescription: string;
  canonical: string;
  h1: string[];
  h2: string[];
  h3: string[];
  wordCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  linkCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
  hasViewport: boolean;
  hasFavicon: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  language: string;
  issues: AuditIssue[];
};

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(
      url.startsWith("http")
        ? url
        : `https://${url}`
    );

    return parsed.toString();
  } catch {
    return `https://${url}`;
  }
}

function cleanText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

async function fetchPage(url: string) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SiteAuditAI/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });

    const html = await response.text();

    return {
      html,
      status: response.status,
      finalUrl: response.url || url,
    };
  } catch {
    return {
      html: "",
      status: null,
      finalUrl: url,
    };
  }
}

function createIssue(
  severity: AuditIssue["severity"],
  category: string,
  message: string,
  why: string,
  recommendation: string,
  suggestedFix: string
): AuditIssue {
  return {
    severity,
    category,
    message,
    why,
    recommendation,
    suggestedFix,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body?.url) {
      return NextResponse.json(
        {
          success: false,
          error: "Website URL is required.",
        },
        { status: 400 }
      );
    }

    const startUrl = normalizeUrl(
      body.url.trim()
    );

    let parsedStartUrl: URL;

    try {
      parsedStartUrl = new URL(startUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid website URL.",
        },
        { status: 400 }
      );
    }

    const origin = parsedStartUrl.origin;
    const domain = parsedStartUrl.hostname;

    const maxPages = 10;

    const queue: string[] = [startUrl];
    const visited = new Set<string>();
    const discoveredLinks = new Set<string>();
    const pages: PageAudit[] = [];

    while (
      queue.length > 0 &&
      visited.size < maxPages
    ) {
      const currentUrl = queue.shift();

      if (!currentUrl) continue;

      let normalizedCurrent: string;

      try {
        const currentParsed =
          new URL(currentUrl);

        currentParsed.hash = "";

        normalizedCurrent =
          currentParsed.toString();
      } catch {
        continue;
      }

      if (visited.has(normalizedCurrent)) {
        continue;
      }

      visited.add(normalizedCurrent);

      const pageData =
        await fetchPage(normalizedCurrent);

      if (!pageData.html) {
        pages.push({
          url: normalizedCurrent,
          status: pageData.status,
          title: "",
          metaDescription: "",
          canonical: "",
          h1: [],
          h2: [],
          h3: [],
          wordCount: 0,
          imageCount: 0,
          imagesWithoutAlt: 0,
          linkCount: 0,
          internalLinkCount: 0,
          externalLinkCount: 0,
          hasViewport: false,
          hasFavicon: false,
          hasOpenGraph: false,
          hasTwitterCard: false,
          language: "",
          issues: [
            createIssue(
              "critical",
              "Technical",
              "Page could not be fetched successfully.",
              "Search engines and users may not be able to access this page reliably.",
              "Check the server response, DNS, SSL certificate, redirects and hosting configuration.",
              "Make sure the URL returns a successful HTTP response such as 200 OK."
            ),
          ],
        });

        continue;
      }

      const $ = cheerio.load(
        pageData.html
      );

      const title = cleanText(
        $("title").first().text()
      );

      const metaDescription = cleanText(
        $('meta[name="description"]')
          .attr("content") || ""
      );

      const canonical =
        $('link[rel="canonical"]')
          .attr("href") || "";

      const h1 = $("h1")
        .map((_, el) =>
          cleanText($(el).text())
        )
        .get();

      const h2 = $("h2")
        .map((_, el) =>
          cleanText($(el).text())
        )
        .get();

      const h3 = $("h3")
        .map((_, el) =>
          cleanText($(el).text())
        )
        .get();

      const bodyText = cleanText(
        $("body").text()
      );

      const wordCount =
        bodyText.length > 0
          ? bodyText.split(/\s+/).length
          : 0;

      const images = $("img");

      let imagesWithoutAlt = 0;

      images.each((_, el) => {
        const alt = $(el).attr("alt");

        if (
          !alt ||
          alt.trim().length === 0
        ) {
          imagesWithoutAlt++;
        }
      });

      const links = $("a[href]");

      let internalLinkCount = 0;
      let externalLinkCount = 0;

      links.each((_, el) => {
        const href = $(el).attr("href");

        if (!href) return;

        try {
          const absoluteUrl = new URL(
            href,
            normalizedCurrent
          );

          absoluteUrl.hash = "";

          const linkUrl =
            absoluteUrl.toString();

          discoveredLinks.add(linkUrl);

          if (
            absoluteUrl.hostname === domain
          ) {
            internalLinkCount++;

            if (
              !visited.has(linkUrl) &&
              queue.length < maxPages * 3 &&
              !queue.includes(linkUrl)
            ) {
              queue.push(linkUrl);
            }
          } else {
            externalLinkCount++;
          }
        } catch {
          // Ignore invalid links
        }
      });

      const hasViewport =
        $('meta[name="viewport"]')
          .length > 0;

      const hasFavicon =
        $('link[rel="icon"]').length > 0 ||
        $('link[rel="shortcut icon"]')
          .length > 0;

      const hasOpenGraph =
        $('meta[property^="og:"]')
          .length > 0;

      const hasTwitterCard =
        $('meta[name^="twitter:"]')
          .length > 0;

      const language =
        $("html").attr("lang") || "";

      const issues: AuditIssue[] = [];

      /*
       * TITLE
       */

      if (!title) {
        issues.push(
          createIssue(
            "critical",
            "SEO",
            "Page is missing a title tag.",
            "The title is one of the main signals used to understand the topic of a webpage and is also shown in browser tabs and search results.",
            "Add a unique, descriptive title for this page.",
            "Example: Primary Service | Brand Name | Location"
          )
        );
      } else if (title.length < 30) {
        issues.push(
          createIssue(
            "minor",
            "SEO",
            "Title tag is quite short.",
            "A very short title may not provide enough context about the page.",
            "Make the title more descriptive while keeping the main topic clear.",
            `Current title: "${title}". Expand it with the primary topic, service or brand context where appropriate.`
          )
        );
      } else if (title.length > 60) {
        issues.push(
          createIssue(
            "important",
            "SEO",
            "Title tag may be too long for search results.",
            "Long titles may be truncated in search result interfaces.",
            "Shorten the title and keep the most important information near the beginning.",
            `Current title length: ${title.length} characters. Aim for a concise title focused on the primary topic.`
          )
        );
      }

      /*
       * META DESCRIPTION
       */

      if (!metaDescription) {
        issues.push(
          createIssue(
            "important",
            "SEO",
            "Page is missing a meta description.",
            "A useful meta description helps search engines and users understand what the page is about.",
            "Write a unique description summarizing the page and its main value.",
            "Create a clear description of roughly 120–160 characters including the primary topic and a useful reason to visit the page."
          )
        );
      } else if (
        metaDescription.length > 160
      ) {
        issues.push(
          createIssue(
            "minor",
            "SEO",
            "Meta description may be too long.",
            "Long descriptions can be truncated in search results.",
            "Shorten the description while keeping the most important message.",
            `Current length: ${metaDescription.length} characters. Remove unnecessary words and keep the core value proposition.`
          )
        );
      } else if (
        metaDescription.length < 70
      ) {
        issues.push(
          createIssue(
            "minor",
            "SEO",
            "Meta description is quite short.",
            "A very short description may not fully explain the page's purpose.",
            "Expand the description with the main topic, service and useful user benefit.",
            `Current description: "${metaDescription}". Add more meaningful context without keyword stuffing.`
          )
        );
      }

      /*
       * H1
       */

      if (h1.length === 0) {
        issues.push(
          createIssue(
            "important",
            "SEO",
            "Page is missing an H1 heading.",
            "The H1 helps users and search engines understand the primary topic of the page.",
            "Add one clear primary H1 describing the main purpose of the page.",
            "Example: Main Service or Main Page Topic"
          )
        );
      }

      if (h1.length > 1) {
        issues.push(
          createIssue(
            "minor",
            "SEO",
            "Page contains multiple H1 headings.",
            "Multiple H1 elements can make the primary page topic less clear.",
            "Review the headings and keep one primary H1 where practical.",
            `Detected H1 headings: ${h1
              .slice(0, 3)
              .join(" | ")}`
          )
        );
      }

      /*
       * HEADING STRUCTURE
       */

      if (
        h1.length > 0 &&
        h2.length === 0 &&
        wordCount > 300
      ) {
        issues.push(
          createIssue(
            "minor",
            "Content",
            "The page has no H2 headings.",
            "Long content without section headings can be harder for users to scan.",
            "Break substantial content into logical sections using H2 and H3 headings.",
            "Identify the main sections of the page and give each section a descriptive H2."
          )
        );
      }

      /*
       * CANONICAL
       */

      if (!canonical) {
        issues.push(
          createIssue(
            "minor",
            "SEO",
            "Canonical URL was not detected.",
            "A canonical URL helps communicate the preferred version of a page when duplicate or similar URLs exist.",
            "Add a self-referencing canonical URL unless another canonical page is intentionally preferred.",
            `Example: <link rel="canonical" href="${normalizedCurrent}" />`
          )
        );
      }

      /*
       * IMAGE ALT
       */

      if (imagesWithoutAlt > 0) {
        issues.push(
          createIssue(
            "important",
            "Accessibility",
            `${imagesWithoutAlt} image(s) are missing alt text.`,
            "Missing alt text reduces accessibility and removes useful context for search engines and users who cannot see the image.",
            "Add meaningful alt text to informative images. Use empty alt text for purely decorative images.",
            "Example: <img src=\"service.jpg\" alt=\"Professional website audit service\" />"
          )
        );
      }

      /*
       * VIEWPORT
       */

      if (!hasViewport) {
        issues.push(
          createIssue(
            "important",
            "Mobile",
            "Viewport meta tag was not detected.",
            "Without a proper viewport configuration, pages may not display correctly on mobile devices.",
            "Add a responsive viewport meta tag.",
            'Add: <meta name="viewport" content="width=device-width, initial-scale=1" />'
          )
        );
      }

      /*
       * OPEN GRAPH
       */

      if (!hasOpenGraph) {
        issues.push(
          createIssue(
            "minor",
            "Social SEO",
            "Open Graph metadata was not detected.",
            "Social platforms may have less control over the title, description and image shown when the page is shared.",
            "Add Open Graph title, description, URL and image metadata.",
            'Add og:title, og:description, og:url and og:image metadata.'
          )
        );
      }

      /*
       * TWITTER/X CARD
       */

      if (!hasTwitterCard) {
        issues.push(
          createIssue(
            "minor",
            "Social SEO",
            "Twitter/X Card metadata was not detected.",
            "Social sharing previews may be less descriptive when the page is shared on supported platforms.",
            "Add Twitter/X Card metadata.",
            'Add twitter:card, twitter:title, twitter:description and twitter:image metadata.'
          )
        );
      }

      /*
       * LANGUAGE
       */

      if (!language) {
        issues.push(
          createIssue(
            "minor",
            "Accessibility",
            "HTML language attribute was not detected.",
            "The language attribute helps browsers and assistive technologies understand the primary language of the page.",
            "Add the correct language to the HTML element.",
            'Example: <html lang="en">'
          )
        );
      }

      /*
       * CONTENT
       */

      if (wordCount < 100) {
        issues.push(
          createIssue(
            "important",
            "Content",
            "Page has relatively little visible text content.",
            "Pages with very little useful content may not clearly communicate their purpose to users or search engines.",
            "Add useful, original content that directly answers the user's search intent.",
            `Only about ${wordCount} visible words were detected. Add relevant information, benefits, FAQs, service details or other genuinely useful content where appropriate.`
          )
        );
      }

      /*
       * INTERNAL LINKS
       */

      if (
        internalLinkCount === 0 &&
        pages.length > 1
      ) {
        issues.push(
          createIssue(
            "important",
            "SEO",
            "No internal links were detected on this page.",
            "Internal links help users navigate the website and help search engines discover related pages.",
            "Add relevant internal links between related pages.",
            "Link important pages from relevant sections using descriptive anchor text."
          )
        );
      }

      /*
       * EXTERNAL LINKS
       */

      if (
        externalLinkCount === 0 &&
        wordCount > 500
      ) {
        issues.push(
          createIssue(
            "minor",
            "Content",
            "No external references were detected on this page.",
            "Relevant authoritative references can sometimes improve the usefulness and credibility of informational content.",
            "Where appropriate, cite trustworthy external sources.",
            "Add relevant authoritative references only when they genuinely support the content."
          )
        );
      }

      /*
       * FAVICON
       */

      if (!hasFavicon) {
        issues.push(
          createIssue(
            "minor",
            "Technical",
            "Favicon was not detected.",
            "A favicon improves browser/tab identification and gives the website a more complete presentation.",
            "Add a favicon to the website.",
            'Add a favicon link such as <link rel="icon" href="/favicon.ico" />'
          )
        );
      }

      pages.push({
        url: normalizedCurrent,
        status: pageData.status,
        title,
        metaDescription,
        canonical,
        h1,
        h2,
        h3,
        wordCount,
        imageCount: images.length,
        imagesWithoutAlt,
        linkCount: links.length,
        internalLinkCount,
        externalLinkCount,
        hasViewport,
        hasFavicon,
        hasOpenGraph,
        hasTwitterCard,
        language,
        issues,
      });
    }

    /*
     * ROBOTS.TXT
     */

    let robotsExists = false;
    let robotsStatus: number | null =
      null;

    try {
      const robotsResponse = await fetch(
        `${origin}/robots.txt`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; SiteAuditAI/1.0)",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      robotsStatus =
        robotsResponse.status;

      robotsExists =
        robotsResponse.ok;
    } catch {
      robotsExists = false;
    }

    /*
     * SITEMAP
     */

    let sitemapExists = false;
    let sitemapStatus: number | null =
      null;

    const sitemapUrl =
      `${origin}/sitemap.xml`;

    try {
      const sitemapResponse =
        await fetch(sitemapUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; SiteAuditAI/1.0)",
          },
          signal: AbortSignal.timeout(10000),
        });

      sitemapStatus =
        sitemapResponse.status;

      sitemapExists =
        sitemapResponse.ok;
    } catch {
      sitemapExists = false;
    }

    /*
     * LOCATION SIGNALS
     */

    const locationValues =
      new Set<string>();

    for (const page of pages) {
      const locationRegex =
        /\b(Delhi|New Delhi|Mumbai|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Noida|Gurugram|Gurgaon|Faridabad|Ghaziabad|India|USA|United States|London|Dubai|Canada|Australia)\b/gi;

      const combined =
        `${page.title} ${page.metaDescription} ${page.h1.join(
          " "
        )}`;

      const matches =
        combined.match(locationRegex);

      if (matches) {
        matches.forEach((value) =>
          locationValues.add(value)
        );
      }
    }

    /*
     * BROKEN LINKS
     */

    const brokenLinks: {
      url: string;
      status: number;
    }[] = [];

    const linksToCheck = Array.from(
      discoveredLinks
    ).slice(0, 50);

    for (const link of linksToCheck) {
      try {
        const response = await fetch(
          link,
          {
            method: "HEAD",
            redirect: "follow",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; SiteAuditAI/1.0)",
            },
            signal:
              AbortSignal.timeout(8000),
          }
        );

        if (response.status >= 400) {
          brokenLinks.push({
            url: link,
            status: response.status,
          });
        }
      } catch {
        // Ignore inaccessible external links
      }
    }

    /*
     * SITE-WIDE TECHNICAL ISSUES
     */

    if (!robotsExists) {
      if (pages.length > 0) {
        pages[0].issues.push(
          createIssue(
            "important",
            "Technical SEO",
            "robots.txt was not detected.",
            "A robots.txt file can provide crawl instructions for search engine bots.",
            "Create a robots.txt file at the website root.",
            `Create: ${origin}/robots.txt and define appropriate crawl rules.`
          )
        );
      }
    }

    if (!sitemapExists) {
      if (pages.length > 0) {
        pages[0].issues.push(
          createIssue(
            "important",
            "Technical SEO",
            "XML sitemap was not detected.",
            "A sitemap helps search engines discover important website URLs.",
            "Create and publish an XML sitemap.",
            `Create: ${origin}/sitemap.xml and include the important canonical URLs.`
          )
        );
      }
    }

    /*
     * BROKEN LINK ISSUE
     */

    if (brokenLinks.length > 0) {
      if (pages.length > 0) {
        pages[0].issues.push(
          createIssue(
            "critical",
            "Technical",
            `${brokenLinks.length} broken link(s) were detected.`,
            "Broken links can create poor user experiences and prevent users or crawlers from reaching important resources.",
            "Review every broken URL and update, remove or redirect it as appropriate.",
            `Fix these URLs: ${brokenLinks
              .slice(0, 10)
              .map(
                (item) =>
                  `${item.url} (${item.status})`
              )
              .join(", ")}`
          )
        );
      }
    }

    /*
     * SITE SCORE
     */

    const allIssues =
      pages.flatMap(
        (page) => page.issues
      );

    const critical =
      allIssues.filter(
        (issue) =>
          issue.severity === "critical"
      ).length;

    const important =
      allIssues.filter(
        (issue) =>
          issue.severity === "important"
      ).length;

    const minor =
      allIssues.filter(
        (issue) =>
          issue.severity === "minor"
      ).length;

    const totalIssues =
      allIssues.length;

    const pageCount =
      pages.length || 1;

    const seoIssues =
      allIssues.filter(
        (issue) =>
          issue.category === "SEO" ||
          issue.category === "Social SEO" ||
          issue.category ===
            "Technical SEO"
      ).length;

    const contentIssues =
      allIssues.filter(
        (issue) =>
          issue.category === "Content"
      ).length;

    const technicalIssues =
      allIssues.filter(
        (issue) =>
          issue.category === "Technical" ||
          issue.category ===
            "Technical SEO" ||
          issue.category === "Mobile"
      ).length;

    const accessibilityIssues =
      allIssues.filter(
        (issue) =>
          issue.category ===
            "Accessibility" ||
          issue.category === "Mobile"
      ).length;

    const uxIssues =
      allIssues.filter(
        (issue) =>
          issue.category === "UX"
      ).length;

    function calculateScore(
      issueCount: number
    ) {
      return Math.max(
        0,
        Math.min(
          100,
          Math.round(
            100 -
              (issueCount /
                pageCount) *
                15
          )
        )
      );
    }

    let technicalScore =
      calculateScore(
        technicalIssues
      );

    if (!robotsExists) {
      technicalScore -= 5;
    }

    if (!sitemapExists) {
      technicalScore -= 5;
    }

    if (brokenLinks.length > 0) {
      technicalScore -= Math.min(
        15,
        brokenLinks.length
      );
    }

    technicalScore = Math.max(
      0,
      technicalScore
    );

    const seoScore =
      calculateScore(seoIssues);

    const contentScore =
      calculateScore(
        contentIssues
      );

    const accessibilityScore =
      calculateScore(
        accessibilityIssues
      );

    const uxScore =
      calculateScore(uxIssues);

    const overall = Math.round(
      seoScore * 0.3 +
        contentScore * 0.2 +
        technicalScore * 0.2 +
        accessibilityScore *
          0.15 +
        uxScore * 0.15
    );

    /*
     * SUMMARY
     */

    const recommendationCount =
      allIssues.length;

    return NextResponse.json({
      success: true,

      data: {
        website: {
          url: startUrl,
          domain,

          location: {
            detected:
              locationValues.size > 0,
            values:
              Array.from(
                locationValues
              ),
          },
        },

        crawler: {
          maxPages,
          pagesScanned:
            pages.length,
        },

        technicalFiles: {
          robots: {
            exists: robotsExists,
            status: robotsStatus,
          },

          sitemap: {
            exists: sitemapExists,
            status: sitemapStatus,
            url: sitemapUrl,
          },
        },

        brokenLinks,

        scores: {
          overall,
          seo: seoScore,
          content: contentScore,
          technical:
            technicalScore,
          accessibility:
            accessibilityScore,
          ux: uxScore,
        },

        summary: {
          pagesScanned:
            pages.length,
          totalIssues,
          critical,
          important,
          minor,
          brokenLinks:
            brokenLinks.length,
          recommendationCount,
        },

        pages,
      },
    });
  } catch (error) {
    console.error(
      "AUDIT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Website audit failed.",
      },
      { status: 500 }
    );
  }
}