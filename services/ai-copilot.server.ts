import type {
  AIProvider,
  ChatMessage,
  PageContext,
} from "@/types/ai-chat";
import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

function safeGet<T>(query: () => T, fallback: T): T {
  try { return query(); } catch { return fallback; }
}
import { getDailyBriefing, type DailyBriefing, detectLossPatterns, detectConversionPatterns, detectStageBottlenecks } from "@/services/ai-priority.service";
import {
  predictDealEnhanced,
  findSimilarDeals,
  getHistoricalBenchmark,
  recommendNextBestAction,
  runWhatIfAnalysis,
  assessDataQuality,
} from "@/services/ai-predictive.service";
import { detectChanges } from "@/services/ai-intelligence.service";
import { generateGlobalActionRecommendations, buildActionExplanation } from "@/services/ai-action-recommendation.service";

function simulateStreamingResponse(
  fullText: string
): AsyncIterable<string> {
  const words = fullText.split(/(?=\s)/g);
  let index = 0;

  const iterator = {
    next(): Promise<IteratorResult<string>> {
      if (index >= words.length) {
        return Promise.resolve({ done: true, value: undefined });
      }
      const chunk = words[index];
      index++;
      return new Promise((resolve) =>
        setTimeout(
          () => resolve({ done: false, value: chunk }),
          20 + Math.random() * 30
        )
      );
    },
    return(): Promise<IteratorResult<string>> {
      return Promise.resolve({ done: true, value: undefined });
    },
  };

  return {
    [Symbol.asyncIterator]: () => iterator,
  };
}

function getUserMessage(messages: ChatMessage[]): string {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  return (lastUserMessage?.content || "").toLowerCase().trim();
}

function _isProactiveQuery(message: string): boolean {
  const proactivePatterns = [
    /وش أركز|أركز|أفضل شيء|أفضل thing|priority|priorities|first thing/,
    /مين يحتاج|يحتاج متابعة|needs follow|needs attention|متابعة/,
    /وش أخطر|أخطر صفقة|at risk|risk deal|dangerous/,
    /مين العملاء غير|غير نشطين|inactive customers|inactive/,
    /وش أهم فرصة|أهم فرصة|opportunity|فرصة/,
    /مين عنده مهام|مهام متأخرة|overdue tasks|overdue/,
    /وش أفضل|best thing|what should/,
    /تحليل يومي|daily brief|ملخص يومي|يومي/,
    /أفضل إجراء|next best action|what should i do|وش أسوي|أقترح/,
    /صحة الصفقة|deal health|health score|هل الصفقة سليمة/,
    /نسبة الخطر|risk score|how risky|مستوى الخطر/,
    /صفقات مشابهة|similar deals|comparable deals|مشابهة/,
    /تحليل تاريخي|historical|benchmark|تاريخي/,
    /ماذا لو|what if|scenario|لو ما سويت/,
    /جودة البيانات|data quality|missing data|جودة/,
    /وش تغير|تغير|what changed|تغيرات/,
    /وش أسوي|what do i do|what should i do|أفضل إجراء|recommended action/,
    /ركز على|focus on|أركز على|شنو أهم/,
  ];
  return proactivePatterns.some((p) => p.test(message));
}

function formatPriorityItem(item: {
  entityType: string;
  entityName: string;
  priority: string;
  priorityScore: number;
  reason: string;
  recommendedAction: string;
  value?: number;
  currency?: string;
}): string {
  const valueStr = item.value ? ` · ${(item.value / 100).toFixed(2)} ${item.currency || "SAR"}` : "";
  return `**${item.entityName}** (${item.entityType}) — ${item.priority.toUpperCase()} (Score: ${item.priorityScore})\n  Reason: ${item.reason}\n  Recommended: ${item.recommendedAction}${valueStr}`;
}

export class LocalProvider implements AIProvider {
  readonly type = "local" as const;

  async *sendMessage(
    messages: ChatMessage[],
    context: PageContext
  ): AsyncIterable<string> {
    const { analyzeCustomer, analyzeDeal, analyzeLead, analyzeTask, analyzeGlobal } = await import("@/services/ai-analysis.service");
    const userMessage = getUserMessage(messages);
    const page = context.page;

    if (_isProactiveQuery(userMessage) || page === "ai" || page === "dashboard") {
      const briefing: DailyBriefing = getDailyBriefing();
      const lines: string[] = [];

      if (userMessage.includes("وش أركز") || userMessage.includes("أركز") || userMessage.includes("أفضل شيء") || userMessage.includes("best thing") || userMessage.includes("priorities") || userMessage.includes("أفضل")) {
        lines.push("### Today's Priorities");
        lines.push("");
        lines.push("Here is what you should focus on today, ranked by urgency:");
        lines.push("");
        const priorities = briefing.todayPriorities.slice(0, 5);
        if (priorities.length === 0) {
          lines.push("No high-priority items today. Continue with your current routine.");
        } else {
          priorities.forEach((p: DailyBriefing["todayPriorities"][0], i: number) => {
            lines.push(`${i + 1}. ${formatPriorityItem(p)}`);
            lines.push("");
          });
        }
        lines.push("Ask me for details on any item, or tell me to create a follow-up task.");
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("مين يحتاج") || userMessage.includes("يحتاج متابعة") || userMessage.includes("needs follow") || userMessage.includes("attention") || userMessage.includes("متابعة")) {
        lines.push("### Customers & Records Needing Attention");
        lines.push("");
        const needsAttention = [
          ...briefing.customersRequiringAttention.slice(0, 3),
          ...briefing.suggestedFollowUps.slice(0, 3),
        ];
        if (needsAttention.length === 0) {
          lines.push("No records currently require immediate attention.");
        } else {
          needsAttention.forEach((item, i) => {
            lines.push(`${i + 1}. ${formatPriorityItem(item)}`);
            lines.push("");
          });
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("وش أخطر") || userMessage.includes("أخطر صفقة") || userMessage.includes("at risk") || userMessage.includes("risk deal") || userMessage.includes("أخطر")) {
        lines.push("### At-Risk Deals");
        lines.push("");
        const atRisk = briefing.atRiskDeals.slice(0, 5);
        if (atRisk.length === 0) {
          lines.push("No deals are currently at risk.");
        } else {
          atRisk.forEach((d: DailyBriefing["atRiskDeals"][0], i: number) => {
            lines.push(`${i + 1}. ${formatPriorityItem(d)}`);
            lines.push("");
          });
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("مين العملاء غير") || userMessage.includes("غير نشطين") || userMessage.includes("inactive") || userMessage.includes("inactive customers") || userMessage.includes("عملاء")) {
        lines.push("### Inactive Customers");
        lines.push("");
        const inactive = briefing.customersRequiringAttention.slice(0, 5);
        if (inactive.length === 0) {
          lines.push("No inactive customers detected.");
        } else {
          inactive.forEach((c: DailyBriefing["customersRequiringAttention"][0], i: number) => {
            lines.push(`${i + 1}. **${c.entityName}** — ${c.reason}`);
            lines.push(`   Recommended: ${c.recommendedAction}`);
            lines.push("");
          });
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("وش أهم فرصة") || userMessage.includes("أهم فرصة") || userMessage.includes("opportunity") || userMessage.includes("فرصة")) {
        lines.push("### Top Opportunities");
        lines.push("");
        const opps = briefing.opportunities.slice(0, 5);
        if (opps.length === 0) {
          lines.push("No significant opportunities identified right now.");
        } else {
          opps.forEach((o: DailyBriefing["opportunities"][0], i: number) => {
            lines.push(`${i + 1}. ${formatPriorityItem(o)}`);
            lines.push("");
          });
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("مين عنده مهام") || userMessage.includes("مهام متأخرة") || userMessage.includes("overdue tasks") || userMessage.includes("overdue") || userMessage.includes("مهام")) {
        lines.push("### Overdue Tasks");
        lines.push("");
        const overdue = briefing.overdueTasks.slice(0, 5);
        if (overdue.length === 0) {
          lines.push("No overdue tasks.");
        } else {
          overdue.forEach((t: DailyBriefing["overdueTasks"][0], i: number) => {
            lines.push(`${i + 1}. ${formatPriorityItem(t)}`);
            lines.push("");
          });
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("ليش نخسر") || userMessage.includes("نخسر") || userMessage.includes("why lose") || userMessage.includes("loss pattern") || userMessage.includes("خسائر") || userMessage.includes("أسباب الخسارة")) {
        lines.push("### Loss Patterns");
        lines.push("");
        const lossPatterns = detectLossPatterns();
        if (lossPatterns.length === 0) {
          lines.push("No significant loss patterns detected in your CRM data.");
        } else {
          lossPatterns.forEach((pattern) => {
            lines.push(`**${pattern.title}** (${pattern.severity.toUpperCase()})`);
            lines.push(`- ${pattern.description}`);
            lines.push(`- Confidence: ${pattern.confidence} · Sample: ${pattern.sampleSize} deals`);
            lines.push(`- Impact: ${pattern.businessImpact}`);
            lines.push("- Evidence:");
            pattern.evidence.slice(0, 3).forEach((e) => lines.push(`  - ${e}`));
            lines.push("");
          });
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("أين الاختناقات") || userMessage.includes("اختناقات") || userMessage.includes("bottleneck") || userMessage.includes(" bottlenecks") || userMessage.includes(" bottlenecks")) {
        lines.push("### Stage Bottlenecks");
        lines.push("");
        const bottlenecks = detectStageBottlenecks();
        if (bottlenecks.length === 0) {
          lines.push("No stage bottlenecks detected.");
        } else {
          bottlenecks.forEach((b) => {
            lines.push(`**${b.stage}** — Score: ${b.bottleneckScore} (${b.severity.toUpperCase()})`);
            lines.push(`- Avg days in stage: ${b.avgDaysInStage} · Stalled: ${b.stalledDeals}`);
            lines.push(`- Recommendation: ${b.recommendation}`);
            lines.push("");
          });
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("أفضل إجراء") || userMessage.includes("next best action") || userMessage.includes("what should i do") || userMessage.includes("وش أسوي") || userMessage.includes("أقترح")) {
        lines.push("### Next Best Action");
        lines.push("");
        if (context.recordId && context.recordType && ["customer", "lead", "deal"].includes(context.recordType)) {
          const action = recommendNextBestAction(context.recordType as "customer" | "lead" | "deal", context.recordId);
          lines.push(`**Recommended Action:** ${action.action}`);
          lines.push(`- Priority: ${action.priority.toUpperCase()}`);
          lines.push(`- Why: ${action.why}`);
          if (action.expectedImpact.length > 0) {
            lines.push("- Expected Impact:");
            action.expectedImpact.forEach((impact: string) => lines.push(`  - ${impact}`));
          }
          if (action.deadline) {
            lines.push(`- Deadline: ${action.deadline}`);
          }
        } else {
          lines.push("Please select a record first so I can recommend the best next action.");
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("صحة الصفقة") || userMessage.includes("deal health") || userMessage.includes("health score") || userMessage.includes("هل الصفقة سليمة")) {
        lines.push("### Deal Health Assessment");
        lines.push("");
        if (context.recordId && context.recordType === "deal") {
          const enhanced = predictDealEnhanced(context.recordId);
          if (enhanced) {
            lines.push(`**Health Score:** ${enhanced.dealHealth.score} / 100 (${enhanced.dealHealth.level.toUpperCase()})`);
            lines.push(`- AI Win Probability: ${enhanced.aiWinProbability}%`);
            lines.push(`- AI Loss Probability: ${enhanced.aiLossProbability}%`);
            lines.push(`- AI Stall Probability: ${enhanced.aiStallProbability}%`);
            lines.push(`- Overall Confidence: ${enhanced.overallConfidence.toUpperCase()}`);
            lines.push("- Health Factors:");
            enhanced.dealHealth.factors.forEach((f) => lines.push(`  - ${f}`));
            lines.push("");
            lines.push("**Risk Assessment:**");
            lines.push(`- Overall Risk: ${enhanced.riskScore.overall} / 100 (${enhanced.riskScore.level.toUpperCase()})`);
            lines.push(`- Primary Risk: ${enhanced.riskScore.primaryRisk}`);
            if (enhanced.riskScore.secondaryRisks.length > 0) {
              lines.push("- Secondary Risks:");
              enhanced.riskScore.secondaryRisks.forEach((r) => lines.push(`  - ${r}`));
            }
            lines.push("");
            lines.push("**Opportunity Assessment:**");
            lines.push(`- Opportunity Score: ${enhanced.opportunityScore.score} / 100 (${enhanced.opportunityScore.level.toUpperCase()})`);
            enhanced.opportunityScore.factors.forEach((f) => lines.push(`  - ${f}`));
            lines.push("");
            lines.push("**Data Quality:**");
            lines.push(`- Score: ${enhanced.dataQuality.score}%`);
            lines.push(`- Impact: ${enhanced.dataQuality.impactOnConfidence}`);
            if (enhanced.dataQuality.missingFields.length > 0) {
              lines.push(`- Missing: ${enhanced.dataQuality.missingFields.join(", ")}`);
            }
          } else {
            lines.push("Unable to assess deal health — insufficient data.");
          }
        } else {
          lines.push("Please select a deal first to assess its health.");
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("نسبة الخطر") || userMessage.includes("risk score") || userMessage.includes("how risky") || userMessage.includes("مستوى الخطر")) {
        lines.push("### Risk Analysis");
        lines.push("");
        if (context.recordId && context.recordType === "deal") {
          const enhanced = predictDealEnhanced(context.recordId);
          if (enhanced) {
            lines.push(`**Overall Risk:** ${enhanced.riskScore.overall} / 100 — ${enhanced.riskScore.level.toUpperCase()}`);
            lines.push(`- Primary Risk: ${enhanced.riskScore.primaryRisk}`);
            lines.push("- Risk Breakdown:");
            Object.entries(enhanced.riskScore.categories).forEach(([key, value]) => {
              if (value > 0) lines.push(`  - ${key}: ${value}`);
            });
            lines.push("");
            lines.push("**Anomalies Detected:**");
            if (enhanced.anomalies.length === 0) {
              lines.push("No anomalies detected.");
            } else {
              enhanced.anomalies.forEach((a) => {
                lines.push(`- [${a.severity.toUpperCase()}] ${a.description}`);
                a.evidence.forEach((e) => lines.push(`  - ${e}`));
              });
            }
          } else {
            lines.push("Unable to analyze risk — insufficient data.");
          }
        } else {
          lines.push("Please select a deal first to analyze its risk.");
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("صفقات مشابهة") || userMessage.includes("similar deals") || userMessage.includes("comparable deals") || userMessage.includes("مشابهة")) {
        lines.push("### Similar Deals");
        lines.push("");
        if (context.recordId && context.recordType === "deal") {
          const similar = findSimilarDeals(context.recordId);
          const dealRow = safeGet(
            () => getDb().prepare(`SELECT stage_id, expected_value_minor FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(context.recordId) as { stage_id: string | null; expected_value_minor: number | null } | undefined,
            undefined
          );
          const benchmark = getHistoricalBenchmark(dealRow?.stage_id ?? null, dealRow?.expected_value_minor ?? null);
          if (benchmark) {
            lines.push(`**Historical Benchmark:** ${benchmark.comparableDeals} comparable deals found.`);
            lines.push(`- Won: ${benchmark.won} · Lost: ${benchmark.lost} · Stalled: ${benchmark.stalled}`);
            lines.push(`- Historical Win Rate: ${benchmark.historicalWinRate}%`);
            lines.push(`- Confidence: ${benchmark.confidence.toUpperCase()}`);
            lines.push("");
          }
          if (similar.length === 0) {
            lines.push("No similar deals found in the CRM.");
          } else {
            lines.push("**Most Similar Deals:**");
            similar.slice(0, 5).forEach((s) => {
              lines.push(`- **${s.name}** (${s.stage}) — Outcome: ${s.outcome || "Open"} · Value: ${s.expectedValueMinor ? `${(s.expectedValueMinor / 100).toFixed(2)} SAR` : "N/A"}`);
              if (s.daysToClose) lines.push(`  - Days to close: ${s.daysToClose}`);
            });
          }
        } else {
          lines.push("Please select a deal first to find similar deals.");
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("تحليل تاريخي") || userMessage.includes("historical") || userMessage.includes("benchmark") || userMessage.includes("تاريخي")) {
        lines.push("### Historical Benchmarking");
        lines.push("");
        if (context.recordId && context.recordType === "deal") {
          const db = getDb();
          const deal = safeGet(
            () => db.prepare(`SELECT stage_id, expected_value_minor FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(context.recordId) as { stage_id: string | null; expected_value_minor: number | null } | undefined,
            undefined
          );
          if (deal) {
            const benchmark = getHistoricalBenchmark(deal.stage_id, deal.expected_value_minor);
            lines.push(`**Comparable Deals:** ${benchmark.comparableDeals}`);
            lines.push(`- Won: ${benchmark.won} · Lost: ${benchmark.lost} · Stalled: ${benchmark.stalled}`);
            lines.push(`- Historical Win Rate: ${benchmark.historicalWinRate}%`);
            if (benchmark.avgTimeToClose) lines.push(`- Average Time to Close: ${benchmark.avgTimeToClose} days`);
            if (benchmark.avgStageDuration) lines.push(`- Average Stage Duration: ${benchmark.avgStageDuration} days`);
            if (benchmark.avgActivityFrequency) lines.push(`- Average Activity Frequency: ${benchmark.avgActivityFrequency} per deal`);
            lines.push(`- Confidence: ${benchmark.confidence.toUpperCase()}`);
          } else {
            lines.push("Deal not found.");
          }
        } else {
          lines.push("Please select a deal first to view historical benchmarks.");
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("ماذا لو") || userMessage.includes("what if") || userMessage.includes("scenario") || userMessage.includes("لو ما سويت")) {
        lines.push("### What-If Scenarios");
        lines.push("");
        if (context.recordId && context.recordType === "deal") {
          const scenarios = runWhatIfAnalysis("deal", context.recordId);
          if (scenarios.length === 0) {
            lines.push("No scenario data available.");
          } else {
            scenarios.forEach((s) => {
              lines.push(`**Scenario:** ${s.scenario}`);
              lines.push(`- Estimated Probability: ${s.estimatedProbability !== null ? `${s.estimatedProbability}%` : "Insufficient data"}`);
              lines.push(`- Estimated Risk: ${s.estimatedRisk !== null ? `${s.estimatedRisk}%` : "Insufficient data"}`);
              lines.push(`- Reasoning: ${s.reasoning}`);
              lines.push(`- Confidence: ${s.confidence.toUpperCase()}`);
              lines.push("");
            });
          }
        } else {
          lines.push("Please select a deal first to run what-if scenarios.");
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("جودة البيانات") || userMessage.includes("data quality") || userMessage.includes("missing data") || userMessage.includes("جودة")) {
        lines.push("### Data Quality Assessment");
        lines.push("");
        if (context.recordId && context.recordType && ["customer", "lead", "deal"].includes(context.recordType)) {
          const quality = assessDataQuality(context.recordType as "customer" | "lead" | "deal", context.recordId);
          lines.push(`**Data Quality Score:** ${quality.score}%`);
          lines.push(`- Impact on Confidence: ${quality.impactOnConfidence}`);
          if (quality.missingFields.length > 0) {
            lines.push("- Missing Fields:");
            quality.missingFields.forEach((f: string) => lines.push(`  - ${f}`));
          }
          lines.push("- Completeness:");
          Object.entries(quality.completeness).forEach(([key, value]: [string, boolean]) => {
            lines.push(`  - ${key}: ${value ? "Present" : "Missing"}`);
          });
        } else {
          lines.push("Please select a record first to assess data quality.");
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("كيف تحويل") || userMessage.includes("تحويل") || userMessage.includes("conversion pattern") || userMessage.includes("نسب التحويل") || userMessage.includes("معدل التحويل")) {
        lines.push("### Conversion Patterns");
        lines.push("");
        const conversionPatterns = detectConversionPatterns();
        if (conversionPatterns.length === 0) {
          lines.push("No conversion patterns detected.");
        } else {
          conversionPatterns.forEach((pattern) => {
            lines.push(`**${pattern.title}** (${pattern.severity.toUpperCase()})`);
            lines.push(`- ${pattern.description}`);
            lines.push(`- Confidence: ${pattern.confidence} · Sample: ${pattern.sampleSize} deals`);
            lines.push(`- Impact: ${pattern.businessImpact}`);
            lines.push("- Evidence:");
            pattern.evidence.slice(0, 3).forEach((e) => lines.push(`  - ${e}`));
            lines.push("");
          });
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("وش تغير") || userMessage.includes("تغير") || userMessage.includes("what changed") || userMessage.includes("تغيرات")) {
        lines.push("### What Changed");
        lines.push("");
        if (context.recordId && context.recordType && ["customer", "lead", "deal"].includes(context.recordType)) {
          const changes = detectChanges(context.recordType as "customer" | "lead" | "deal", context.recordId);
          if (changes.hasChange) {
            lines.push(changes.summary);
            lines.push("");
            lines.push("**Changes detected:**");
            changes.changes.forEach((c) => {
              lines.push(`- **${c.type}** (${c.significance.toUpperCase()}): ${c.change}`);
              if (c.evidence.length > 0) {
                lines.push(`  - Evidence: ${c.evidence.slice(0, 3).join("; ")}`);
              }
            });
            lines.push("");
            lines.push(`**Confidence:** ${changes.confidence.toUpperCase()}`);
          } else {
            lines.push("No significant changes detected.");
          }
        } else {
          lines.push("Please select a record first to see what changed.");
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }

      if (userMessage.includes("وش أسوي") || userMessage.includes("أقترح") || userMessage.includes("وش أركز") || userMessage.includes("أركز") || userMessage.includes("أفضل إجراء") || userMessage.includes("what should i do") || userMessage.includes("what should i focus") || userMessage.includes("recommended action") || userMessage.includes("next best action")) {
        lines.push("### Actionable Recommendations");
        lines.push("");
        if (context.recordId && context.recordType && ["customer", "lead", "deal", "task"].includes(context.recordType)) {
          const action = recommendNextBestAction(context.recordType as "customer" | "lead" | "deal" | "task", context.recordId);
          lines.push(`**Recommended Action:** ${action.action}`);
          lines.push(`- Priority: ${action.priority.toUpperCase()}`);
          lines.push(`- Why: ${action.why}`);
          if (action.evidence && action.evidence.length > 0) {
            lines.push("- Evidence:");
            action.evidence.slice(0, 4).forEach((e: string) => lines.push(`  - ${e}`));
          }
          if (action.expectedImpact.length > 0) {
            lines.push("- Expected Impact:");
            action.expectedImpact.forEach((impact: string) => lines.push(`  - ${impact}`));
          }
          lines.push(`- Confidence: ${(action.confidence || "medium").toUpperCase()}`);
        } else {
          const globalActions = generateGlobalActionRecommendations();
          lines.push(globalActions.summary);
          lines.push("");
          if (globalActions.topPriority) {
            lines.push("**Top Priority:**");
            lines.push(buildActionExplanation(globalActions.topPriority));
          }
          if (globalActions.byEntity.length > 1) {
            lines.push("");
            lines.push("**All Priorities (sorted by urgency):**");
            globalActions.byEntity.slice(0, 10).forEach((item, i) => {
              lines.push(`${i + 1}. **${item.entityName}** (${item.entityType}) — ${item.action.priority.toUpperCase()}`);
              lines.push(`   Action: ${item.action.action}`);
              lines.push(`   Why: ${item.action.reason}`);
            });
          }
        }
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }
    }

    if (page === "dashboard") {
      const analysis = analyzeGlobal();
      const lines: string[] = [];
      lines.push("### Dashboard Overview");
      lines.push("");
      if (analysis.todayPriorities.length > 0) {
        lines.push("**Today's Priorities:**");
        for (const p of analysis.todayPriorities) {
          lines.push(`- **${p.label}**: ${p.reason} (${p.value})`);
        }
        lines.push("");
      }
      if (analysis.atRiskDeals.length > 0) {
        lines.push("**At-Risk Deals:**");
        for (const d of analysis.atRiskDeals.slice(0, 5)) {
          lines.push(`- **${d.name}** (${d.stage || "N/A"}): ${d.reason}`);
        }
        lines.push("");
      }
      if (analysis.customersRequiringAttention.length > 0) {
        lines.push("**Customers Requiring Attention:**");
        for (const c of analysis.customersRequiringAttention.slice(0, 5)) {
          lines.push(`- **${c.name}**: ${c.reason}`);
        }
        lines.push("");
      }
      if (analysis.overdueTasksSummary.total > 0) {
        lines.push(`**Overdue Tasks:** ${analysis.overdueTasksSummary.total} total, ${analysis.overdueTasksSummary.linkedToHighValueDeals} linked to high-value deals.`);
        lines.push("");
      }
      if (analysis.topPerformers.length > 0) {
        lines.push("**Top Performers:**");
        for (const p of analysis.topPerformers.slice(0, 3)) {
          lines.push(`- **${p.name}**: ${p.wonDeals} won deals, ${p.conversionRate}% conversion`);
        }
        lines.push("");
      }
      lines.push("Select a record and ask me to analyze it for detailed insights.");
      yield* simulateStreamingResponse(lines.join("\n"));
      return;
    }

    if (context.recordId && context.recordType === "deal") {
      const analysis = analyzeDeal(context.recordId);
      if (analysis) {
        const lines: string[] = [];
        lines.push("### Deal Analysis");
        lines.push("");
        lines.push("**Executive Summary:**");
        lines.push("");
        lines.push(analysis.overview);
        lines.push("");
        lines.push("**Current Situation:**");
        lines.push(`- Stage: ${analysis.stage || "Unknown"}`);
        lines.push(`- Age: ${analysis.ageDays !== null ? `${analysis.ageDays} days` : "Unknown"}`);
        lines.push(`- Days Since Last Activity: ${analysis.daysSinceLastActivity !== null ? `${analysis.daysSinceLastActivity} days` : "None recorded"}`);
        lines.push(`- Days in Current Stage: ${analysis.daysInCurrentStage !== null ? `${analysis.daysInCurrentStage} days` : "Unknown"}`);
        lines.push(`- Expected Value: ${analysis.expectedValueMinor !== null ? `${(analysis.expectedValueMinor / 100).toFixed(2)} SAR` : "Not set"}`);
        lines.push(`- Status: ${analysis.status || "Open"}`);
        lines.push("");
        if (analysis.predictions) {
          lines.push("**Predictions (Deterministic Model):**");
          lines.push("");
          const p = analysis.predictions;
          lines.push(`- **Win Probability:** ${p.winProbability.value}% (Confidence: ${p.winProbability.confidence})`);
          lines.push(`  - ${p.winProbability.explanation}`);
          lines.push(`  - Evidence: ${p.winProbability.basis.slice(0, 4).join("; ")}`);
          lines.push(`- **Stagnation Risk:** ${p.stagnationRisk.value}% (Confidence: ${p.stagnationRisk.confidence})`);
          lines.push(`  - ${p.stagnationRisk.explanation}`);
          lines.push(`- **Follow-up Priority:** ${p.followUpPriority.value}% (Confidence: ${p.followUpPriority.confidence})`);
          lines.push(`  - ${p.followUpPriority.explanation}`);
          lines.push(`- **Engagement Score:** ${p.engagementScore.value}% (Confidence: ${p.engagementScore.confidence})`);
          lines.push(`  - ${p.engagementScore.explanation}`);
          lines.push("");
        }
        if (analysis.enhancedPredictions) {
          const ep = analysis.enhancedPredictions;
          lines.push("**Enhanced Predictive Intelligence:**");
          lines.push("");
          lines.push(`- **AI Win Probability:** ${ep.aiWinProbability}%`);
          lines.push(`- **AI Loss Probability:** ${ep.aiLossProbability}%`);
          lines.push(`- **AI Stall Probability:** ${ep.aiStallProbability}%`);
          lines.push(`- **Overall Confidence:** ${ep.overallConfidence.toUpperCase()}`);
          if (ep.expectedCloseWindow) lines.push(`- **Expected Close Window:** ${ep.expectedCloseWindow}`);
          lines.push("");
          lines.push("**Deal Health:**");
          lines.push(`- Score: ${ep.dealHealth.score} / 100 (${ep.dealHealth.level.toUpperCase()})`);
          ep.dealHealth.factors.forEach((f) => lines.push(`  - ${f}`));
          lines.push("");
          lines.push("**Risk Assessment:**");
          lines.push(`- Overall: ${ep.riskScore.overall} / 100 (${ep.riskScore.level.toUpperCase()})`);
          lines.push(`- Primary Risk: ${ep.riskScore.primaryRisk}`);
          if (ep.riskScore.secondaryRisks.length > 0) {
            lines.push("- Secondary Risks:");
            ep.riskScore.secondaryRisks.forEach((r) => lines.push(`  - ${r}`));
          }
          lines.push("");
          lines.push("**Opportunity Assessment:**");
          lines.push(`- Score: ${ep.opportunityScore.score} / 100 (${ep.opportunityScore.level.toUpperCase()})`);
          ep.opportunityScore.factors.forEach((f) => lines.push(`  - ${f}`));
          lines.push("");
          lines.push("**Historical Benchmark:**");
          lines.push(`- Comparable Deals: ${ep.historicalBenchmark.comparableDeals}`);
          lines.push(`- Won: ${ep.historicalBenchmark.won} · Lost: ${ep.historicalBenchmark.lost} · Stalled: ${ep.historicalBenchmark.stalled}`);
          lines.push(`- Historical Win Rate: ${ep.historicalBenchmark.historicalWinRate}%`);
          lines.push(`- Confidence: ${ep.historicalBenchmark.confidence.toUpperCase()}`);
          lines.push("");
          lines.push("**Similar Deals:**");
          if (ep.similarDeals.length === 0) {
            lines.push("No similar deals found.");
          } else {
            ep.similarDeals.slice(0, 3).forEach((s) => {
              lines.push(`- ${s.name} (${s.stage}) — ${s.outcome || "Open"} · Value: ${s.expectedValueMinor ? `${(s.expectedValueMinor / 100).toFixed(2)} SAR` : "N/A"}`);
            });
          }
          lines.push("");
          lines.push("**Next Best Action:**");
          lines.push(`- **${ep.nextBestAction.action}** (${ep.nextBestAction.priority.toUpperCase()})`);
          lines.push(`- Why: ${ep.nextBestAction.why}`);
          ep.nextBestAction.expectedImpact.forEach((impact) => lines.push(`  - Impact: ${impact}`));
          lines.push("");
          lines.push("**Data Quality:**");
          lines.push(`- Score: ${ep.dataQuality.score}% — ${ep.dataQuality.impactOnConfidence}`);
          if (ep.dataQuality.missingFields.length > 0) {
            lines.push(`- Missing: ${ep.dataQuality.missingFields.join(", ")}`);
          }
          lines.push("");
          lines.push("**Explainability:**");
          lines.push("- Positive Factors:");
          ep.explainability.positiveFactors.forEach((f) => lines.push(`  - ${f}`));
          lines.push("- Negative Factors:");
          ep.explainability.negativeFactors.forEach((f) => lines.push(`  - ${f}`));
          lines.push(`- Historical Evidence: ${ep.explainability.historicalEvidence.join("; ")}`);
          lines.push(`- Confidence Reason: ${ep.explainability.confidenceReason}`);
        }
        if (analysis.evidence.length > 0) {
          lines.push("**Evidence:**");
          for (const e of analysis.evidence) lines.push(`- ${e}`);
          lines.push("");
        }
        if (analysis.riskReasons.length > 0) {
          lines.push("**Risks:**");
          for (const r of analysis.riskReasons) lines.push(`- ${r}`);
          lines.push("");
        }
        if (analysis.opportunityReasons.length > 0) {
          lines.push("**Opportunities:**");
          for (const o of analysis.opportunityReasons) lines.push(`- ${o}`);
          lines.push("");
        }
        if (analysis.recommendedActions.length > 0) {
          lines.push("**Recommended Action:**");
          lines.push(analysis.recommendedActions[0]);
          lines.push("");
        }
        lines.push("Ask me for details on any specific aspect.");
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }
    }

    if (context.recordId && context.recordType === "customer") {
      const analysis = analyzeCustomer(context.recordId);
      if (analysis) {
        const lines: string[] = [];
        lines.push("### Customer Analysis");
        lines.push("");
        lines.push("**Executive Summary:**");
        lines.push("");
        lines.push(analysis.overview);
        lines.push("");
        lines.push("**Current Situation:**");
        lines.push(`- Total Deals: ${analysis.totalDeals} (Open: ${analysis.openDeals}, Won: ${analysis.wonDeals}, Lost: ${analysis.lostDeals})`);
        lines.push(`- Total Revenue: ${(analysis.totalRevenueMinor / 100).toFixed(2)} SAR`);
        lines.push(`- Total Activities: ${analysis.totalActivities}, Total Tasks: ${analysis.totalTasks}`);
        lines.push(`- Open Tasks: ${analysis.openTasks}, Overdue: ${analysis.overdueTasks}`);
        lines.push(`- Last Activity: ${analysis.lastActivityAt || "None"} (${analysis.daysSinceLastActivity !== null ? `${analysis.daysSinceLastActivity} days ago` : "N/A"})`);
        lines.push("");
        if (analysis.predictions) {
          lines.push("**Predictions (Deterministic Model):");
          lines.push("");
          const p = analysis.predictions;
          lines.push(`- **Churn Risk:** ${p.churnRisk.value}% (Confidence: ${p.churnRisk.confidence})`);
          lines.push(`  - ${p.churnRisk.explanation}`);
          lines.push(`- **Follow-up Priority:** ${p.followUpPriority.value}% (Confidence: ${p.followUpPriority.confidence})`);
          lines.push(`  - ${p.followUpPriority.explanation}`);
          lines.push(`- **Engagement Score:** ${p.engagementScore.value}% (Confidence: ${p.engagementScore.confidence})`);
          lines.push(`  - ${p.engagementScore.explanation}`);
          lines.push("");
        }
        if (analysis.enhancedPredictions) {
          const ep = analysis.enhancedPredictions;
          lines.push("**Enhanced Predictive Intelligence:**");
          lines.push("");
          lines.push("**Relationship Health:**");
          lines.push(`- Score: ${ep.relationshipHealth.score} / 100 (${ep.relationshipHealth.level.toUpperCase()})`);
          ep.relationshipHealth.factors.forEach((f) => lines.push(`  - ${f}`));
          lines.push("");
          lines.push("**Opportunity Assessment:**");
          lines.push(`- Score: ${ep.opportunityScore.score} / 100 (${ep.opportunityScore.level.toUpperCase()})`);
          ep.opportunityScore.factors.forEach((f) => lines.push(`  - ${f}`));
          lines.push("");
          lines.push("**Next Best Action:**");
          lines.push(`- **${ep.nextBestAction.action}** (${ep.nextBestAction.priority.toUpperCase()})`);
          lines.push(`- Why: ${ep.nextBestAction.why}`);
          ep.nextBestAction.expectedImpact.forEach((impact) => lines.push(`  - Impact: ${impact}`));
          lines.push("");
          lines.push("**Data Quality:**");
          lines.push(`- Score: ${ep.dataQuality.score}% — ${ep.dataQuality.impactOnConfidence}`);
          if (ep.dataQuality.missingFields.length > 0) {
            lines.push(`- Missing: ${ep.dataQuality.missingFields.join(", ")}`);
          }
        }
        if (analysis.evidence.length > 0) {
          lines.push("**Evidence:**");
          for (const e of analysis.evidence) lines.push(`- ${e}`);
          lines.push("");
        }
        if (analysis.riskReasons.length > 0) {
          lines.push("**Risks:**");
          for (const r of analysis.riskReasons) lines.push(`- ${r}`);
          lines.push("");
        }
        if (analysis.opportunityReasons.length > 0) {
          lines.push("**Opportunities:**");
          for (const o of analysis.opportunityReasons) lines.push(`- ${o}`);
          lines.push("");
        }
        if (analysis.recommendedActions.length > 0) {
          lines.push("**Recommended Action:**");
          lines.push(analysis.recommendedActions[0]);
          lines.push("");
        }
        lines.push("Ask me for details on any specific aspect.");
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }
    }

    if (context.recordId && context.recordType === "lead") {
      const analysis = analyzeLead(context.recordId);
      if (analysis) {
        const lines: string[] = [];
        lines.push("### Lead Analysis");
        lines.push("");
        lines.push("**Executive Summary:**");
        lines.push("");
        lines.push(analysis.overview);
        lines.push("");
        lines.push("**Current Situation:**");
        lines.push(`- Stage: ${analysis.stage || "Unknown"}`);
        lines.push(`- Source: ${analysis.source || "Unknown"}`);
        lines.push(`- Age: ${analysis.ageDays !== null ? `${analysis.ageDays} days` : "Unknown"}`);
        lines.push(`- Engagement Trend: ${analysis.engagementTrend}`);
        lines.push(`- Conversion Potential: ${analysis.conversionPotential}`);
        lines.push(`- Total Activities: ${analysis.totalActivities}, Tasks: ${analysis.totalTasks}`);
        lines.push(`- Open Tasks: ${analysis.openTasks}, Overdue: ${analysis.overdueTasks}`);
        lines.push(`- Last Activity: ${analysis.lastActivityAt || "None"} (${analysis.daysSinceLastActivity !== null ? `${analysis.daysSinceLastActivity} days ago` : "N/A"})`);
        lines.push("");
        if (analysis.predictions) {
          lines.push("**Predictions (Deterministic Model):**");
          lines.push("");
          const p = analysis.predictions;
          lines.push(`- **Conversion Probability:** ${p.conversionProbability.value}% (Confidence: ${p.conversionProbability.confidence})`);
          lines.push(`  - ${p.conversionProbability.explanation}`);
          lines.push(`- **Follow-up Priority:** ${p.followUpPriority.value}% (Confidence: ${p.followUpPriority.confidence})`);
          lines.push(`  - ${p.followUpPriority.explanation}`);
          lines.push(`- **Engagement Score:** ${p.engagementScore.value}% (Confidence: ${p.engagementScore.confidence})`);
          lines.push(`  - ${p.engagementScore.explanation}`);
          lines.push("");
        }
        if (analysis.enhancedPredictions) {
          const ep = analysis.enhancedPredictions;
          lines.push("**Enhanced Predictive Intelligence:**");
          lines.push("");
          lines.push("**Lead Health:**");
          lines.push(`- Score: ${ep.leadHealth.score} / 100 (${ep.leadHealth.level.toUpperCase()})`);
          ep.leadHealth.factors.forEach((f) => lines.push(`  - ${f}`));
          lines.push("");
          lines.push("**Opportunity Assessment:**");
          lines.push(`- Score: ${ep.opportunityScore.score} / 100 (${ep.opportunityScore.level.toUpperCase()})`);
          ep.opportunityScore.factors.forEach((f) => lines.push(`  - ${f}`));
          lines.push("");
          lines.push("**Next Best Action:**");
          lines.push(`- **${ep.nextBestAction.action}** (${ep.nextBestAction.priority.toUpperCase()})`);
          lines.push(`- Why: ${ep.nextBestAction.why}`);
          ep.nextBestAction.expectedImpact.forEach((impact) => lines.push(`  - Impact: ${impact}`));
          lines.push("");
          lines.push("**Data Quality:**");
          lines.push(`- Score: ${ep.dataQuality.score}% — ${ep.dataQuality.impactOnConfidence}`);
          if (ep.dataQuality.missingFields.length > 0) {
            lines.push(`- Missing: ${ep.dataQuality.missingFields.join(", ")}`);
          }
        }
        if (analysis.evidence.length > 0) {
          lines.push("**Evidence:**");
          for (const e of analysis.evidence) lines.push(`- ${e}`);
          lines.push("");
        }
        if (analysis.riskReasons.length > 0) {
          lines.push("**Risks:**");
          for (const r of analysis.riskReasons) lines.push(`- ${r}`);
          lines.push("");
        }
        if (analysis.opportunityReasons.length > 0) {
          lines.push("**Opportunities:**");
          for (const o of analysis.opportunityReasons) lines.push(`- ${o}`);
          lines.push("");
        }
        if (analysis.recommendedActions.length > 0) {
          lines.push("**Recommended Action:**");
          lines.push(analysis.recommendedActions[0]);
          lines.push("");
        }
        lines.push("Ask me for details on any specific aspect.");
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }
    }

    if (context.recordId && context.recordType === "task") {
      const analysis = analyzeTask(context.recordId);
      if (analysis) {
        const lines: string[] = [];
        lines.push("### Task Analysis");
        lines.push("");
        lines.push("**Executive Summary:**");
        lines.push("");
        lines.push(analysis.overview);
        lines.push("");
        lines.push("**Current Situation:**");
        lines.push(`- Status: ${analysis.status ? analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1) : "Unknown"}`);
        lines.push(`- Assignee: ${analysis.assigneeName || "Unassigned"}`);
        lines.push(`- Due: ${analysis.dueAt || "No due date"}`);
        lines.push(`- Related Record: ${analysis.relatedRecordName || "None"} (${analysis.entityType || "N/A"})`);
        if (analysis.companyName) lines.push(`- Company: ${analysis.companyName}`);
        lines.push(`- Priority: ${analysis.priority.charAt(0).toUpperCase() + analysis.priority.slice(1)}`);
        lines.push("");
        if (analysis.evidence.length > 0) {
          lines.push("**Evidence:**");
          for (const e of analysis.evidence) lines.push(`- ${e}`);
          lines.push("");
        }
        if (analysis.relatedActivitiesSummary.length > 0) {
          lines.push("**Related Activities:**");
          for (const a of analysis.relatedActivitiesSummary.slice(0, 3)) lines.push(`- ${a}`);
          lines.push("");
        }
        if (analysis.recommendedNextSteps.length > 0) {
          lines.push("**Recommended Action:**");
          lines.push(analysis.recommendedNextSteps[0]);
          lines.push("");
        }
        lines.push("Ask me for details on any specific aspect.");
        yield* simulateStreamingResponse(lines.join("\n"));
        return;
      }
    }

    yield* simulateStreamingResponse("I can analyze your CRM records. Select a deal, lead, customer, or task and ask me to analyze it.");
  }

  cancel(): void {
    // Local provider has nothing to cancel
  }
}

export class OpenRouterProvider implements AIProvider {
  readonly type = "openrouter" as const;
  private controller: AbortController | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async *sendMessage(
    messages: ChatMessage[],
    context: PageContext
  ): AsyncIterable<string> {
    void messages;
    void context;
    yield "OpenRouter provider is not yet configured.";
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
  }
}
