export const schema = `
  type Query {
    projects: [Project!]!
    project(id: ID!): Project
    captureRuns(projectId: ID!): [CaptureRun!]!
    captureRun(id: ID!): CaptureRun
    a11yViolations(runId: ID!): A11ySummary!
    classifications(runId: ID!): [DiffClassification!]!
  }

  type Project {
    id: ID!
    name: String!
    createdAt: String!
    captureRuns: [CaptureRun!]!
    components: [Component!]!
    healthScore: HealthScore
  }

  type CaptureRun {
    id: ID!
    projectId: ID!
    branchName: String
    commitSha: String
    status: String!
    createdAt: String!
    completedAt: String
    totalDiffs: Int!
    diffs: [DiffReport!]!
    a11ySummary: A11ySummary
  }

  type DiffReport {
    id: ID!
    snapshotId: ID!
    snapshotUrl: String!
    snapshotViewport: String!
    browser: String!
    baselineS3Key: String!
    diffS3Key: String!
    pixelDiffPercent: Float
    ssimScore: Float
    passed: String!
    createdAt: String!
    classification: DiffClassification
  }

  type Component {
    id: ID!
    name: String!
    selector: String!
    description: String
    enabled: Int!
    createdAt: String!
  }

  type HealthScore {
    score: Int!
    computedAt: String!
  }

  type A11yViolation {
    id: ID!
    ruleId: String!
    impact: String!
    cssSelector: String!
    html: String
    helpUrl: String
    isNew: Int!
    fingerprint: String!
  }

  type A11ySummaryCounts {
    new: Int!
    fixed: Int!
    existing: Int!
  }

  type A11ySummary {
    summary: A11ySummaryCounts!
    violations: [A11yViolation!]!
  }

  type DiffRegion {
    x: Int!
    y: Int!
    width: Int!
    height: Int!
    relX: Int!
    relY: Int!
    relWidth: Int!
    relHeight: Int!
    pixelCount: Int!
    regionCategory: String
  }

  type DiffClassification {
    diffReportId: ID!
    category: String!
    confidence: Int!
    reasons: [String!]!
    modelVersion: String
    regions: [DiffRegion!]!
  }
`;
