import { minimatch } from 'minimatch'
import type { CoverageReport, FileCoverage, LineCoverage, PackageCoverage } from '../coverage/model.js'
import type { ChangedLinesMap, FilterContext, FilterResult } from './model.js'

/**
 * Apply all configured filters to a coverage report.
 *
 * @param report - The original coverage report
 * @param context - Filter context with options and optional changed lines data
 * @returns Filtered coverage report and metadata
 */
export function applyFilters(report: CoverageReport, context: FilterContext): FilterResult {
  let filteredReport = report
  let wasFiltered = false

  // Apply glob filter if not matching everything
  // Both '**' and '**/**' match all files, so skip filtering for these
  const matchesAll = context.options.globPattern === '**' || context.options.globPattern === '**/**'
  if (!matchesAll) {
    filteredReport = filterByGlob(filteredReport, context.options.globPattern)
    wasFiltered = true
  }

  // Apply changed lines filter if enabled and data is available
  if (context.options.showChangedLinesOnly && context.changedLines && context.changedLines.size > 0) {
    filteredReport = filterByChangedLines(filteredReport, context.changedLines)
    wasFiltered = true
  }

  return { report: filteredReport, wasFiltered }
}

/**
 * Filter coverage report to only include files matching a glob pattern.
 *
 * @param report - The coverage report to filter
 * @param pattern - Glob pattern to match filenames against
 * @returns Filtered coverage report
 */
export function filterByGlob(report: CoverageReport, pattern: string): CoverageReport {
  const filteredPackages: PackageCoverage[] = []

  for (const pkg of report.packages) {
    const filteredFiles = pkg.files.filter((file) => minimatch(file.filename, pattern, { matchBase: true }))

    // Only include package if it has matching files
    if (filteredFiles.length > 0) {
      filteredPackages.push({
        name: pkg.name,
        files: filteredFiles,
      })
    }
  }

  return { packages: filteredPackages }
}

/**
 * Filter coverage report to only include lines that were changed.
 * Updates line metrics to reflect the filtered lines.
 *
 * @param report - The coverage report to filter
 * @param changedLines - Map of filename to set of changed line numbers
 * @returns Filtered coverage report with updated metrics
 */
export function filterByChangedLines(report: CoverageReport, changedLines: ChangedLinesMap): CoverageReport {
  const filteredPackages: PackageCoverage[] = []

  for (const pkg of report.packages) {
    const filteredFiles: FileCoverage[] = []

    for (const file of pkg.files) {
      const fileChangedLines = changedLines.get(file.filename)

      // If no changed lines info for this file, skip it entirely
      if (!fileChangedLines || fileChangedLines.size === 0) {
        continue
      }

      const filteredFile = filterFileByChangedLines(file, fileChangedLines)

      // Only include file if it has any lines left after filtering
      if (filteredFile.lines.length > 0) {
        filteredFiles.push(filteredFile)
      }
    }

    // Only include package if it has files with changed lines
    if (filteredFiles.length > 0) {
      filteredPackages.push({
        name: pkg.name,
        files: filteredFiles,
      })
    }
  }

  return { packages: filteredPackages }
}

/**
 * Filter a single file's coverage to only include changed lines.
 * Recalculates metrics based on the filtered lines.
 *
 * @param file - The file coverage to filter
 * @param changedLineNumbers - Set of line numbers that were changed
 * @returns Filtered file coverage with updated metrics
 */
function filterFileByChangedLines(file: FileCoverage, changedLineNumbers: Set<number>): FileCoverage {
  // Filter lines to only those that were changed
  const filteredLines: LineCoverage[] = file.lines.filter((line) => changedLineNumbers.has(line.lineNumber))

  // Recalculate line metrics based on filtered lines
  const coveredCount = filteredLines.filter((line) => line.state === 'covered').length
  const totalCount = filteredLines.length

  const result: FileCoverage = {
    filename: file.filename,
    lines: filteredLines,
    lineMetrics: {
      covered: coveredCount,
      total: totalCount,
    },
  }

  // Only include branch/method metrics if they existed on the original
  // Note: We don't have enough info to filter these, so we preserve them as-is
  // This is a simplification - in a more complete implementation, you'd track
  // which branches/methods are on changed lines
  if (file.branchMetrics) {
    result.branchMetrics = file.branchMetrics
  }

  if (file.methodMetrics) {
    result.methodMetrics = file.methodMetrics
  }

  return result
}
