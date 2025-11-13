import type { SupabaseClient } from "@supabase/supabase-js";

export const MIN_ACCOUNT_AGE_DAYS = 30;
export const MIN_RECENT_POSTS = 5;
export const MIN_FOLLOWERS = 500;
export const ENGAGEMENT_THRESHOLD = 30;
export const RECENT_ACTIVITY_WINDOW_DAYS = 30;
export const VERIFICATION_THRESHOLD = 70;

const FACTOR_DEFINITIONS = [
  {
    id: "account_age" as const,
    label: "Account age > 30 days",
    description: "User is active for a while",
    points: 10,
  },
  {
    id: "profile_completeness" as const,
    label: "Profile picture & bio filled",
    description: "Genuine profile setup",
    points: 10,
  },
  {
    id: "followers" as const,
    label: "Followers > 500",
    description: "Indicates influence",
    points: 20,
  },
  {
    id: "engagement" as const,
    label: "Average likes/comments above threshold",
    description: "Shows engagement",
    points: 20,
  },
  {
    id: "recent_posts" as const,
    label: "Regular posts (5+ last month)",
    description: "Active creator",
    points: 15,
  },
  {
    id: "reports" as const,
    label: "Reports or violations = 0",
    description: "Trustworthy account",
    points: 25,
  },
] as const;

export type VerificationFactorId = typeof FACTOR_DEFINITIONS[number]["id"];

export type VerificationFactorMetadata = {
  details?: string[];
} & Record<string, unknown>;

export type VerificationFactorResult = {
  id: VerificationFactorId;
  label: string;
  description: string;
  points: number;
  achieved: boolean;
  metadata?: VerificationFactorMetadata;
};

export type VerificationResult = {
  totalPoints: number;
  maxPoints: number;
  threshold: number;
  percentage: number;
  eligible: boolean;
  factors: VerificationFactorResult[];
  metrics: {
    accountAgeDays: number | null;
    followerCount: number;
    averageLikes: number;
    averageComments: number;
    averageEngagement: number;
    totalPosts: number;
    recentPosts: number;
    reportsCount: number | null;
    reportsCheckAvailable: boolean;
  };
};

const VERIFICATION_MAX_POINTS = FACTOR_DEFINITIONS.reduce((total, factor) => total + factor.points, 0);

const MS_IN_DAY = 1000 * 60 * 60 * 24;

type FactorOverride = {
  achieved: boolean;
  metadata?: VerificationFactorMetadata;
};

function buildFactors(overrides: Partial<Record<VerificationFactorId, FactorOverride>>): VerificationFactorResult[] {
  return FACTOR_DEFINITIONS.map((definition) => ({
    ...definition,
    achieved: overrides[definition.id]?.achieved ?? false,
    metadata: overrides[definition.id]?.metadata,
  }));
}

function createDefaultResult(): VerificationResult {
  return {
    totalPoints: 0,
    maxPoints: VERIFICATION_MAX_POINTS,
    threshold: VERIFICATION_THRESHOLD,
    percentage: 0,
    eligible: false,
    factors: buildFactors({}),
    metrics: {
      accountAgeDays: null,
      followerCount: 0,
      averageLikes: 0,
      averageComments: 0,
      averageEngagement: 0,
      totalPosts: 0,
      recentPosts: 0,
      reportsCount: null,
      reportsCheckAvailable: false,
    },
  };
}

export async function evaluateUserVerification(
  supabase: SupabaseClient<any>,
  userId: string
): Promise<VerificationResult> {
  const now = new Date();

  const profileBasics = await fetchProfileBasics(supabase, userId);
  if (!profileBasics) {
    return createDefaultResult();
  }

  const postStats = await fetchPostStats(supabase, userId, now);
  const reportStats = await fetchReportStats(supabase, userId);

  const accountAge = evaluateAccountAge(profileBasics.createdAt, now);
  const profileCompleteness = evaluateProfileCompleteness(profileBasics.hasAvatar, profileBasics.hasBio);
  const followerInfluence = evaluateFollowerInfluence(profileBasics.followerCount);
  const engagement = evaluateEngagement(postStats);
  const recentActivity = evaluateRecentActivity(postStats.recentPosts);
  const reportCleanliness = evaluateReportHistory(reportStats);

  const factors = buildFactors({
    account_age: {
      achieved: accountAge.achieved,
      metadata: { details: accountAge.details },
    },
    profile_completeness: {
      achieved: profileCompleteness.achieved,
      metadata: { details: profileCompleteness.details },
    },
    followers: {
      achieved: followerInfluence.achieved,
      metadata: { details: followerInfluence.details },
    },
    engagement: {
      achieved: engagement.achieved,
      metadata: { details: engagement.details },
    },
    recent_posts: {
      achieved: recentActivity.achieved,
      metadata: { details: recentActivity.details },
    },
    reports: {
      achieved: reportCleanliness.achieved,
      metadata: { details: reportCleanliness.details },
    },
  });

  const totalPoints = factors.reduce((sum, factor) => sum + (factor.achieved ? factor.points : 0), 0);
  const percentage = VERIFICATION_MAX_POINTS > 0 ? Math.round((totalPoints / VERIFICATION_MAX_POINTS) * 100) : 0;
  const eligible = totalPoints >= VERIFICATION_THRESHOLD;

  return {
    totalPoints,
    maxPoints: VERIFICATION_MAX_POINTS,
    threshold: VERIFICATION_THRESHOLD,
    percentage,
    eligible,
    factors,
    metrics: {
  accountAgeDays: accountAge.days ?? null,
      followerCount: profileBasics.followerCount,
      averageLikes: postStats.averageLikes,
      averageComments: postStats.averageComments,
      averageEngagement: postStats.averageEngagement,
      totalPosts: postStats.totalPosts,
      recentPosts: postStats.recentPosts,
      reportsCount: reportStats.available ? reportStats.reportsCount : null,
      reportsCheckAvailable: reportStats.available,
    },
  };
}

type ProfileBasics = {
  createdAt: Date | null;
  hasAvatar: boolean;
  hasBio: boolean;
  followerCount: number;
};

async function fetchProfileBasics(supabase: SupabaseClient<any>, userId: string): Promise<ProfileBasics | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("created_at, avatar_url, bio, follower_count")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    createdAt: data.created_at ? new Date(data.created_at) : null,
    hasAvatar: Boolean(data.avatar_url && data.avatar_url.trim().length > 0),
    hasBio: Boolean(data.bio && data.bio.trim().length > 0),
    followerCount: data.follower_count ?? 0,
  };
}

type PostStats = {
  totalPosts: number;
  averageLikes: number;
  averageComments: number;
  averageEngagement: number;
  recentPosts: number;
};

async function fetchPostStats(
  supabase: SupabaseClient<any>,
  userId: string,
  referenceDate: Date
): Promise<PostStats> {
  const { data, error } = await supabase
    .from("posts")
    .select("like_count, comment_count, created_at")
    .eq("user_id", userId);

  if (error || !data) {
    return {
      totalPosts: 0,
      averageLikes: 0,
      averageComments: 0,
      averageEngagement: 0,
      recentPosts: 0,
    };
  }

  const totalPosts = data.length;
  const totalLikes = data.reduce((sum, post) => sum + (post.like_count ?? 0), 0);
  const totalComments = data.reduce((sum, post) => sum + (post.comment_count ?? 0), 0);

  const averageLikes = totalPosts > 0 ? totalLikes / totalPosts : 0;
  const averageComments = totalPosts > 0 ? totalComments / totalPosts : 0;
  const averageEngagement = averageLikes + averageComments;

  const windowStart = new Date(referenceDate.getTime() - RECENT_ACTIVITY_WINDOW_DAYS * MS_IN_DAY);
  const recentPosts = data.filter((post) => {
    if (!post.created_at) {
      return false;
    }
    return new Date(post.created_at) >= windowStart;
  }).length;

  return {
    totalPosts,
    averageLikes,
    averageComments,
    averageEngagement,
    recentPosts,
  };
}

type ReportStats = {
  available: boolean;
  reportsCount: number;
};

async function fetchReportStats(supabase: SupabaseClient<any>, userId: string): Promise<ReportStats> {
  const { count, error } = await supabase
    .from("user_reports")
    .select("id", { head: true, count: "exact" })
    .eq("reported_user_id", userId);

  if (error) {
    return {
      available: false,
      reportsCount: 0,
    };
  }

  return {
    available: true,
    reportsCount: count ?? 0,
  };
}

type EvaluationDetails = {
  achieved: boolean;
  details: string[];
  days?: number | null;
};

function evaluateAccountAge(createdAt: Date | null, referenceDate: Date): EvaluationDetails {
  if (!createdAt) {
    return {
      achieved: false,
      details: ["Account creation date unavailable"],
      days: null,
    };
  }

  const days = Math.floor((referenceDate.getTime() - createdAt.getTime()) / MS_IN_DAY);
  const achieved = days >= MIN_ACCOUNT_AGE_DAYS;

  return {
    achieved,
    details: [
      `Account age: ${days} days`,
      `Requires: ${MIN_ACCOUNT_AGE_DAYS}+ days`,
    ],
    days,
  };
}

function evaluateProfileCompleteness(hasAvatar: boolean, hasBio: boolean): EvaluationDetails {
  return {
    achieved: hasAvatar && hasBio,
    details: [
      hasAvatar ? "Profile picture added" : "Add a profile picture",
      hasBio ? "Bio completed" : "Add a descriptive bio",
    ],
  };
}

function evaluateFollowerInfluence(followerCount: number): EvaluationDetails {
  return {
    achieved: followerCount >= MIN_FOLLOWERS,
    details: [`Followers: ${followerCount} (needs ${MIN_FOLLOWERS}+)`],
  };
}

function evaluateEngagement(stats: PostStats): EvaluationDetails {
  return {
    achieved: stats.totalPosts > 0 && stats.averageEngagement >= ENGAGEMENT_THRESHOLD,
    details: [
      `Avg likes: ${stats.averageLikes.toFixed(1)}`,
      `Avg comments: ${stats.averageComments.toFixed(1)}`,
      `Combined engagement: ${stats.averageEngagement.toFixed(1)} (needs ${ENGAGEMENT_THRESHOLD}+)`,
    ],
  };
}

function evaluateRecentActivity(recentPosts: number): EvaluationDetails {
  return {
    achieved: recentPosts >= MIN_RECENT_POSTS,
    details: [`Posts in last ${RECENT_ACTIVITY_WINDOW_DAYS} days: ${recentPosts} (needs ${MIN_RECENT_POSTS}+)`],
  };
}

function evaluateReportHistory(reportStats: ReportStats): EvaluationDetails {
  if (!reportStats.available) {
    return {
      achieved: true,
      details: ["Moderation data unavailable; configure reports tracking"],
    };
  }

  const achieved = reportStats.reportsCount === 0;

  return {
    achieved,
    details: [`Reported incidents: ${reportStats.reportsCount}`],
  };
}
