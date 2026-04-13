/**
 * Google Business Profile API helper
 *
 * Uses the My Business / GBP v4 & v1 endpoints:
 *   - accounts.locations.reviews.list
 *   - accounts.locations.reviews.updateReply
 *
 * Requires a GBP_ACCESS_TOKEN (OAuth2 bearer) and the account + location IDs
 * stored per-outlet in ReviewSettings.
 */

const GBP_BASE = "https://mybusiness.googleapis.com/v4";

type GbpReview = {
  reviewId: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName: string;
  };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
};

type GbpReviewsResponse = {
  reviews: GbpReview[];
  averageRating: number;
  totalReviewCount: number;
  nextPageToken?: string;
};

export type NormalizedReview = {
  id: string;
  reviewer: {
    name: string;
    photoUrl?: string;
  };
  rating: number;
  comment?: string;
  createdAt: string;
  reply?: {
    comment: string;
    updatedAt: string;
  };
};

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function normalizeReview(r: GbpReview): NormalizedReview {
  return {
    id: r.reviewId,
    reviewer: {
      name: r.reviewer.displayName,
      photoUrl: r.reviewer.profilePhotoUrl,
    },
    rating: STAR_MAP[r.starRating] ?? 0,
    comment: r.comment,
    createdAt: r.createTime,
    reply: r.reviewReply
      ? { comment: r.reviewReply.comment, updatedAt: r.reviewReply.updateTime }
      : undefined,
  };
}

function getToken(): string {
  const token = process.env.GBP_ACCESS_TOKEN;
  if (!token) throw new Error("GBP_ACCESS_TOKEN not configured");
  return token;
}

export async function fetchGoogleReviews(
  accountId: string,
  locationName: string,
  pageSize = 50,
  pageToken?: string,
): Promise<{
  reviews: NormalizedReview[];
  averageRating: number;
  totalReviewCount: number;
  nextPageToken?: string;
}> {
  const token = getToken();
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(
    `${GBP_BASE}/${accountId}/${locationName}/reviews?${params}`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 60 } },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GBP API error ${res.status}: ${body}`);
  }

  const data: GbpReviewsResponse = await res.json();

  return {
    reviews: (data.reviews ?? []).map(normalizeReview),
    averageRating: data.averageRating ?? 0,
    totalReviewCount: data.totalReviewCount ?? 0,
    nextPageToken: data.nextPageToken,
  };
}

export async function replyToReview(
  accountId: string,
  locationName: string,
  reviewId: string,
  comment: string,
): Promise<void> {
  const token = getToken();

  const res = await fetch(
    `${GBP_BASE}/${accountId}/${locationName}/reviews/${reviewId}/reply`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GBP reply error ${res.status}: ${body}`);
  }
}
