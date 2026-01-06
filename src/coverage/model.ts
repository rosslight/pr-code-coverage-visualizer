export type LineCoverage = {
  /** The number of the line with coverage information*/
  readonly lineNumber: number
  /** True, if the line was hit at least once */
  readonly covered: boolean
  /** The number of branches covered */
  readonly branchesCovered: number
  /** The total number of branches available in this line */
  readonly totalBranches: number
}

export type PercentageCoverageMetrics = {
  /** The number of lines covered */
  readonly linesCovered: number
  /** The total number of lines */
  readonly totalLines: number
  /** The number of branches covered */
  readonly branchesCovered: number
  /** The total number of branches */
  readonly totalBranches: number
  /** The line coverage */
  readonly lineCoverage: number
  /** The branch coverage */
  readonly branchCoverage: number | undefined
}

export type FileCoverage = {
  /** Display path (relative to source root, for markdown output) */
  readonly filename: string
  /** Absolute path for reading file contents (set after path resolution) */
  resolvedPath?: string | undefined
  /** Coverage information per line */
  readonly lines: LineCoverage[]
  /** The coverage information */
  readonly coverage: PercentageCoverageMetrics
}

export type PackageCoverage = {
  readonly name: string
  readonly files: FileCoverage[],
  /** The coverage information */
  readonly coverage: PercentageCoverageMetrics
}

export type CoverageReport = {
  /** Hint name for logging (e.g., the file path this report was parsed from) */
  readonly hintName?: string | undefined
  /** The packages that are listed in this coverage report */
  readonly packages: PackageCoverage[]
  /** Source paths from Cobertura XML <sources> element */
  readonly sources?: string[] | undefined
}
