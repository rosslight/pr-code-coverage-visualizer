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

export type PercentageCoverageMetrics = {
  lineCoverage: number
  branchCoverage?: number | undefined
}

export type FileCoverage = {
  /** Display path (relative to source root, for markdown output) */
  filename: string
  /** Absolute path for reading file contents (set after path resolution) */
  resolvedPath?: string
  lines: LineCoverage[]
  lineMetrics: CoverageMetrics
  branchMetrics?: CoverageMetrics | undefined
}

export type PackageCoverage = {
  name: string
  files: FileCoverage[]
}

export type CoverageReport = {
  /** Hint name for logging (e.g., the file path this report was parsed from) */
  hintName?: string
  /** The packages that are listed in this coverage report */
  packages: PackageCoverage[]
  /** Source paths from Cobertura XML <sources> element */
  sources?: string[]
}
