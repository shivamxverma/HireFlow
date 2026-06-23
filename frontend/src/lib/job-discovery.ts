import type { Job } from "@/types/job";

type DiscoverySourceFilter = "all" | "linkedin" | "telegram" | "yc" | "wellfound";
type DiscoveryFreshnessFilter = "all" | "24h" | "72h" | "7d";

const SOURCE_WEIGHTS: Record<string, number> = {
  linkedin: 30,
  telegram: 28,
  wellfound: 12,
  yc: 10,
  manual: 0,
};

const POSITIVE_TITLE_PATTERNS = [
  /\bsoftware\b/,
  /\bengineer\b/,
  /\bdeveloper\b/,
  /\bfrontend\b/,
  /\bbackend\b/,
  /\bfull[\s-]?stack\b/,
  /\breact\b/,
  /\bnode\b/,
  /\btypescript\b/,
  /\bpython\b/,
  /\bdata\b/,
  /\bai\b/,
  /\bml\b/,
  /\bintern\b/,
  /\bnew grad\b/,
  /\bfresher\b/,
  /\bentry\b/,
];

const NEGATIVE_TITLE_PATTERNS = [
  /\bsenior\b/,
  /\bstaff\b/,
  /\bprincipal\b/,
  /\blead\b/,
  /\bmanager\b/,
  /\bdirector\b/,
  /\bhead\b/,
  /\bvp\b/,
  /\barchitect\b/,
];

const TECH_DESCRIPTION_PATTERNS = [
  /\breact\b/,
  /\bnext\.?js\b/,
  /\bnode\b/,
  /\btypescript\b/,
  /\bjavascript\b/,
  /\bpython\b/,
  /\bjava\b/,
  /\baws\b/,
  /\bdocker\b/,
  /\bkubernetes\b/,
  /\bsql\b/,
  /\bapi\b/,
  /\bllm\b/,
  /\bgenai\b/,
];

export type DiscoveryItem = Job & {
  channelName: string | null;
  freshness: "hot" | "recent" | "warm" | "stale";
  freshnessLabel: string;
  freshnessHours: number;
  relevanceScore: number;
  reasons: string[];
};

export type DiscoveryOptions = {
  query?: string;
  source?: DiscoverySourceFilter;
  freshness?: DiscoveryFreshnessFilter;
};

function safeLower(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

function parseChannelName(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }

  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed.channelName === "string") {
      return parsed.channelName;
    }
  } catch {
    return null;
  }

  return null;
}

function getFreshnessHours(job: Job): number {
  const createdAt = new Date(job.createdAt);
  const diffMs = Date.now() - createdAt.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}

function getFreshnessMeta(hours: number) {
  if (hours <= 24) {
    return { freshness: "hot" as const, label: "Hot: last 24h", score: 24 };
  }
  if (hours <= 72) {
    return { freshness: "recent" as const, label: "Recent: last 3d", score: 16 };
  }
  if (hours <= 168) {
    return { freshness: "warm" as const, label: "Warm: last 7d", score: 8 };
  }

  return { freshness: "stale" as const, label: "Older than 7d", score: 2 };
}

function buildReasons(job: Job, channelName: string | null, freshnessLabel: string, title: string, description: string) {
  const reasons: string[] = [];

  if (job.source === "linkedin") {
    reasons.push("Direct LinkedIn listing");
  }

  if (job.source === "telegram" && channelName) {
    reasons.push(`Telegram signal from ${channelName}`);
  }

  reasons.push(freshnessLabel);

  if (POSITIVE_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    reasons.push("Software-role title match");
  }

  if (/\b(remote|hybrid)\b/.test(safeLower(job.location))) {
    reasons.push("Flexible location");
  }

  if (TECH_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description))) {
    reasons.push("Tech stack mentioned");
  }

  if (job.applyUrl) {
    reasons.push("Has apply link");
  }

  return reasons.slice(0, 4);
}

export function scoreJob(job: Job): DiscoveryItem {
  const title = safeLower(job.title);
  const description = safeLower(job.description);
  const location = safeLower(job.location);
  const freshnessHours = getFreshnessHours(job);
  const freshnessMeta = getFreshnessMeta(freshnessHours);
  const channelName = parseChannelName(job.notes);

  let score = SOURCE_WEIGHTS[job.source] ?? 6;
  score += freshnessMeta.score;

  for (const pattern of POSITIVE_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      score += 4;
    }
  }

  for (const pattern of NEGATIVE_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      score -= 8;
    }
  }

  for (const pattern of TECH_DESCRIPTION_PATTERNS) {
    if (pattern.test(description)) {
      score += 2;
    }
  }

  if (/\b(remote|hybrid)\b/.test(location)) {
    score += 6;
  }

  if (job.applyUrl) {
    score += 4;
  }

  if (job.status && job.status !== "Not Applied") {
    score -= 12;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    ...job,
    channelName,
    freshness: freshnessMeta.freshness,
    freshnessLabel: freshnessMeta.label,
    freshnessHours,
    relevanceScore: score,
    reasons: buildReasons(job, channelName, freshnessMeta.label, title, description),
  };
}

function matchesQuery(job: DiscoveryItem, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    job.title,
    job.company,
    job.location,
    job.source,
    job.description || "",
    job.channelName || "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesFreshness(job: DiscoveryItem, freshness: DiscoveryFreshnessFilter) {
  if (freshness === "all") {
    return true;
  }

  if (freshness === "24h") {
    return job.freshnessHours <= 24;
  }

  if (freshness === "72h") {
    return job.freshnessHours <= 72;
  }

  return job.freshnessHours <= 168;
}

export function buildDiscoveryFeed(jobs: Job[], options: DiscoveryOptions = {}) {
  const normalizedQuery = safeLower(options.query).trim();
  const source = options.source || "all";
  const freshness = options.freshness || "all";

  return jobs
    .map(scoreJob)
    .filter((job) =>
      job.source === "linkedin" ||
      job.source === "telegram" ||
      job.source === "yc" ||
      job.source === "wellfound",
    )
    .filter((job) => (source === "all" ? true : job.source === source))
    .filter((job) => matchesFreshness(job, freshness))
    .filter((job) => matchesQuery(job, normalizedQuery))
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
}

export function getDiscoveryStats(items: DiscoveryItem[]) {
  const hot = items.filter((job) => job.freshness === "hot").length;
  const linkedin = items.filter((job) => job.source === "linkedin").length;
  const telegram = items.filter((job) => job.source === "telegram").length;
  const yc = items.filter((job) => job.source === "yc").length;
  const wellfound = items.filter((job) => job.source === "wellfound").length;
  const avgScore = items.length
    ? Math.round(items.reduce((total, job) => total + job.relevanceScore, 0) / items.length)
    : 0;

  return {
    total: items.length,
    hot,
    linkedin,
    telegram,
    yc,
    wellfound,
    avgScore,
  };
}
