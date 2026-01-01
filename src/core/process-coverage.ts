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
  /** Optional debug logging (only shown when verbose mode is enabled) */
  debug?: (message: string) => void
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
  globPattern: string
  /** Explicit base commit SHA for comparison */
  baseSha?: string | undefined
  /** Explicit head commit SHA for comparison */
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

  // Sort and de-duplicate matched files for deterministic CI output
  const matchedFiles = [...new Set((await glob(filePatterns, { absolute: true })).sort())]

  if (matchedFiles.length === 0) {
    logger.warning('No coverage files found matching the specified patterns')
    return null
  }

  logger.info(`Found ${matchedFiles.length} coverage file(s)`)

  // Parse all coverage files with error handling
  const parser = new CoberturaCoverageParser()
  const reports: CoverageReport[] = []

  for (const file of matchedFiles) {
    logger.info(`Parsing: ${file}`)
    try {
      const content = await fs.readFile(file, 'utf-8')
      const report = await parser.parse(content)
      reports.push(report)
    } catch (error) {
      logger.warning(`Failed to parse ${file}: ${error}. Skipping.`)
    }
  }

  // If all files failed to parse, return null
  if (reports.length === 0) {
    logger.warning('All coverage files failed to parse')
    return null
  }

  // Merge all reports into one (including sources)
  const mergedReport = mergeReports(reports)

  // Preserve original filenames before any mutations (used for lookups and filtering)
  for (const pkg of mergedReport.packages) {
    for (const file of pkg.files) {
      file.originalFilename = file.filename
    }
  }

  // Get changed lines using git if filtering is enabled and we have comparison information
  // This must happen BEFORE filtering so we can match against original filenames
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
      logger.debug?.('showChangedLinesOnly is enabled but no comparison SHAs were provided; showing all lines')
    }
  }

  // Apply filters to the coverage report BEFORE path resolution
  const filterContext: FilterContext = {
    options: {
      globPattern: inputs.globPattern,
      showChangedLinesOnly: inputs.showChangedLinesOnly,
    },
    changedLines: changedLines,
  }

  const { report: filteredReport, wasFiltered } = applyFilters(mergedReport, filterContext)

  if (wasFiltered) {
    logger.info('Coverage report filtered based on configuration')
  }

  // Resolve file paths only for files that survived filtering
  const filteredFilenames: string[] = []
  for (const pkg of filteredReport.packages) {
    for (const file of pkg.files) {
      filteredFilenames.push(file.originalFilename ?? file.filename)
    }
  }

  const pathContext: PathResolutionContext = {
    sources: mergedReport.sources ?? [],
    sourceDir: inputs.sourceDir,
    logger,
  }

  logger.info(`Resolving file paths (sourceDir: ${inputs.sourceDir})...`)
  const resolvedPaths = await resolveFilePaths(filteredFilenames, pathContext)

  // Update file objects with resolved paths
  for (const pkg of filteredReport.packages) {
    for (const file of pkg.files) {
      const lookupKey = file.originalFilename ?? file.filename
      const resolution = resolvedPaths.get(lookupKey)
      if (resolution) {
        file.resolvedPath = resolution.absolutePath
        file.filename = resolution.displayPath
      }
    }
  }

  // Collect all unique resolved file paths from the filtered report
  // Map from display path (filename) to resolved path for reading
  // Detect path collisions where multiple files resolve to the same path
  const filePathMap = new Map<string, string>()
  const resolvedPathToFilename = new Map<string, string>()
  for (const pkg of filteredReport.packages) {
    for (const file of pkg.files) {
      const resolvedPath = file.resolvedPath ?? file.filename
      const existingFilename = resolvedPathToFilename.get(resolvedPath)
      if (existingFilename && existingFilename !== file.filename) {
        logger.warning(`Path collision: ${file.filename} and ${existingFilename} both resolve to ${resolvedPath}`)
      }
      resolvedPathToFilename.set(resolvedPath, file.filename)
      filePathMap.set(file.filename, resolvedPath)
    }
  }

  // Read file contents from disk using resolved paths
  const fileContents = await readFileContents(filePathMap, logger)

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
        // Merge files into existing package, deduplicating by filename (keeping last occurrence)
        const existing = packageMap.get(pkg.name)!
        const fileMap = new Map<string, (typeof existing.files)[0]>()
        for (const file of existing.files) {
          fileMap.set(file.filename, file)
        }
        for (const file of pkg.files) {
          fileMap.set(file.filename, file)
        }
        existing.files = Array.from(fileMap.values())
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
 * Files that don't exist or can't be read return empty arrays (tolerant reads).
 *
 * @param pathMap - Map of display path to resolved (absolute) path
 * @param logger - Logger for debug/warning messages
 */
async function readFileContents(pathMap: Map<string, string>, logger: Logger): Promise<Map<string, string[]>> {
  const contents = new Map<string, string[]>()

  for (const [displayPath, resolvedPath] of pathMap) {
    try {
      const content = await fs.readFile(resolvedPath, 'utf-8')
      contents.set(displayPath, content.split('\n'))
    } catch (error) {
      // File doesn't exist or can't be read - log and continue with empty array
      logger.warning(`Could not read file ${resolvedPath}: ${error}`)
      contents.set(displayPath, [])
    }
  }

  return contents
}
