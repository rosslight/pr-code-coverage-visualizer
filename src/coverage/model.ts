/** Coverage state for a single line */
export type LineCoverageState =
  | 'covered' // Line is fully covered (green)
  | 'partial' // Line executed but missing branch coverage (yellow)
  | 'not-covered' // Line not executed at all (red)

export type LineCoverage = {
  lineNumber: number
  state: LineCoverageState
}

export type CoverageMetrics = {
  covered: number
  total: number
}

export type FileCoverage = {
  /** Original filename from coverage XML (immutable, used for lookups and filtering) */
  originalFilename?: string
  /** Display path (relative to source root, for markdown output) */
  filename: string
  /** Absolute path for reading file contents (set after path resolution) */
  resolvedPath?: string
  lines: LineCoverage[]
  lineMetrics: CoverageMetrics
  branchMetrics?: CoverageMetrics
  methodMetrics?: CoverageMetrics
}

export type PackageCoverage = {
  name: string
  files: FileCoverage[]
}

export type CoverageReport = {
  packages: PackageCoverage[]
  /** Source paths from Cobertura XML <sources> element */
  sources?: string[]
}
