export type PageName =
  | "dashboard"
  | "customers"
  | "leads"
  | "deals"
  | "activities"
  | "tasks"
  | "reports"
  | "settings"
  | "ai";

export interface PageContext {
  page: PageName;
  recordId?: string;
  recordType?: "customer" | "lead" | "deal" | "activity" | "task";
  recordName?: string;
  recordCompany?: string;
  recordStage?: string;
  recordOwner?: string;
  recordStatus?: string;
  currentFilters?: Record<string, unknown>;
  route: string;
  metadata?: Record<string, unknown>;
}

export type MessageRole = "user" | "assistant";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size?: number;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  attachments?: Attachment[];
  suggestedActions?: SuggestedAction[];
}

export interface SuggestedAction {
  id: string;
  label: string;
  type: ActionType;
  payload: Record<string, unknown>;
}

export type ActionType =
  | "create_task"
  | "create_activity"
  | "create_lead"
  | "create_deal"
  | "create_note"
  | "update_deal_stage"
  | "assign_owner"
  | "schedule_followup";

export interface AIAction {
  id: string;
  type: ActionType;
  label: string;
  params: Record<string, unknown>;
  context?: PageContext;
}

export type ActionStatus = "pending" | "confirmed" | "executing" | "executed" | "failed" | "cancelled";

export interface ActionHistoryEntry {
  id: string;
  action: AIAction;
  status: ActionStatus;
  timestamp: number;
  result?: Record<string, unknown>;
  error?: string;
}

export interface VoiceSettings {
  enabled: boolean;
  voice: string;
  speed: number;
  autoRead: boolean;
}

export interface SuggestedPrompt {
  id: string;
  text: string;
  context?: PageName;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  context?: PageContext;
}

export interface ProviderConfig {
  provider: AIProviderType;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export type AIProviderType = "local" | "openrouter";

export interface AIProvider {
  readonly type: AIProviderType;
  sendMessage(
    messages: ChatMessage[],
    context: PageContext
  ): AsyncIterable<string>;
  cancel(): void;
}

export interface AIProviderResponse {
  content: string;
  suggestedActions?: SuggestedAction[];
}

export interface AIProviderOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface CopilotState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isOpen: boolean;
  isTyping: boolean;
  pageContext: PageContext;
  error: string | null;
  pendingAction: AIAction | null;
  actionHistory: ActionHistoryEntry[];
  voiceSettings: VoiceSettings;
  conversationMemory: Record<string, string | undefined>;
}

export interface CRMContextData {
  page: string;
  recordId?: string;
  recordType?: string;
  recordName?: string;
  recordCompany?: string;
  recordStage?: string;
  recordOwner?: string;
  recordStatus?: string;
  currentFilters?: Record<string, unknown>;
  route: string;
  language?: string;
  metrics: {
    totalCustomers: number;
    totalLeads: number;
    totalDeals: number;
    totalRevenueMinor: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    totalActivities: number;
    totalTasks: number;
    overdueTasks: number;
  };
  recentActivities: Array<{
    id: string;
    type: string;
    body: string;
    direction: string;
    occurredAt: string;
    userName: string;
  }>;
  dashboardKpis?: {
    revenue: number;
    conversionRate: number;
    winRate: number;
  };
  customer?: {
    id: string;
    name: string;
    city: string;
    industry: string | null;
    source: string | null;
    status: string | null;
    ownerName: string | null;
    tags?: string[];
    notes: string | null;
    lastActivity?: string;
    totalDeals: number;
    totalTasks: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    totalRevenueMinor: number;
    currencyCode: string;
    activitiesTimeline?: Array<{
      id: string;
      type: string;
      body: string;
      direction: string;
      occurredAt: string;
      userName: string;
    }>;
    tasksTimeline?: Array<{
      id: string;
      title: string;
      dueAt: string;
      completedAt: string;
      assigneeName: string;
      mode: string;
    }>;
  };
  lead?: {
    id: string;
    fullName: string;
    company: string | null;
    phone: string | null;
    email: string | null;
    stage: string | null;
    source: string | null;
    ownerName: string | null;
    probabilityPct: number | null;
    notes: string | null;
    created_at?: string | null;
    dealsCount?: number;
    openDeals?: number;
    wonDeals?: number;
    lostDeals?: number;
    totalRevenueMinor?: number;
    activitiesTimeline?: Array<{
      id: string;
      type: string;
      body: string;
      direction: string;
      occurredAt: string;
      userName: string;
    }>;
    tasksTimeline?: Array<{
      id: string;
      title: string;
      dueAt: string;
      completedAt: string;
      assigneeName: string;
      mode: string;
    }>;
  };
  deal?: {
    id: string;
    name: string;
    company: string | null;
    leadName: string | null;
    stage: string | null;
    ownerName: string | null;
    expectedValueMinor: number | null;
    wonValueMinor: number | null;
    probabilityPct: number | null;
    targetCloseDate: string | null;
    status: string | null;
    notes: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    latestActivities: Array<{
      id: string;
      type: string;
      body: string;
      direction: string;
      occurredAt: string;
      userName: string;
    }>;
    activitiesTimeline?: Array<{
      id: string;
      type: string;
      body: string;
      direction: string;
      occurredAt: string;
      userName: string;
    }>;
    tasksTimeline?: Array<{
      id: string;
      title: string;
      dueAt: string;
      completedAt: string;
      assigneeName: string;
      mode: string;
    }>;
  };
  taskSummary?: {
    overdue: Array<{ id: string; title: string; dueAt: string; assigneeName: string }>;
    upcoming: Array<{ id: string; title: string; dueAt: string; assigneeName: string }>;
    completed: Array<{ id: string; title: string; completedAt: string; assigneeName: string }>;
    byOwner: Record<string, { overdue: number; upcoming: number; completed: number }>;
  };
  activitiesSummary?: {
    latest: Array<{
      id: string;
      type: string;
      body: string;
      direction: string;
      occurredAt: string;
      userName: string;
    }>;
    timeline: Array<{
      id: string;
      kind: string;
      body: string;
      direction: string;
      occurredAt: string;
      userName: string;
      label: string;
    }>;
    communicationHistory: Array<{
      id: string;
      type: string;
      body: string;
      direction: string;
      occurredAt: string;
      userName: string;
    }>;
  };
  reportsContext?: {
    currentFilters: Record<string, unknown>;
    analytics?: Record<string, unknown>;
  };
  aiWorkspace?: {
    calculatedMetrics?: {
      leadConversionRate: number;
      averageDealValue: number;
      winRate: number;
      overdueTaskCount: number;
      inactiveCustomers: number;
      dealsWithNoRecentActivity: number;
      openDeals: number;
      wonDeals: number;
      lostDeals: number;
      totalRevenueMinor: number;
      openTasks: number;
      leads: number;
    };
    recommendations?: Array<{
      id: string;
      priority: string;
      title: string;
      description: string;
      actionLabel: string;
    }>;
    executiveSummary?: string;
    insights?: Array<{
      id: string;
      severity: string;
      title: string;
      description: string;
    }>;
    lossPatterns?: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      description: string;
      evidence: string[];
      sampleSize: number;
      confidence: string;
      businessImpact: string;
    }>;
    conversionPatterns?: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      description: string;
      evidence: string[];
      sampleSize: number;
      confidence: string;
      businessImpact: string;
    }>;
    stageBottlenecks?: Array<{
      id: string;
      stage: string;
      stageColor: string | null;
      totalDeals: number;
      avgDaysInStage: number;
      stalledDeals: number;
      bottleneckScore: number;
      severity: string;
      recommendation: string;
    }>;
  };
  entitySearchResults?: {
    customers: Array<{ id: string; name: string }>;
    leads: Array<{ id: string; fullName: string; company: string | null }>;
    deals: Array<{ id: string; name: string; company: string | null; stage: string | null }>;
    owners: Array<{ id: string; name: string }>;
    tasks: Array<{ id: string; title: string; assigneeName: string | null }>;
    activities: Array<{ id: string; body: string; occurredAt: string }>;
  };
  dealStatistics?: {
    open: number;
    won: number;
    lost: number;
    totalRevenueMinor: number;
    stages: Array<{ label: string | null; color: string | null; count: number }>;
  };
  ownerPerformance?: Array<{
    id: string;
    name: string;
    wonDeals: number;
    totalDeals: number;
    conversionRate: number;
    overdueTasks: number;
    totalTasks: number;
  }>;
  conversationMemory?: {
    currentCustomerId?: string;
    currentLeadId?: string;
    currentDealId?: string;
    currentOwnerId?: string;
  };
  customerAnalysis?: {
    id: string;
    name: string;
    ownerName: string | null;
    status: string | null;
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    totalRevenueMinor: number;
    totalActivities: number;
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
    lastActivityAt: string | null;
    daysSinceLastActivity: number | null;
    avgDealValueMinor: number | null;
    dealValueInPipelineMinor: number | null;
    hasActiveOpportunities: boolean;
    hasOverdueFollowUps: boolean;
    hasStaleDeals: boolean;
    riskLevel: "low" | "medium" | "high" | "critical";
    riskReasons: string[];
    opportunityReasons: string[];
    recommendedActions: string[];
    evidence: string[];
    overview: string;
    timeline: Array<{
      kind: string;
      occurredAt: string;
      label: string;
      body: string;
      userName: string;
    }>;
    activitiesByType: Record<string, number>;
    predictions?: {
      churnRisk: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
      followUpPriority: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
      engagementScore: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    };
    enhancedPredictions?: {
      relationshipHealth: { score: number; level: string; factors: string[] };
      opportunityScore: { score: number; level: string; factors: string[]; evidence: string[] };
      nextBestAction: { action: string; priority: string; why: string; expectedImpact: string[]; deadline: string | null; negativeConsequence?: string };
      dataQuality: { score: number; missingFields: string[]; completeness: Record<string, boolean>; impactOnConfidence: string };
    };
  };
  leadAnalysis?: {
    id: string;
    fullName: string;
    company: string | null;
    stage: string | null;
    source: string | null;
    ownerName: string | null;
    probabilityPct: number | null;
    created_at: string | null;
    ageDays: number | null;
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    totalRevenueMinor: number;
    totalActivities: number;
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
    lastActivityAt: string | null;
    daysSinceLastActivity: number | null;
    engagementTrend: "increasing" | "stable" | "decreasing" | "none";
    conversionPotential: "high" | "medium" | "low";
    health: "healthy" | "at-risk" | "stale" | "cold";
    riskReasons: string[];
    opportunityReasons: string[];
    recommendedActions: string[];
    evidence: string[];
    overview: string;
    timeline: Array<{
      kind: string;
      occurredAt: string;
      label: string;
      body: string;
      userName: string;
    }>;
    predictions?: {
      conversionProbability: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
      followUpPriority: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
      engagementScore: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    };
    enhancedPredictions?: {
      leadHealth: { score: number; level: string; factors: string[] };
      opportunityScore: { score: number; level: string; factors: string[]; evidence: string[] };
      nextBestAction: { action: string; priority: string; why: string; expectedImpact: string[]; deadline: string | null; negativeConsequence?: string };
      dataQuality: { score: number; missingFields: string[]; completeness: Record<string, boolean>; impactOnConfidence: string };
    };
  };
  dealAnalysis?: {
    id: string;
    name: string;
    company: string | null;
    leadName: string | null;
    stage: string | null;
    ownerName: string | null;
    expectedValueMinor: number | null;
    wonValueMinor: number | null;
    probabilityPct: number | null;
    targetCloseDate: string | null;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
    ageDays: number | null;
    daysSinceLastActivity: number | null;
    daysInCurrentStage: number | null;
    totalActivities: number;
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
    activityFrequencyPerWeek: number | null;
    engagementTrend: "increasing" | "stable" | "decreasing" | "none";
    isStalled: boolean;
    isOverdue: boolean;
    health: "healthy" | "at-risk" | "stalled" | "critical";
    riskReasons: string[];
    opportunityReasons: string[];
    recommendedActions: string[];
    evidence: string[];
    missingInformation: string[];
    overview: string;
    timeline: Array<{
      kind: string;
      occurredAt: string;
      label: string;
      body: string;
      userName: string;
    }>;
    stagesProgression: Array<{
      stage: string;
      changedAt: string | null;
      durationDays: number | null;
    }>;
    stageSummary: {
      totalStageChanges: number;
      currentStageAge: number | null;
      totalDealAge: number | null;
      avgStageDuration: number | null;
      isProlongedInCurrentStage: boolean;
    };
    predictions?: {
      winProbability: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
      stagnationRisk: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
      followUpPriority: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
      engagementScore: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    };
    enhancedPredictions?: {
      aiWinProbability: number;
      aiLossProbability: number;
      aiStallProbability: number;
      overallConfidence: "high" | "medium" | "low";
      expectedCloseWindow: string | null;
      dealHealth: { score: number; level: string; factors: string[] };
      riskScore: { overall: number; level: string; categories: Record<string, number>; primaryRisk: string; secondaryRisks: string[] };
      opportunityScore: { score: number; level: string; factors: string[]; evidence: string[] };
      historicalBenchmark: { comparableDeals: number; won: number; lost: number; stalled: number; historicalWinRate: number; avgTimeToClose: number | null; avgStageDuration: number | null; avgActivityFrequency: number | null; confidence: string };
      similarDeals: Array<{ id: string; name: string; stage: string; outcome: string | null; expectedValueMinor: number | null; daysToClose: number | null; similarityScore: number }>;
      temporalAnalysis: { engagementTrend: string; activityTrend: string; responseTrend: string; taskCompletionTrend: string; inactivityPeriods: Array<{ start: string; end: string; days: number }>; acceleration: string; evidence: string[] };
      turningPoints: Array<{ date: string; type: string; description: string; impact: string }>;
      anomalies: Array<{ type: string; description: string; severity: string; evidence: string[] }>;
      nextBestAction: { action: string; priority: string; why: string; expectedImpact: string[]; deadline: string | null; negativeConsequence?: string };
      whatIfScenarios: Array<{ scenario: string; estimatedProbability: number | null; estimatedRisk: number | null; reasoning: string; confidence: string }>;
      dataQuality: { score: number; missingFields: string[]; completeness: Record<string, boolean>; impactOnConfidence: string };
      explainability: { positiveFactors: string[]; negativeFactors: string[]; neutralFactors: string[]; historicalEvidence: string[]; confidence: string; confidenceReason: string };
    };
  };
  taskAnalysis?: {
    id: string;
    title: string;
    description: string | null;
    mode: string | null;
    assigneeName: string | null;
    dueAt: string | null;
    completedAt: string | null;
    status: "open" | "completed" | null;
    relatedRecordName: string | null;
    companyName: string | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: string | null;
    isOverdue: boolean;
    daysOverdue: number | null;
    daysUntilDue: number | null;
    relatedRecordStage: string | null;
    relatedRecordValueMinor: number | null;
    relatedRecordLastActivityAt: string | null;
    relatedRecordDaysSinceActivity: number | null;
    relatedRecordOpenDeals: number;
    priority: "high" | "medium" | "low";
    whyItMatters: string;
    recommendedNextSteps: string[];
    relatedActivitiesSummary: string[];
    evidence: string[];
    overview: string;
  };
  globalAnalysis?: {
    todayPriorities: Array<{
      type: string;
      id: string;
      label: string;
      reason: string;
      value: string;
    }>;
    atRiskDeals: Array<{
      id: string;
      name: string;
      company: string | null;
      stage: string | null;
      expectedValueMinor: number | null;
      riskLevel: string;
      reason: string;
    }>;
    customersRequiringAttention: Array<{
      id: string;
      name: string;
      reason: string;
      daysSinceActivity: number | null;
      openDeals: number;
    }>;
    overdueTasksSummary: {
      total: number;
      byAssignee: Record<string, number>;
      linkedToHighValueDeals: number;
    };
    followUpOpportunities: Array<{
      id: string;
      label: string;
      reason: string;
    }>;
    topPerformers: Array<{
      id: string;
      name: string;
      wonDeals: number;
      conversionRate: number;
    }>;
    timeline: Array<{
      date: string;
      events: Array<{
        kind: string;
        body: string;
        userName: string;
      }>;
    }>;
  };
}
