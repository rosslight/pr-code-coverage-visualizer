import type { CoverageReport } from '../coverage/model.js'

/**
 * Options for filtering coverage data.
 */
export type FilterOptions = {
  /**
   * Glob pattern to filter files by path.
   * Only files matching this pattern will be included.
   */
  globPattern: string

  /**
   * Whether to filter coverage to only show changed lines.
   * When true and changed lines data is available, only lines
   * that were modified in the PR will be shown.
   */
  showChangedLinesOnly: boolean
}

/**
 * Changed lines information for a single file.
 */
export type FileChangedLines = {
  /** File path (should match FileCoverage.filename) */
  filename: string
  /** Set of line numbers that were changed (added/modified) */
  changedLines: Set<number>
}

/**
 * Map of filename to changed line numbers.
 */
export type ChangedLinesMap = Map<string, Set<number>>

/**
 * Context for filtering operations.
 */
export type FilterContext = {
  /** Filter options */
  options: FilterOptions
  /** Changed lines per file (if available) */
  changedLines: ChangedLinesMap | undefined
}

/**
 * Result of applying filters to a coverage report.
 */
export type FilterResult = {
  /** The filtered coverage report */
  report: CoverageReport
  /** Whether any filtering was actually applied */
  wasFiltered: boolean
}
