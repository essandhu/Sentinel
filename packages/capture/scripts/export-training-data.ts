import type { S3Client } from '@aws-sdk/client-s3';
import { classificationOverrides, diffReports, diffRegions } from '@sentinel-vrt/db';
import type { Db } from '@sentinel-vrt/db';
import { downloadBuffer } from '@sentinel-vrt/storage';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { findConnectedComponents } from '../src/classify/connected-components.js';
import { extractFeatures } from '../src/classify/region-features.js';
import type { Region } from '../src/classify/connected-components.js';
import { writeFile } from 'node:fs/promises';

/**
 * Per-region training data row with region-level features and optional override label.
 */
export interface PerRegionRow {
  diffReportId: string;
  regionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  relX: number;
  relY: number;
  relWidth: number;
  relHeight: number;
  pixelCount: number;
  spatialZone: string;
  regionCategory: string;
  regionConfidence: number | null;
  overrideCategory: string;
}

/**
 * CSV column headers for per-region training data export.
 * Matches expected Python training script column names.
 */
export function formatPerRegionCsvHeaders(): string {
  return 'diffReportId,regionId,x,y,width,height,relX,relY,relWidth,relHeight,pixelCount,spatialZone,regionCategory,regionConfidence,overrideCategory';
}

/**
 * Format a per-region row as a CSV line.
 */
export function formatPerRegionRow(row: PerRegionRow): string {
  return [
    row.diffReportId,
    row.regionId,
    row.x,
    row.y,
    row.width,
    row.height,
    row.relX,
    row.relY,
    row.relWidth,
    row.relHeight,
    row.pixelCount,
    row.spatialZone,
    row.regionCategory,
    row.regionConfidence ?? '',
    row.overrideCategory,
  ].join(',');
}

/**
 * Export per-region training data from diffRegions with optional override labels.
 *
 * Queries diffRegions joined with classificationOverrides to build
 * region-level feature rows suitable for Python model retraining.
 */
export async function exportPerRegionData(
  db: Db,
): Promise<PerRegionRow[]> {
  const regions = await db
    .select({
      regionId: diffRegions.id,
      diffReportId: diffRegions.diffReportId,
      x: diffRegions.x,
      y: diffRegions.y,
      width: diffRegions.width,
      height: diffRegions.height,
      relX: diffRegions.relX,
      relY: diffRegions.relY,
      relWidth: diffRegions.relWidth,
      relHeight: diffRegions.relHeight,
      pixelCount: diffRegions.pixelCount,
      spatialZone: diffRegions.spatialZone,
      regionCategory: diffRegions.regionCategory,
      regionConfidence: diffRegions.regionConfidence,
    })
    .from(diffRegions);

  // Get all overrides indexed by diffReportId
  const overrideRows = await db
    .select({
      diffReportId: classificationOverrides.diffReportId,
      overrideCategory: classificationOverrides.overrideCategory,
    })
    .from(classificationOverrides);

  const overrideMap = new Map<string, string>();
  for (const o of overrideRows) {
    overrideMap.set(o.diffReportId, o.overrideCategory);
  }

  return regions.map((r) => ({
    diffReportId: r.diffReportId,
    regionId: r.regionId,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    relX: r.relX,
    relY: r.relY,
    relWidth: r.relWidth,
    relHeight: r.relHeight,
    pixelCount: r.pixelCount,
    spatialZone: r.spatialZone ?? '',
    regionCategory: r.regionCategory ?? '',
    regionConfidence: r.regionConfidence,
    overrideCategory: overrideMap.get(r.diffReportId) ?? '',
  }));
}

export interface TrainingRow {
  features: number[];
  label: string;
  originalLabel: string;
  diffReportId: string;
}

/**
 * Build a fixed-size 11-element feature vector from detected regions.
 *
 * Features:
 * [0] regionCount - number of change regions
 * [1] changeCoverage - fraction of image area changed
 * [2] maxDensity - max pixel density among regions
 * [3] avgAspectRatio - average bounding box aspect ratio
 * [4] edgeAlignedRatio - fraction of regions touching image edge
 * [5] maxVerticalSpan - max vertical span among regions
 * [6] maxHorizontalSpan - max horizontal span among regions
 * [7] avgRelativeWidth - average relative width
 * [8] avgRelativeHeight - average relative height
 * [9] largeRegionCount - regions with bounding box > 5% of image
 * [10] denseRectCount - dense rectangular regions (content candidates)
 */
function buildFeatureVector(
  regions: Region[],
  imageWidth: number,
  imageHeight: number,
): Float32Array {
  const totalPixels = imageWidth * imageHeight;
  const totalChanged = regions.reduce((s, r) => s + r.pixelCount, 0);
  const features = regions.map(r => extractFeatures(r, imageWidth, imageHeight));

  const vec = new Float32Array(11);
  vec[0] = regions.length;
  vec[1] = totalChanged / totalPixels;
  vec[2] = Math.max(...features.map(f => f.density));
  vec[3] = features.reduce((s, f) => s + f.aspectRatio, 0) / features.length;
  vec[4] = features.filter(f => f.isEdgeAligned).length / features.length;
  vec[5] = Math.max(...features.map(f => f.verticalSpan));
  vec[6] = Math.max(...features.map(f => f.horizontalSpan));
  vec[7] = features.reduce((s, f) => s + f.relativeWidth, 0) / features.length;
  vec[8] = features.reduce((s, f) => s + f.relativeHeight, 0) / features.length;
  vec[9] = regions.filter(r =>
    (r.boundingBox.width * r.boundingBox.height) / totalPixels > 0.05,
  ).length;
  vec[10] = regions.filter(r => {
    const area = r.boundingBox.width * r.boundingBox.height;
    return (r.pixelCount / area) > 0.6 && (area / totalPixels) > 0.01 && (area / totalPixels) < 0.15;
  }).length;

  return vec;
}

/**
 * Export labeled training data from classification overrides.
 *
 * Queries all user overrides joined with diff reports, downloads diff images
 * from S3, extracts features using the same pipeline as the classifier,
 * and returns labeled feature vectors for external model training.
 */
export async function exportTrainingData(
  db: Db,
  storageClient: S3Client,
  bucket: string,
): Promise<TrainingRow[]> {
  const overrides = await db
    .select({
      diffReportId: classificationOverrides.diffReportId,
      originalCategory: classificationOverrides.originalCategory,
      overrideCategory: classificationOverrides.overrideCategory,
      diffS3Key: diffReports.diffS3Key,
    })
    .from(classificationOverrides)
    .innerJoin(diffReports, eq(diffReports.id, classificationOverrides.diffReportId));

  const rows: TrainingRow[] = [];

  for (const override of overrides) {
    try {
      const buffer = await downloadBuffer(storageClient, bucket, override.diffS3Key);
      const { data, info } = await sharp(buffer)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

      const regions = findConnectedComponents(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
      );

      if (regions.length === 0) {
        console.warn(`No connected components found for diffReport ${override.diffReportId}, skipping`);
        continue;
      }

      const featureVec = buildFeatureVector(regions, info.width, info.height);

      rows.push({
        features: Array.from(featureVec),
        label: override.overrideCategory,
        originalLabel: override.originalCategory,
        diffReportId: override.diffReportId,
      });
    } catch (err) {
      console.warn(`Failed to process diffReport ${override.diffReportId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return rows;
}

/* ---- CLI entry point ---- */

function parseArgs(argv: string[]): {
  outputPath?: string;
  perRegion: boolean;
  format: 'csv' | 'jsonl';
} {
  let outputPath: string | undefined;
  let perRegion = false;
  let format: 'csv' | 'jsonl' = 'csv';

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--per-region') {
      perRegion = true;
    } else if (arg === '--format' && i + 1 < argv.length) {
      const val = argv[++i];
      if (val === 'csv' || val === 'jsonl') format = val;
    } else if (arg === '--output' && i + 1 < argv.length) {
      outputPath = argv[++i];
    } else if (!arg.startsWith('--')) {
      outputPath = arg;
    }
  }

  return { outputPath, perRegion, format };
}

async function main() {
  const { createDb } = await import('@sentinel-vrt/db');
  const { createStorageClient } = await import('@sentinel-vrt/storage');

  const { outputPath, perRegion, format } = parseArgs(process.argv);
  const db = createDb();
  const storageClient = createStorageClient({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });
  const bucket = process.env.S3_BUCKET ?? 'sentinel';

  if (perRegion) {
    const rows = await exportPerRegionData(db);

    if (rows.length === 0) {
      console.log('No region data found.');
      process.exit(0);
    }

    let output: string;
    if (format === 'csv') {
      const header = `# Sentinel per-region training data export - ${new Date().toISOString()} - ${rows.length} rows\n`;
      output = header + formatPerRegionCsvHeaders() + '\n' + rows.map(formatPerRegionRow).join('\n') + '\n';
    } else {
      output = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
    }

    if (outputPath) {
      await writeFile(outputPath, output, 'utf-8');
      console.log(`Exported ${rows.length} per-region rows to ${outputPath}`);
    } else {
      process.stdout.write(output);
    }
  } else {
    const rows = await exportTrainingData(db, storageClient, bucket);

    if (rows.length === 0) {
      console.log('No classification overrides found. Collect user feedback before exporting.');
      process.exit(0);
    }

    const jsonl = rows.map(r => JSON.stringify(r)).join('\n') + '\n';

    if (outputPath) {
      await writeFile(outputPath, jsonl, 'utf-8');
      console.log(`Exported ${rows.length} training rows to ${outputPath}`);
    } else {
      process.stdout.write(jsonl);
    }
  }
}

// Only run main when executed directly (not imported as module)
const isDirectExecution = process.argv[1]?.includes('export-training-data');
if (isDirectExecution) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
