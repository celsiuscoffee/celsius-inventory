/**
 * Sync Indeed Sponsored Jobs into indeed_ads_job + indeed_ads_metric_daily.
 *
 * Strategy:
 *   1. List all campaigns                          → /v1/campaigns
 *   2. For each campaign, list jobs                → /v1/campaigns/{id}/jobs
 *   3. For each job, pull daily stats over window  → /v1/campaigns/{id}/stats/{date}
 *
 * Writes are idempotent — upsert by (indeedJobId) for jobs, by
 * (date, jobId) for daily metrics.
 *
 * NOTE: Indeed's API surface is partner-gated; the exact endpoint shapes
 * may differ slightly per account tier. If a call 404s, check the
 * Sponsored Jobs API reference at docs.indeed.com and adjust the path /
 * response field names below — the OAuth flow and DB write pattern stay
 * the same.
 */

import { prisma } from "@/lib/prisma";
import { indeedFetch } from "./client";
import { resolveOutletId } from "./outlet-map";

type IndeedCampaign = {
  id: string;
  name: string;
  status?: string;
};

type IndeedJob = {
  jobKey: string;
  jobTitle: string;
  jobLocation?: { city?: string; admin1?: string };
  status?: string;
  premium?: boolean;
};

type IndeedDailyStat = {
  date: string;          // YYYY-MM-DD
  impressions?: number;
  clicks?: number;
  applyStarts?: number;
  applies?: number;
  spend?: number;        // USD
};

export type SyncResult = {
  campaignsSeen: number;
  jobsUpserted:  number;
  metricsUpserted: number;
};

/**
 * Pull data for the given date window (inclusive).
 * Defaults to last 30 days ending today.
 */
export async function syncIndeed(opts: { from?: Date; to?: Date } = {}): Promise<SyncResult> {
  const to = opts.to ?? new Date();
  const from = opts.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  let campaignsSeen = 0;
  let jobsUpserted = 0;
  let metricsUpserted = 0;

  // 1. List campaigns
  const { campaigns } = await indeedFetch<{ campaigns: IndeedCampaign[] }>("/v1/campaigns");
  campaignsSeen = campaigns.length;

  for (const campaign of campaigns) {
    // 2. List jobs in this campaign
    let jobs: IndeedJob[] = [];
    try {
      const r = await indeedFetch<{ jobs: IndeedJob[] }>(`/v1/campaigns/${campaign.id}/jobs`);
      jobs = r.jobs ?? [];
    } catch (err) {
      console.warn(`[indeed] campaign ${campaign.id} jobs fetch failed:`, err);
      continue;
    }

    for (const job of jobs) {
      const city  = job.jobLocation?.city ?? null;
      const state = job.jobLocation?.admin1 ?? null;
      const outletId = await resolveOutletId(city);

      const upserted = await prisma.indeedAdsJob.upsert({
        where:  { indeedJobId: job.jobKey },
        create: {
          indeedJobId:   job.jobKey,
          campaignId:    campaign.id,
          campaignName:  campaign.name,
          title:         job.jobTitle,
          locationCity:  city,
          locationState: state,
          outletId,
          status:        job.status,
          premium:       job.premium ?? false,
        },
        update: {
          campaignId:    campaign.id,
          campaignName:  campaign.name,
          title:         job.jobTitle,
          locationCity:  city,
          locationState: state,
          outletId,
          status:        job.status,
          premium:       job.premium ?? false,
          lastSyncedAt:  new Date(),
        },
      });
      jobsUpserted++;

      // 3. Daily stats for this job's campaign over the window.
      //    Indeed reports daily stats at campaign granularity, not job,
      //    on most plans. If you have job-level reports, swap the
      //    endpoint to /v1/jobs/{jobKey}/stats/{date}.
      for (const date of eachDay(from, to)) {
        try {
          const stat = await indeedFetch<IndeedDailyStat>(
            `/v1/campaigns/${campaign.id}/stats/${formatDate(date)}`,
          );
          await prisma.indeedAdsMetricDaily.upsert({
            where:  { date_jobId: { date, jobId: upserted.id } },
            create: {
              date,
              jobId:        upserted.id,
              impressions:  BigInt(stat.impressions ?? 0),
              clicks:       BigInt(stat.clicks ?? 0),
              applyStarts:  BigInt(stat.applyStarts ?? 0),
              applies:      BigInt(stat.applies ?? 0),
              spendUsd:     stat.spend ?? 0,
              costPerClick: stat.clicks && stat.clicks > 0  ? (stat.spend ?? 0) / stat.clicks : null,
              costPerApply: stat.applies && stat.applies > 0 ? (stat.spend ?? 0) / stat.applies : null,
            },
            update: {
              impressions:  BigInt(stat.impressions ?? 0),
              clicks:       BigInt(stat.clicks ?? 0),
              applyStarts:  BigInt(stat.applyStarts ?? 0),
              applies:      BigInt(stat.applies ?? 0),
              spendUsd:     stat.spend ?? 0,
              costPerClick: stat.clicks && stat.clicks > 0  ? (stat.spend ?? 0) / stat.clicks : null,
              costPerApply: stat.applies && stat.applies > 0 ? (stat.spend ?? 0) / stat.applies : null,
              syncedAt:     new Date(),
            },
          });
          metricsUpserted++;
        } catch (err) {
          console.warn(`[indeed] stat fetch failed for ${campaign.id} ${formatDate(date)}:`, err);
        }
      }
    }
  }

  return { campaignsSeen, jobsUpserted, metricsUpserted };
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end    = new Date(Date.UTC(to.getUTCFullYear(),   to.getUTCMonth(),   to.getUTCDate()));
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
