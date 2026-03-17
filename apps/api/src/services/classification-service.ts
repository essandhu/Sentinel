import { eq, inArray } from 'drizzle-orm';
import {
  diffClassifications,
  diffRegions,
  classificationOverrides,
  diffReports,
  snapshots,
  layoutShifts,
  type Db,
} from '@sentinel-vrt/db';

/** Shape of a region within a classification */
export interface ClassificationRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  relX: number;
  relY: number;
  relWidth: number;
  relHeight: number;
  pixelCount: number;
  regionCategory: string | null;
  regionConfidence: number | null;
  spatialZone: string | null;
}

/** Shape of a classification with nested regions */
export interface Classification {
  diffReportId: string;
  category: string;
  confidence: number;
  reasons: string[];
  modelVersion: string | null;
  regions: ClassificationRegion[];
}

/**
 * Select fields and join pattern shared by classification queries.
 */
function classificationSelectFields() {
  return {
    diffReportId: diffClassifications.diffReportId,
    category: diffClassifications.category,
    confidence: diffClassifications.confidence,
    reasons: diffClassifications.reasons,
    modelVersion: diffClassifications.modelVersion,
    regionId: diffRegions.id,
    x: diffRegions.x,
    y: diffRegions.y,
    width: diffRegions.width,
    height: diffRegions.height,
    relX: diffRegions.relX,
    relY: diffRegions.relY,
    relWidth: diffRegions.relWidth,
    relHeight: diffRegions.relHeight,
    pixelCount: diffRegions.pixelCount,
    regionCategory: diffRegions.regionCategory,
    regionConfidence: diffRegions.regionConfidence,
    spatialZone: diffRegions.spatialZone,
  };
}

/**
 * Group flat classification+region rows into nested Classification objects.
 * Returns a Map keyed by diffReportId.
 */
function groupClassificationRows(
  rows: Array<{
    diffReportId: string;
    category: string;
    confidence: number;
    reasons: string | null;
    modelVersion: string | null;
    regionId: string | null;
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
    relX: number | null;
    relY: number | null;
    relWidth: number | null;
    relHeight: number | null;
    pixelCount: number | null;
    regionCategory: string | null;
    regionConfidence: number | null;
    spatialZone: string | null;
  }>,
): Map<string, Classification> {
  const grouped = new Map<string, Classification>();

  for (const row of rows) {
    if (!grouped.has(row.diffReportId)) {
      let reasons: string[] = [];
      if (row.reasons) {
        try {
          reasons = JSON.parse(row.reasons);
        } catch {
          reasons = [row.reasons];
        }
      }

      grouped.set(row.diffReportId, {
        diffReportId: row.diffReportId,
        category: row.category,
        confidence: row.confidence,
        reasons,
        modelVersion: row.modelVersion ?? null,
        regions: [],
      });
    }

    // Add region if present (left join may produce null regionId)
    if (row.regionId != null) {
      grouped.get(row.diffReportId)!.regions.push({
        x: row.x!,
        y: row.y!,
        width: row.width!,
        height: row.height!,
        relX: row.relX!,
        relY: row.relY!,
        relWidth: row.relWidth!,
        relHeight: row.relHeight!,
        pixelCount: row.pixelCount!,
        regionCategory: row.regionCategory ?? null,
        regionConfidence: row.regionConfidence ?? null,
        spatialZone: row.spatialZone ?? null,
      });
    }
  }

  return grouped;
}

/**
 * Query classifications for all diffs in a capture run.
 * Joins through snapshots -> diffReports -> diffClassifications, with left-joined diffRegions.
 * Groups flat rows into nested classification objects with regions arrays.
 *
 * Pure function with Db as first parameter -- usable from tRPC routers, GraphQL resolvers, or REST handlers.
 */
export async function getClassificationsByRunId(
  db: Db,
  runId: string,
): Promise<Classification[]> {
  const rows = await db
    .select(classificationSelectFields())
    .from(diffClassifications)
    .innerJoin(diffReports, eq(diffReports.id, diffClassifications.diffReportId))
    .innerJoin(snapshots, eq(snapshots.id, diffReports.snapshotId))
    .leftJoin(diffRegions, eq(diffRegions.diffReportId, diffClassifications.diffReportId))
    .where(eq(snapshots.runId, runId));

  if (rows.length === 0) {
    return [];
  }

  return Array.from(groupClassificationRows(rows).values());
}

/**
 * Batch-fetch classifications by diff report IDs.
 * Designed for GraphQL DataLoader usage -- avoids N+1 queries.
 * Returns a Map<diffReportId, Classification> for efficient lookup.
 *
 * Pure function with Db as first parameter.
 */
export async function getClassificationsByDiffReportIds(
  db: Db,
  diffReportIds: string[],
): Promise<Map<string, Classification>> {
  if (diffReportIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select(classificationSelectFields())
    .from(diffClassifications)
    .leftJoin(diffRegions, eq(diffRegions.diffReportId, diffClassifications.diffReportId))
    .where(inArray(diffClassifications.diffReportId, diffReportIds));

  return groupClassificationRows(rows);
}

/**
 * Query layout shifts for a single diff report.
 * Pure function with Db as first parameter.
 */
export async function getLayoutShiftsByDiffReportId(
  db: Db,
  diffReportId: string,
) {
  return db
    .select()
    .from(layoutShifts)
    .where(eq(layoutShifts.diffReportId, diffReportId));
}

/**
 * Batch-fetch layout shifts by diff report IDs.
 * Returns a Map<diffReportId, shifts[]> for efficient lookup.
 * Pure function with Db as first parameter.
 */
export async function getLayoutShiftsByDiffReportIds(
  db: Db,
  diffReportIds: string[],
) {
  if (diffReportIds.length === 0) {
    return new Map<string, Array<typeof layoutShifts.$inferSelect>>();
  }

  const rows = await db
    .select()
    .from(layoutShifts)
    .where(inArray(layoutShifts.diffReportId, diffReportIds));

  const grouped = new Map<string, Array<typeof layoutShifts.$inferSelect>>();
  for (const row of rows) {
    if (!grouped.has(row.diffReportId)) {
      grouped.set(row.diffReportId, []);
    }
    grouped.get(row.diffReportId)!.push(row);
  }
  return grouped;
}

/**
 * Submit a user override for a diff classification.
 * Looks up the current classification to record the original category,
 * then inserts the override record.
 *
 * Pure function with Db as first parameter.
 */
export async function submitOverride(
  db: Db,
  diffReportId: string,
  overrideCategory: string,
  userId: string,
) {
  // Look up current classification for this diff report
  const [current] = await db
    .select({ category: diffClassifications.category })
    .from(diffClassifications)
    .where(eq(diffClassifications.diffReportId, diffReportId))
    .limit(1);

  if (!current) {
    throw new Error(`No classification found for diffReportId: ${diffReportId}`);
  }

  // Insert override with original category
  const [override] = await db
    .insert(classificationOverrides)
    .values({
      diffReportId,
      originalCategory: current.category,
      overrideCategory,
      userId,
    })
    .returning();

  return override;
}
