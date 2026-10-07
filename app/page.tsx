"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuditResult = any;
type AIResult = any;

type HistoryItem = {
  id: string;
  domain: string;
  url: string;
  score: number;
  date: string;
  auditData: AuditResult;
  aiResult: AIResult | null;
};

export default function Home() {
  const [url, setUrl] = useState("");

  const [result, setResult] =
    useState<AuditResult | null>(null);

  const [aiResult, setAiResult] =
    useState<AIResult | null>(null);

  const [history, setHistory] =
    useState<HistoryItem[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [activePage, setActivePage] =
    useState("dashboard");

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          "siteaudit-history"
        );

      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error(
        "History load error:",
        error
      );
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "siteaudit-history",
        JSON.stringify(history)
      );
    } catch (error) {
      console.error(
        "History save error:",
        error
      );
    }
  }, [history]);

  const dashboardStats =
    useMemo(() => {
      if (history.length === 0) {
        return {
          audits: 0,
          average: 0,
          highest: 0,
          lowest: 0,
        };
      }

      const scores =
        history.map(
          (item) => item.score
        );

      const average = Math.round(
        scores.reduce(
          (a, b) => a + b,
          0
        ) / scores.length
      );

      return {
        audits: history.length,
        average,
        highest: Math.max(...scores),
        lowest: Math.min(...scores),
      };
    }, [history]);

  async function handleAnalyze(
    e?: FormEvent
  ) {
    e?.preventDefault();

    if (!url.trim()) {
      setError(
        "Please enter a website URL."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setAiResult(null);

    try {
      const response = await fetch(
        "/api/audit",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            url: url.trim(),
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Website audit failed."
        );
      }

      const crawlData =
        data.data;

      setResult(crawlData);

      const historyId =
        Date.now().toString();

      setHistory(
        (previous) => [
          {
            id: historyId,
            domain:
              crawlData.website
                .domain,
            url:
              crawlData.website
                .url,
            score:
              crawlData.scores
                ?.overall ?? 0,
            date:
              new Date().toLocaleString(),
            auditData:
              crawlData,
            aiResult: null,
          },
          ...previous.filter(
            (item) =>
              item.url !==
              crawlData.website
                .url
          ),
        ]
      );

      await runAIAnalysis(
        crawlData,
        historyId
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runAIAnalysis(
    auditData: AuditResult,
    historyId?: string
  ) {
    setAiLoading(true);

    try {
      const response =
        await fetch(
          "/api/ai-audit",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              auditData,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "AI analysis failed."
        );
      }

      const analysis =
        data.analysis ||
        data.data;

      setAiResult(
        analysis
      );

      if (historyId) {
        setHistory(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                historyId
                  ? {
                      ...item,
                      aiResult:
                        analysis,
                    }
                  : item
            )
        );
      }
    } catch (err) {
      console.error(
        "AI error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "AI analysis failed."
      );
    } finally {
      setAiLoading(false);
    }
  }

  function openHistory(
    item: HistoryItem
  ) {
    setUrl(item.url);
    setResult(
      item.auditData
    );
    setAiResult(
      item.aiResult
    );
    setError("");
    setActivePage(
      "dashboard"
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function rerunAudit(
    item: HistoryItem
  ) {
    setUrl(item.url);
    setActivePage(
      "dashboard"
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setTimeout(() => {
      handleAnalyze();
    }, 100);
  }

  function deleteHistory(
    id: string
  ) {
    setHistory(
      (previous) =>
        previous.filter(
          (item) =>
            item.id !== id
        )
    );
  }

  function clearHistory() {
    if (
      !window.confirm(
        "Clear all audit history?"
      )
    ) {
      return;
    }

    setHistory([]);
  }

  function newAudit() {
    setUrl("");
    setResult(null);
    setAiResult(null);
    setError("");
    setActivePage(
      "new"
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function exportReport() {
    if (!result) return;

    const report = {
      website:
        result.website,
      scores:
        result.scores,
      summary:
        result.summary,
      technicalFiles:
        result.technicalFiles,
      brokenLinks:
        result.brokenLinks,
      pages:
        result.pages,
      aiAnalysis:
        aiResult,
      exportedAt:
        new Date().toISOString(),
    };

    const blob =
      new Blob(
        [
          JSON.stringify(
            report,
            null,
            2
          ),
        ],
        {
          type:
            "application/json",
        }
      );

    const downloadUrl =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        "a"
      );

    a.href =
      downloadUrl;

    a.download =
      `${result.website.domain}-audit.json`;

    a.click();

    URL.revokeObjectURL(
      downloadUrl
    );
  }

  /*
   * Crawler issues ko ek single list me convert kar rahe hain.
   * API already ye data de rahi hai:
   * message, why, recommendation, suggestedFix
   */
  const crawlerRecommendations =
    useMemo(() => {
      if (!result?.pages) {
        return [];
      }

      const recommendations: any[] =
        [];

      result.pages.forEach(
        (page: any) => {
          if (!page.issues?.length) {
            return;
          }

          page.issues.forEach(
            (issue: any) => {
              recommendations.push({
                ...issue,
                pageUrl:
                  page.url,
              });
            }
          );
        }
      );

      return recommendations;
    }, [result]);

  return (
    <div className="app-layout">

      <aside className="sidebar">

        <div className="logo">

          <div className="logo-icon">
            SA
          </div>

          <div>
            <strong>
              SiteAudit AI
            </strong>

            <span>
              AI Website Auditor
            </span>
          </div>

        </div>

        <nav className="sidebar-nav">

          <button
            className={`nav-item ${
              activePage ===
              "dashboard"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActivePage(
                "dashboard"
              );

              window.scrollTo({
                top: 0,
                behavior:
                  "smooth",
              });
            }}
          >
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className={`nav-item ${
              activePage === "new"
                ? "active"
                : ""
            }`}
            onClick={
              newAudit
            }
          >
            <span>＋</span>
            New Audit
          </button>

          <button
            className={`nav-item ${
              activePage ===
              "history"
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActivePage(
                "history"
              );

              document
                .getElementById(
                  "audit-history"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",
                });
            }}
          >
            <span>◷</span>
            Audit History
          </button>

        </nav>

        <div className="sidebar-bottom">
          <span>
            AI Website Auditor
          </span>

          <small>
            Analyze • Improve • Grow
          </small>
        </div>

      </aside>

      <div className="main-content">

        <main className="page-container">

          <section className="hero">

            <div className="hero-badge">
              AI POWERED WEBSITE AUDITOR
            </div>

            <h1>
              Analyze your website.
              <br />
              <span>
                Improve your website.
              </span>
            </h1>

            <p>
              Enter your website URL
              and let AI analyze SEO,
              content, technical
              issues, accessibility
              and UX.
            </p>

            <form
              className="audit-form"
              onSubmit={
                handleAnalyze
              }
            >

              <input
                type="text"
                value={url}
                onChange={(e) =>
                  setUrl(
                    e.target.value
                  )
                }
                placeholder="https://example.com"
                disabled={loading}
              />

              <button
                type="submit"
                disabled={
                  loading
                }
              >
                {loading
                  ? "Analyzing..."
                  : "Analyze Website"}
              </button>

            </form>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

          </section>

          <section className="dashboard-stats">

            <div className="stat-card">
              <span>
                Total Audits
              </span>

              <strong>
                {
                  dashboardStats.audits
                }
              </strong>
            </div>

            <div className="stat-card">
              <span>
                Average Score
              </span>

              <strong>
                {
                  dashboardStats.average
                }
              </strong>
            </div>

            <div className="stat-card">
              <span>
                Highest Score
              </span>

              <strong>
                {
                  dashboardStats.highest
                }
              </strong>
            </div>

            <div className="stat-card">
              <span>
                Lowest Score
              </span>

              <strong>
                {
                  dashboardStats.lowest
                }
              </strong>
            </div>

          </section>

          {loading && (
            <section className="loading-box">

              <div className="loader" />

              <h3>
                Crawling website...
              </h3>

              <p>
                Collecting SEO,
                content and technical
                information.
              </p>

            </section>
          )}

          {result &&
            aiLoading && (
              <section className="loading-box">

                <div className="loader" />

                <h3>
                  AI is analyzing...
                </h3>

                <p>
                  Finding weak points
                  and generating
                  recommendations.
                </p>

              </section>
            )}

          {result &&
            !loading && (
              <section className="results">

                <div className="result-header">

                  <div>
                    <div className="small-label">
                      WEBSITE AUDIT
                    </div>

                    <h2>
                      {
                        result.website
                          ?.domain
                      }
                    </h2>

                    <p>
                      {
                        result.website
                          ?.url
                      }
                    </p>
                  </div>

                  <div className="result-actions">

                    <button
                      onClick={
                        exportReport
                      }
                    >
                      Export JSON
                    </button>

                    <div className="score-box">

                      <span>
                        Overall Score
                      </span>

                      <strong>
                        {
                          result.scores
                            ?.overall ??
                          0
                        }
                      </strong>

                      <small>
                        /100
                      </small>

                    </div>

                  </div>

                </div>

                <div className="score-grid">

                  {[
                    [
                      "SEO",
                      result.scores?.seo,
                    ],
                    [
                      "Content",
                      result.scores?.content,
                    ],
                    [
                      "Technical",
                      result.scores?.technical,
                    ],
                    [
                      "Accessibility",
                      result.scores
                        ?.accessibility,
                    ],
                    [
                      "UX",
                      result.scores?.ux,
                    ],
                  ].map(
                    ([name, score]) => (
                      <div
                        className="score-card"
                        key={
                          String(name)
                        }
                      >
                        <span>
                          {name}
                        </span>

                        <strong>
                          {score ?? 0}
                        </strong>

                        <small>
                          /100
                        </small>
                      </div>
                    )
                  )}

                </div>

                <div className="section-card">

                  <div className="section-title">
                    <h3>
                      Audit Summary
                    </h3>
                  </div>

                  <div className="summary-grid">

                    <div>
                      <span>
                        Pages Scanned
                      </span>

                      <strong>
                        {
                          result.summary
                            ?.pagesScanned ??
                          0
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Issues
                      </span>

                      <strong>
                        {
                          result.summary
                            ?.totalIssues ??
                          0
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Critical
                      </span>

                      <strong>
                        {
                          result.summary
                            ?.critical ??
                          0
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Important
                      </span>

                      <strong>
                        {
                          result.summary
                            ?.important ??
                          0
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Minor
                      </span>

                      <strong>
                        {
                          result.summary
                            ?.minor ??
                          0
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Broken Links
                      </span>

                      <strong>
                        {
                          result.summary
                            ?.brokenLinks ??
                          0
                        }
                      </strong>
                    </div>

                  </div>

                </div>

                <div className="section-card">

                  <div className="section-title">
                    <h3>
                      Technical Files
                    </h3>
                  </div>

                  <div className="file-status-grid">

                    <div>
                      <span>
                        robots.txt
                      </span>

                      <strong>
                        {result
                          .technicalFiles
                          ?.robots
                          ?.exists
                          ? "Detected"
                          : "Missing"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        sitemap.xml
                      </span>

                      <strong>
                        {result
                          .technicalFiles
                          ?.sitemap
                          ?.exists
                          ? "Detected"
                          : "Missing"}
                      </strong>
                    </div>

                  </div>

                </div>

                {/* CRAWLER RECOMMENDATIONS */}

                {crawlerRecommendations.length >
                  0 && (
                  <div className="section-card">

                    <div className="section-title">
                      <h3>
                        🛠️ Website Recommendations
                      </h3>
                    </div>

                    <div className="observations">

                      {crawlerRecommendations.map(
                        (
                          item: any,
                          index: number
                        ) => (
                          <div
                            className="observation"
                            key={
                              `${item.pageUrl}-${index}`
                            }
                          >

                            <div className="observation-top">

                              <span className="category-label">
                                {
                                  item.category ||
                                  "Website"
                                }
                              </span>

                              <span
                                className={`severity ${item.severity}`}
                              >
                                {
                                  item.severity
                                }
                              </span>

                            </div>

                            <h4>
                              {
                                item.message
                              }
                            </h4>

                            <p>
                              <strong>
                                Why it matters:
                              </strong>{" "}
                              {
                                item.why ||
                                "This issue may affect website quality."
                              }
                            </p>

                            <p>
                              <strong>
                                What to improve:
                              </strong>{" "}
                              {
                                item.recommendation ||
                                "Review and improve this area."
                              }
                            </p>

                            {item.suggestedFix && (
                              <p>
                                <strong>
                                  Suggested fix:
                                </strong>{" "}
                                {
                                  item.suggestedFix
                                }
                              </p>
                            )}

                            <p>
                              <strong>
                                Page:
                              </strong>{" "}
                              {
                                item.pageUrl
                              }
                            </p>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                )}

                {aiResult && (
                  <>

                    <div className="section-card ai-report">

                      <div className="section-title">
                        <h3>
                          🤖 AI Assessment
                        </h3>
                      </div>

                      <h4>
                        Overall Summary
                      </h4>

                      <p>
                        {
                          aiResult
                            .overallSummary
                        }
                      </p>

                      <h4>
                        Assessment
                      </h4>

                      <p>
                        {
                          aiResult
                            .overallAssessment
                        }
                      </p>

                    </div>

                    {aiResult
                      .strengths
                      ?.length >
                      0 && (
                      <div className="section-card">

                        <div className="section-title">
                          <h3>
                            ✓ Strengths
                          </h3>
                        </div>

                        <ul className="recommendation-list">

                          {aiResult.strengths.map(
                            (
                              item: string,
                              index: number
                            ) => (
                              <li
                                key={
                                  index
                                }
                              >
                                {item}
                              </li>
                            )
                          )}

                        </ul>

                      </div>
                    )}

                    {aiResult
                      .priorityActions
                      ?.length >
                      0 && (
                      <div className="section-card">

                        <div className="section-title">
                          <h3>
                            🚀 Priority Actions
                          </h3>
                        </div>

                        <div className="priority-list">

                          {aiResult.priorityActions.map(
                            (
                              item: any,
                              index: number
                            ) => (
                              <div
                                className="priority-item"
                                key={
                                  index
                                }
                              >

                                <div className="priority-number">
                                  {
                                    item.priority ??
                                    index +
                                      1
                                  }
                                </div>

                                <div>

                                  <span className="category-label">
                                    {
                                      item.category
                                    }
                                  </span>

                                  <h4>
                                    {
                                      item.action
                                    }
                                  </h4>

                                  <p>
                                    {
                                      item.reason
                                    }
                                  </p>

                                </div>

                              </div>
                            )
                          )}

                        </div>

                      </div>
                    )}

                    {aiResult
                      .websiteObservations
                      ?.length >
                      0 && (
                      <div className="section-card">

                        <div className="section-title">
                          <h3>
                            🔍 AI Findings
                          </h3>
                        </div>

                        <div className="observations">

                          {aiResult.websiteObservations.map(
                            (
                              item: any,
                              index: number
                            ) => (
                              <div
                                className="observation"
                                key={
                                  index
                                }
                              >

                                <div className="observation-top">

                                  <span className="category-label">
                                    {
                                      item.category
                                    }
                                  </span>

                                  <span
                                    className={`severity ${item.severity}`}
                                  >
                                    {
                                      item.severity
                                    }
                                  </span>

                                </div>

                                <h4>
                                  {
                                    item.problem
                                  }
                                </h4>

                                <p>
                                  <strong>
                                    Why it matters:
                                  </strong>{" "}
                                  {
                                    item.whyItMatters
                                  }
                                </p>

                                <p>
                                  <strong>
                                    Recommendation:
                                  </strong>{" "}
                                  {
                                    item.recommendation
                                  }
                                </p>

                              </div>
                            )
                          )}

                        </div>

                      </div>
                    )}

                    {aiResult
                      .locationAnalysis && (
                      <div className="section-card">

                        <div className="section-title">
                          <h3>
                            📍 Location Analysis
                          </h3>
                        </div>

                        <p>
                          <strong>
                            Detected:
                          </strong>{" "}
                          {
                            aiResult
                              .locationAnalysis
                              .detected
                              ? "Yes"
                              : "No"
                          }
                        </p>

                        {aiResult
                          .locationAnalysis
                          .locations
                          ?.map(
                            (
                              location: string,
                              index: number
                            ) => (
                              <p
                                key={
                                  index
                                }
                              >
                                •{" "}
                                {
                                  location
                                }
                              </p>
                            )
                          )}

                        <p>
                          {
                            aiResult
                              .locationAnalysis
                              .recommendation
                          }
                        </p>

                      </div>
                    )}

                    {aiResult
                      .pageImprovements
                      ?.length >
                      0 && (
                      <div className="section-card">

                        <div className="section-title">
                          <h3>
                            ✨ Page Improvements
                          </h3>
                        </div>

                        <div className="page-improvements">

                          {aiResult.pageImprovements.map(
                            (
                              page: any,
                              index: number
                            ) => (
                              <div
                                className="page-improvement"
                                key={
                                  index
                                }
                              >

                                <h4>
                                  {
                                    page.page
                                  }
                                </h4>

                                <div className="improvement-grid">

                                  <div>
                                    <span>
                                      Current Title
                                    </span>

                                    <p>
                                      {
                                        page.currentTitle ||
                                        "Missing"
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <span>
                                      Suggested Title
                                    </span>

                                    <p>
                                      {
                                        page.suggestedTitle ||
                                        "No suggestion"
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <span>
                                      Current Meta
                                    </span>

                                    <p>
                                      {
                                        page.currentMetaDescription ||
                                        "Missing"
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <span>
                                      Suggested Meta
                                    </span>

                                    <p>
                                      {
                                        page.suggestedMetaDescription ||
                                        "No suggestion"
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <span>
                                      Current H1
                                    </span>

                                    <p>
                                      {
                                        page.currentH1 ||
                                        "Missing"
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <span>
                                      Suggested H1
                                    </span>

                                    <p>
                                      {
                                        page.suggestedH1 ||
                                        "No suggestion"
                                      }
                                    </p>
                                  </div>

                                </div>

                                <p>
                                  <strong>
                                    Reason:
                                  </strong>{" "}
                                  {
                                    page.reason
                                  }
                                </p>

                              </div>
                            )
                          )}

                        </div>

                      </div>
                    )}

                  </>
                )}

                {result.pages?.length >
                  0 && (
                  <div className="section-card">

                    <div className="section-title">
                      <h3>
                        📄 Crawled Pages
                      </h3>
                    </div>

                    <div className="pages-list">

                      {result.pages.map(
                        (
                          page: any,
                          index: number
                        ) => (
                          <div
                            className="page-row"
                            key={
                              index
                            }
                          >

                            <div className="page-url">
                              {
                                page.url
                              }
                            </div>

                            <div>
                              Status{" "}
                              <strong>
                                {
                                  page.status ??
                                  "N/A"
                                }
                              </strong>
                            </div>

                            <div>
                              Words{" "}
                              <strong>
                                {
                                  page.wordCount ??
                                  0
                                }
                              </strong>
                            </div>

                            <div>
                              H1{" "}
                              <strong>
                                {
                                  page.h1
                                    ?.length ??
                                  0
                                }
                              </strong>
                            </div>

                            <div>
                              Images{" "}
                              <strong>
                                {
                                  page.imageCount ??
                                  0
                                }
                              </strong>
                            </div>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                )}

              </section>
            )}

          <section
            id="audit-history"
            className="history-section"
          >

            <div className="history-header">

              <div>

                <div className="small-label">
                  REPORT ARCHIVE
                </div>

                <h2>
                  Audit History
                </h2>

                <p>
                  Complete saved website
                  audit reports.
                </p>

              </div>

              {history.length >
                0 && (
                <button
                  className="clear-history"
                  onClick={
                    clearHistory
                  }
                >
                  Clear History
                </button>
              )}

            </div>

            {history.length ===
            0 ? (

              <div className="empty-history">

                <div className="empty-icon">
                  ◷
                </div>

                <h3>
                  No audits yet
                </h3>

                <p>
                  Analyze a website to
                  create your first
                  report.
                </p>

              </div>

            ) : (

              <div className="history-list">

                {history.map(
                  (item) => (
                    <div
                      className="history-card"
                      key={
                        item.id
                      }
                    >

                      <button
                        className="history-main"
                        type="button"
                        onClick={() =>
                          openHistory(
                            item
                          )
                        }
                      >

                        <div className="history-domain">

                          <strong>
                            {
                              item.domain
                            }
                          </strong>

                          <span>
                            {
                              item.url
                            }
                          </span>

                        </div>

                        <div className="history-score">

                          <strong>
                            {
                              item.score
                            }
                          </strong>

                          <span>
                            /100
                          </span>

                        </div>

                        <div className="history-date">
                          {
                            item.date
                          }
                        </div>

                      </button>

                      <button
                        className="history-rerun"
                        type="button"
                        onClick={() =>
                          rerunAudit(
                            item
                          )
                        }
                      >
                        Re-run
                      </button>

                      <button
                        className="history-delete"
                        type="button"
                        onClick={() =>
                          deleteHistory(
                            item.id
                          )
                        }
                      >
                        ×
                      </button>

                    </div>
                  )
                )}

              </div>

            )}

          </section>

        </main>

      </div>

    </div>
  );
}