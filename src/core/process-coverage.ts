import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  CoberturaCoverageParser,
  type CoverageReport,
  type FileCoverage,
  type PackageCoverage,
} from '../coverage/index.js'
import { type ChangedLinesMap, filterByChangedLines, filterByGlob, getChangedLinesFromGit } from '../filter/index.js'
import { generateMarkdown } from '../markdown/index.js'

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
 * Create a logger implementation for CLI that uses console.
 * @param verbose - Whether to enable debug logging
 */
export function createCliLogger(verbose: boolean): Logger {
  const logger: Logger = {
    info: (message) => console.log(`[INF] ${message}`),
    warning: (message) => console.warn(`[WRN] ${message}`),
  }
  if (verbose) {
    logger.debug = (message) => console.log(`[DBG] ${message}`)
  }
  return logger
}

/**
 * Inputs for the coverage processing function.
 */
export type ProcessCoverageInputs = {
  /** Coverage file patterns (newline or comma separated) */
  filePatterns: string[]
  /** Source directory for resolving file paths from coverage files */
  sourceDir: string
  /** Glob patterns for files to exclude. If empty, no files are excluded. */
  excludePatterns: string[]
  /** Explicit base commit SHA for comparison */
  baseSha?: string | undefined
  /** Explicit head commit SHA for comparison */
  headSha?: string | undefined
  /** Number of lines to show before and after uncovered lines (default: 1) */
  numberOfSurroundingLines?: number | undefined
  /** Maximum number of characters in the output (default: 65536, minimum: 900) */
  maxCharacters?: number | undefined
}

/**
 * Result of coverage processing.
 */
export type ProcessCoverageResult = {
  /** Generated markdown report */
  markdown: string
  lineCoverage: number
  branchCoverage: number | undefined
  lineCoveragePr: number
  branchCoveragePr: number | undefined
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
  logger.info(`Looking for coverage files matching: [${inputs.filePatterns.join(', ')}]`)

  // Sort and de-duplicate matched files for deterministic CI output
  const globResults = await Array.fromAsync(fs.glob(inputs.filePatterns))
  const matchedFiles = [...new Set(globResults.map((f) => path.resolve(f)).sort())]

  if (matchedFiles.length === 0) {
    logger.warning('No coverage files found matching the specified patterns')
    return null
  }

  logger.info(`Found ${matchedFiles.length} coverage file(s)`)

  // Parse all coverage files with error handling
  const parser = new CoberturaCoverageParser()
  const reports: CoverageReport[] = []

  for (const file of matchedFiles) {
    logger.debug?.(`Parsing: ${file}`)
    try {
      const content = await fs.readFile(file, 'utf-8')
      const report = await parser.parse(content, file)
      reports.push(report)
    } catch (error) {
      logger.warning(`Failed to parse ${file}: ${error}. Skipping.`)
    }
  }

  // If all files failed to parse, return null
  if (reports.length === 0) {
    logger.warning('All coverage files failed to parse. Nothing to do ...')
    return null
  }

  const totalFiles = reports.reduce((s1, r) => s1 + r.packages.reduce((s2, p) => s2 + p.files.length, 0), 0)
  logger.info(`Found coverage data in ${reports.length} reports for ${totalFiles} files total`)
  // Merge all reports into one (including sources)
  const mergedPackages = await mergeReportAndResolveSources(reports, inputs.sourceDir, logger)

  // Get changed lines using git if filtering is enabled and we have comparison information
  // This must happen BEFORE filtering so we can match against original filenames
  let changedLinesPerFileMap: ChangedLinesMap | undefined
  const { baseSha, headSha } = inputs
  if (baseSha && headSha) {
    try {
      changedLinesPerFileMap = await getChangedLinesFromGit(baseSha, headSha)
      logger.info(`Found ${changedLinesPerFileMap.size} file(s) with changes (comparing ${baseSha}..${headSha})`)
    } catch (error) {
      logger.warning(
        `Failed to get changed lines from git (comparing ${baseSha}..${headSha}): ${error}. Showing all lines.`,
      )
    }
  }

  // Apply filters to the coverage report
  const globFilteredPackages: PackageCoverage[] = filterByGlob(mergedPackages, inputs.excludePatterns, logger)
  const fileFilteredPackages = changedLinesPerFileMap
    ? filterByChangedLines(globFilteredPackages, changedLinesPerFileMap, logger)
    : globFilteredPackages

  // Read file contents from disk using resolved paths
  const fileContents = await readFileContents(fileFilteredPackages)

  for (const filteredPackage of fileFilteredPackages) {
    for (const file of filteredPackage.files) {
      logger.debug?.(`Generating markdown for ${file.resolvedPath} with ${file.lines.length} changed lines`)
    }
  }

  const overallMetrics = CoberturaCoverageParser.calculatePackageCoverage(globFilteredPackages)
  const prMetrics = CoberturaCoverageParser.calculatePackageCoverage(fileFilteredPackages)
  logger.info(
    `Calculated overall metrics (LineCoverage: ${overallMetrics.lineCoverage}, BranchCoverage: ${overallMetrics.branchCoverage})`,
  )
  logger.info(
    `Calculated PR metrics (LineCoverage: ${prMetrics.lineCoverage}, BranchCoverage: ${prMetrics.branchCoverage})`,
  )

  // Generate Markdown from filtered report
  const markdown = generateMarkdown(
    fileFilteredPackages,
    fileContents,
    overallMetrics,
    { maxCharacters: inputs.maxCharacters, numberOfSurroundingLines: inputs.numberOfSurroundingLines },
    logger,
  )

  return {
    markdown,
    lineCoverage: overallMetrics.lineCoverage,
    branchCoverage: overallMetrics.branchCoverage,
    lineCoveragePr: prMetrics.lineCoverage,
    branchCoveragePr: prMetrics.branchCoverage,
  }
}

async function firstExistingDirectory(paths: readonly string[]): Promise<string | undefined> {
  for (const directoryPath of paths) {
    try {
      const resolvedPath = path.resolve(directoryPath)
      if ((await fs.stat(resolvedPath)).isDirectory()) {
        return directoryPath
      }
    } catch {
      // not found / not accessible → skip
    }
  }
  return undefined
}

/**
 * Merge multiple coverage reports into one.
 * Also merges sources from all reports.
 */
async function mergeReportAndResolveSources(
  reports: CoverageReport[],
  fallbackSource: string,
  logger: Logger,
): Promise<PackageCoverage[]> {
  // Use intermediate type with fileMap for deduplication during merge
  const packageMap = new Map<string, { name: string; fileMap: Map<string, FileCoverage> }>()

  for (const report of reports) {
    logger.debug?.(`Merging ${report.hintName}`)
    // Get the source to use for this report
    const sourceCandidates = [...(report.sources ?? []), fallbackSource]
    const source = await firstExistingDirectory(sourceCandidates)
    if (source === undefined) {
      logger.warning(`Could not resolve any sources. Sources checked: [${sourceCandidates.join(', ')}]. Skipping ...`)
      continue
    }
    logger.debug?.(`Using source ${source}`)
    for (const pkg of report.packages) {
      // Get or create file map for this package (deduplicates by resolved path, skipping later occurrence)
      if (!packageMap.has(pkg.name)) {
        packageMap.set(pkg.name, { name: pkg.name, fileMap: new Map<string, FileCoverage>() })
      }
      const { fileMap } = packageMap.get(pkg.name)!

      // Add files with resolved paths (merge duplicates)
      for (const file of pkg.files) {
        const resolvedPath = path.resolve(source, file.filename)
        const existing = fileMap.get(resolvedPath)
        if (existing) {
          const merged = CoberturaCoverageParser.merge(existing, file.lines)
          assert(merged.resolvedPath === resolvedPath)
          fileMap.set(resolvedPath, merged)
          logger.debug?.(`Merged duplicate file: ${merged.resolvedPath}`)
        } else {
          file.resolvedPath = resolvedPath
          fileMap.set(resolvedPath, file)
        }
      }
    }
  }

  // Convert file maps back to arrays for the final report
  const packages: PackageCoverage[] = Array.from(packageMap.values()).map(({ name, fileMap }): PackageCoverage => {
    const files = Array.from(fileMap.values())
    return {
      name,
      files: files,
      coverage: CoberturaCoverageParser.calculateFileCoverage(files),
    }
  })

  const totalFiles = packages.reduce((sum, pkg) => sum + pkg.files.length, 0)
  logger.info(`Merged coverage data for ${totalFiles} distinct files`)
  return packages
}

/**
 * Read file contents from disk for all files in the coverage packages.
 * Returns a map of resolved path -> lines array.
 * Files without resolvedPath or that can't be read are skipped.
 *
 * @param packages - Coverage packages with files containing resolvedPath
 */
async function readFileContents(packages: PackageCoverage[]): Promise<Map<string, string[]>> {
  const contents = new Map<string, string[]>()

  for (const pkg of packages) {
    for (const file of pkg.files) {
      if (!file.resolvedPath) {
        continue
      }
      try {
        const content = await fs.readFile(file.resolvedPath, 'utf-8')
        contents.set(file.resolvedPath, content.split('\n'))
      } catch {
        contents.set(file.resolvedPath, [])
      }
    }
  }

  return contents
}
