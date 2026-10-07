import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const emptyResult = {
  overallSummary: "",
  overallAssessment: "",
  strengths: [],
  priorityActions: [],
  factualObservations: [],
  recommendations: [],
  locationAnalysis: {
    detected: false,
    locations: [],
    recommendation: "",
  },
  contentRecommendations: [],
  seoRecommendations: [],
  technicalRecommendations: [],
  pageImprovements: [],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auditData = body?.auditData;

    if (!auditData) {
      return NextResponse.json(
        {
          success: false,
          error: "Audit data is required",
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY is missing",
        },
        { status: 500 }
      );
    }

    const prompt = `
You are an expert AI Website Auditor.

Analyze the website using ONLY the crawler data provided below.

Your main job is to identify:
- Important things that should be changed
- SEO problems
- Content problems
- Technical problems
- UX problems
- Missing website elements
- Weak pages
- Specific improvements

IMPORTANT RULES:

1. Never invent current website facts.
2. A factual observation must be supported by crawler data.
3. Recommendations are allowed even when they are not directly present in crawler data.
4. Clearly separate current website facts from recommendations.
5. Do not call a recommendation a hallucination.
6. Give practical, actionable suggestions.
7. Prioritize the most important changes first.
8. If a page has a missing title, meta description, H1, canonical, alt text, etc., mention it.
9. If something is already present, do not recommend adding it as if it were missing.
10. Use the actual page URLs and actual crawler values whenever available.
11. Do not make claims about things the crawler did not check.

Return ONLY valid JSON.

Use exactly this structure:

{
  "overallSummary": "Short summary of the website audit",
  "overallAssessment": "Overall assessment based on crawler data",

  "strengths": [
    "Actual strength supported by crawler data"
  ],

  "priorityActions": [
    {
      "priority": 1,
      "category": "SEO",
      "action": "Specific change that should be made",
      "reason": "Why this change matters"
    }
  ],

  "factualObservations": [
    {
      "category": "SEO",
      "severity": "critical",
      "claim": "A factual statement about the current website",
      "evidence": {
        "field": "exact crawler field",
        "value": "exact crawler value"
      }
    }
  ],

  "recommendations": [
    {
      "category": "SEO",
      "recommendation": "Specific actionable recommendation",
      "reason": "Why it should be done"
    }
  ],

  "locationAnalysis": {
    "detected": false,
    "locations": [],
    "recommendation": ""
  },

  "contentRecommendations": [
    {
      "page": "Actual page URL",
      "recommendation": "Specific content improvement"
    }
  ],

  "seoRecommendations": [
    {
      "page": "Actual page URL",
      "recommendation": "Specific SEO improvement"
    }
  ],

  "technicalRecommendations": [
    {
      "page": "Actual page URL",
      "recommendation": "Specific technical improvement"
    }
  ],

  "pageImprovements": [
    {
      "page": "Actual page URL",
      "currentTitle": "Current title from crawler",
      "suggestedTitle": "Suggested improved title",
      "currentMetaDescription": "Current meta description from crawler",
      "suggestedMetaDescription": "Suggested improved meta description",
      "currentH1": "Current H1 from crawler",
      "suggestedH1": "Suggested improved H1",
      "reason": "Why these changes would improve the page"
    }
  ]
}

VERY IMPORTANT:

The "priorityActions" section is the most important section.

Always try to provide useful priority actions based on the crawler data.

Examples:

If meta description is missing:
{
  "priority": 1,
  "category": "SEO",
  "action": "Add a unique meta description to the page",
  "reason": "The crawler detected that the page does not have a meta description."
}

If images are missing alt text:
{
  "priority": 2,
  "category": "Accessibility",
  "action": "Add descriptive alt text to images that currently have no alt text",
  "reason": "Images without alt text reduce accessibility and provide less context to search engines."
}

If broken links exist:
{
  "priority": 1,
  "category": "Technical SEO",
  "action": "Fix or remove the broken links detected by the crawler",
  "reason": "Broken links can negatively affect user experience and crawling."
}

If title exists:
Do NOT say "add a title".
Instead suggest improving it only if the available crawler data indicates a problem.

CRAWLER DATA:

${JSON.stringify(auditData, null, 2)}
`;

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      input: prompt,
      max_output_tokens: 3500,
    });

    const output = response.output_text?.trim();

    if (!output) {
      return NextResponse.json({
        success: true,
        data: emptyResult,
      });
    }

    let result;

    try {
      result = JSON.parse(output);
    } catch (parseError) {
      console.error("AI JSON parse error:", parseError);
      console.error("Raw AI output:", output);

      return NextResponse.json({
        success: true,
        data: emptyResult,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...emptyResult,
        ...result,
        priorityActions: Array.isArray(result.priorityActions)
          ? result.priorityActions
          : [],
        factualObservations: Array.isArray(result.factualObservations)
          ? result.factualObservations
          : [],
        recommendations: Array.isArray(result.recommendations)
          ? result.recommendations
          : [],
        strengths: Array.isArray(result.strengths)
          ? result.strengths
          : [],
        contentRecommendations: Array.isArray(
          result.contentRecommendations
        )
          ? result.contentRecommendations
          : [],
        seoRecommendations: Array.isArray(result.seoRecommendations)
          ? result.seoRecommendations
          : [],
        technicalRecommendations: Array.isArray(
          result.technicalRecommendations
        )
          ? result.technicalRecommendations
          : [],
        pageImprovements: Array.isArray(result.pageImprovements)
          ? result.pageImprovements
          : [],
      },
    });
  } catch (error: any) {
    console.error("========== AI AUDIT ERROR ==========");
    console.error(error);
    console.error("Message:", error?.message);
    console.error("Status:", error?.status);
    console.error("Code:", error?.code);
    console.error("====================================");

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "AI audit failed",
        details: {
          status: error?.status || null,
          code: error?.code || null,
        },
      },
      { status: 500 }
    );
  }
}