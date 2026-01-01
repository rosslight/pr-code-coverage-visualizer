import * as fs from 'node:fs/promises'
import { glob } from 'glob'
import { CoberturaCoverageParser, type CoverageReport } from '../coverage/index.js'
import { applyFilters, getChangedLinesFromGit, type ChangedLinesMap, type FilterContext } from '../filter/index.js'
import { generateMarkdown } from '../markdown/index.js'
import { resolveFilePaths, type PathResolutionContext } from '../path/index.js'

/**
 * Logger interface for dependency injection.
 * Allows different logging implementations for GitHub Actions vs CLI.
 */
export type Logger = {
  info: (message: string) => void
  warning: (message: string) => void
}

/**
 * Inputs for the coverage processing function.
 */
export type ProcessCoverageInputs = {
  /** Coverage file patterns (newline or comma separated) */
  files: string
  /** Source directory for resolving file paths from coverage files */
  sourceDir: string
  /** Whether to filter to show only changed lines */
  showChangedLinesOnly: boolean
  /** Glob pattern to filter which files to show */
  showGlobOnly: string
  /**
   * Explicit base commit SHA for comparison.
   * When provided together with headSha, takes precedence over baseRef.
   */
  baseSha?: string | undefined
  /**
   * Explicit head commit SHA for comparison.
   * When provided together with baseSha, takes precedence over baseRef.
   */
  headSha?: string | undefined
}

/**
 * Coverage metrics calculated from the report.
 */
export type CoverageMetrics = {
  lineCoverage: number
  branchCoverage: number
  functionCoverage: number
}

/**
 * Result of coverage processing.
 */
export type ProcessCoverageResult = {
  /** Generated markdown report */
  markdown: string
  /** Overall coverage metrics (from unfiltered report for accuracy) */
  metrics: CoverageMetrics
}

/**
 * Process coverage files and generate a markdown report.
 * This is the pure core logic with no GitHub or action dependencies.
 *
 * @param inputs - Processing inputs
 * @param logger - Logger for info/warning messages
 * @returns Processing result with markdown and metrics
 */
export async function processCoverage(
  inputs: ProcessCoverageInputs,
  logger: Logger,
): Promise<ProcessCoverageResult | null> {
  // Find all matching coverage files
  const filePatterns = inputs.files
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  logger.info(`Looking for coverage files matching: ${filePatterns.join(', ')}`)

  const matchedFiles = await glob(filePatterns, { absolute: true })

  if (matchedFiles.length === 0) {
    logger.warning('No coverage files found matching the specified patterns')
    return null
  }

  logger.info(`Found ${matchedFiles.length} coverage file(s)`)

  // Parse all coverage files
  const parser = new CoberturaCoverageParser()
  const reports: CoverageReport[] = []

  for (const file of matchedFiles) {
    logger.info(`Parsing: ${file}`)
    const content = await fs.readFile(file, 'utf-8')
    const report = await parser.parse(content)
    reports.push(report)
  }

  // Merge all reports into one (including sources)
  const mergedReport = mergeReports(reports)

  // Resolve file paths to get display paths and absolute paths
  const allFilenames: string[] = []
  for (const pkg of mergedReport.packages) {
    for (const file of pkg.files) {
      allFilenames.push(file.filename)
    }
  }

  const pathContext: PathResolutionContext = {
    sources: mergedReport.sources ?? [],
    sourceDir: inputs.sourceDir,
    logger,
  }

  logger.info(`Resolving file paths (sourceDir: ${inputs.sourceDir})...`)
  const resolvedPaths = await resolveFilePaths(allFilenames, pathContext)

  // Update file objects with resolved paths
  for (const pkg of mergedReport.packages) {
    for (const file of pkg.files) {
      const resolution = resolvedPaths.get(file.filename)
      if (resolution) {
        file.resolvedPath = resolution.absolutePath
        file.filename = resolution.displayPath
      }
    }
  }

  // Get changed lines using git if filtering is enabled and we have comparison information
  let changedLines: ChangedLinesMap | undefined
  if (inputs.showChangedLinesOnly) {
    const { baseSha, headSha } = inputs

    if (baseSha && headSha) {
      logger.info(`Getting changed lines from git (comparing ${baseSha}..${headSha})...`)
      try {
        changedLines = await getChangedLinesFromGit(baseSha, headSha)
        logger.info(`Found changes in ${changedLines.size} file(s)`)
      } catch (error) {
        logger.warning(`Failed to get changed lines from git: ${error}. Showing all lines.`)
      }
    } else {
      logger.info('showChangedLinesOnly is enabled but no comparison SHAs were provided; showing all lines')
    }
  }

  // Apply filters to the coverage report
  const filterContext: FilterContext = {
    options: {
      globPattern: inputs.showGlobOnly,
      showChangedLinesOnly: inputs.showChangedLinesOnly,
    },
    changedLines: changedLines,
  }

  const { report: filteredReport, wasFiltered } = applyFilters(mergedReport, filterContext)

  if (wasFiltered) {
    logger.info('Coverage report filtered based on configuration')
  }

  // Collect all unique resolved file paths from the filtered report
  // Map from display path (filename) to resolved path for reading
  const filePathMap = new Map<string, string>()
  for (const pkg of filteredReport.packages) {
    for (const file of pkg.files) {
      // Use resolvedPath for reading, fall back to filename if not set
      filePathMap.set(file.filename, file.resolvedPath ?? file.filename)
    }
  }

  // Read file contents from disk using resolved paths
  const fileContents = await readFileContents(filePathMap)

  // Generate markdown from filtered report
  const markdown = generateMarkdown(filteredReport, fileContents)

  // Calculate overall metrics for outputs (from original merged report for accuracy)
  const metrics = calculateOverallMetrics(mergedReport)

  return { markdown, metrics }
}

/**
 * Merge multiple coverage reports into one.
 * Also merges sources from all reports.
 */
function mergeReports(reports: CoverageReport[]): CoverageReport {
  const packageMap = new Map<string, CoverageReport['packages'][0]>()
  const allSources = new Set<string>()

  for (const report of reports) {
    // Collect sources from all reports
    if (report.sources) {
      for (const source of report.sources) {
        allSources.add(source)
      }
    }

    for (const pkg of report.packages) {
      if (packageMap.has(pkg.name)) {
        // Merge files into existing package
        const existing = packageMap.get(pkg.name)!
        existing.files = [...existing.files, ...pkg.files]
      } else {
        packageMap.set(pkg.name, { ...pkg })
      }
    }
  }

  const result: CoverageReport = { packages: Array.from(packageMap.values()) }
  if (allSources.size > 0) {
    result.sources = Array.from(allSources)
  }
  return result
}

/**
 * Calculate overall coverage metrics from a merged report.
 */
function calculateOverallMetrics(report: CoverageReport): CoverageMetrics {
  let lineCovered = 0
  let lineTotal = 0
  let branchCovered = 0
  let branchTotal = 0
  let methodCovered = 0
  let methodTotal = 0

  for (const pkg of report.packages) {
    for (const file of pkg.files) {
      lineCovered += file.lineMetrics.covered
      lineTotal += file.lineMetrics.total

      if (file.branchMetrics) {
        branchCovered += file.branchMetrics.covered
        branchTotal += file.branchMetrics.total
      }

      if (file.methodMetrics) {
        methodCovered += file.methodMetrics.covered
        methodTotal += file.methodMetrics.total
      }
    }
  }

  return {
    lineCoverage: lineTotal > 0 ? (lineCovered / lineTotal) * 100 : 0,
    branchCoverage: branchTotal > 0 ? (branchCovered / branchTotal) * 100 : 0,
    functionCoverage: methodTotal > 0 ? (methodCovered / methodTotal) * 100 : 0,
  }
}

/**
 * Read file contents from disk for a map of display paths to resolved paths.
 * Returns a map of display path -> lines array.
 * Files that don't exist return empty arrays.
 *
 * @param pathMap - Map of display path to resolved (absolute) path
 */
async function readFileContents(pathMap: Map<string, string>): Promise<Map<string, string[]>> {
  const contents = new Map<string, string[]>()

  for (const [displayPath, resolvedPath] of pathMap) {
    try {
      const content = await fs.readFile(resolvedPath, 'utf-8')
      contents.set(displayPath, content.split('\n'))
    } catch {
      // File doesn't exist or can't be read - use empty array
      contents.set(displayPath, [])
    }
  }

  return contents
}
