/**
 * Changed lines information for a single file.
 */
export type FileChangedLines = {
  /** File path (should match FileCoverage.resolvedPath) */
  filename: string
  /** Set of line numbers that were changed (added/modified) */
  changedLines: Set<number>
}

/**
 * Map of resolved file path to changed line numbers.
 */
export type ChangedLinesMap = Map<string, Set<number>>
