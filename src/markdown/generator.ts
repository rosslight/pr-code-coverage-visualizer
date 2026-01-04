import type { Logger } from '../core/index.js'
import type {
  CoverageMetrics,
  FileCoverage,
  LineCoverage,
  PackageCoverage,
  PercentageCoverageMetrics,
} from '../coverage/model.js'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Emoji indicators for line coverage states */
const COVERAGE_ICONS = {
  covered: '🟩',
  partial: '🟨',
  'not-covered': '🟥',
  'no-info': '⬛',
} as const

/** File status icons */
const FILE_STATUS_ICONS = {
  fullyCovered: '🟢',
  hasUncovered: '🔴',
  partialCoverage: '🟠',
} as const

/** Default maximum number of surrounding lines around an uncovered line */
export const DEFAULT_MAX_NUMBER_OF_SURROUNDING_LINES = 1

/** Default maximum characters for markdown output */
export const DEFAULT_MAX_CHARACTERS = 65536

/** Minimum characters required for meaningful markdown output (badges + legend + notice) */
export const MINIMUM_CHARACTERS = 900

// =============================================================================
// TYPES
// =============================================================================

/** Options for markdown generation */
export type MarkdownOptions = {
  /** Number of lines to show before and after uncovered lines (default: 1) */
  numberOfSurroundingLines?: number
  /** Maximum number of characters in the output (default: 65536, minimum: 900) */
  maxCharacters?: number
}

/** PR metrics for summary line */
type PRMetrics = {
  coveredLines: number
  totalLines: number
  linePercent: number
  branchPercent: number | null
}

/** Data structure for a package section with its files */
type PackageSectionData = {
  packageName: string
  header: string
  files: FileSectionData[]
  totalUncoveredLines: number
  totalPartialBranches: number
}

/** Data structure for a file section */
type FileSectionData = {
  filename: string
  content: string
  uncoveredLines: number
  partialBranches: number
}

/** Classification result for a file's coverage state */
type FileCoverageClassification = {
  hasUncovered: boolean
  hasPartial: boolean
  uncoveredCount: number
  partialCount: number
  statusIcon: string
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate Markdown visualization for coverage packages.
 * This is a pure function suitable for snapshot testing.
 *
 * @param packages - Array of packages
 * @param fileContents - Map of resolved (absolute) path to array of line contents
 * @param overallMetrics - The overall percentage metrics
 * @param options - Optional configuration for Markdown generation
 * @param logger - Logger for emitting log messages
 * @returns Markdown string representation
 * @throws Error if maxCharacters is below MINIMUM_CHARACTERS
 */
export function generateMarkdown(
  packages: PackageCoverage[],
  fileContents: Map<string, string[]>,
  overallMetrics: PercentageCoverageMetrics,
  options: MarkdownOptions = {},
  logger: Logger,
): string {
  const numberOfSurroundingLines = options.numberOfSurroundingLines ?? DEFAULT_MAX_NUMBER_OF_SURROUNDING_LINES
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS

  // Validate minimum character limit
  if (maxCharacters < MINIMUM_CHARACTERS) {
    throw new Error(`maxCharacters must be at least ${MINIMUM_CHARACTERS}, got ${maxCharacters}`)
  }

  // Step 1: Generate fixed content (badges and legend)
  const badges = generateCoverageBadges(overallMetrics)
  const legend = generateLegend()

  // Step 2: Build package section data
  const packageSections = buildPackageSections(packages, fileContents, numberOfSurroundingLines)

  // Step 3: Sort packages
  sortPackages(packageSections)

  // Step 4: Calculate PR metrics
  const prMetrics = calculatePRMetrics(packages)

  // Step 5: Render markdown with truncation
  if (packageSections.length === 0) {
    const markdown = buildMarkdownForNoUncoveredContent(badges, prMetrics)
    logger.info(`Generated Markdown with ${markdown.length} characters`)
    return markdown
  }

  const markdown = buildMarkdownWithinLimitFileLevel(badges, prMetrics, legend, packageSections, maxCharacters, logger)
  logger.info(`Generated Markdown with ${markdown.length} characters`)
  return markdown
}

// =============================================================================
// CLASSIFICATION & METRICS HELPERS
// =============================================================================

/**
 * Classify a file's coverage state.
 * Returns counts and flags for uncovered/partial lines, plus the appropriate status icon.
 */
function classifyFileCoverage(file: FileCoverage): FileCoverageClassification {
  let uncoveredCount = 0
  let partialCount = 0

  for (const line of file.lines) {
    if (line.state === 'not-covered') {
      uncoveredCount++
    } else if (line.state === 'partial') {
      partialCount++
    }
  }

  const hasUncovered = uncoveredCount > 0
  const hasPartial = partialCount > 0

  // Determine status icon: 🔴 if uncovered, 🟠 if only partial, 🟢 if fully covered
  let statusIcon: string
  if (hasUncovered) {
    statusIcon = FILE_STATUS_ICONS.hasUncovered
  } else if (hasPartial) {
    statusIcon = FILE_STATUS_ICONS.partialCoverage
  } else {
    statusIcon = FILE_STATUS_ICONS.fullyCovered
  }

  return { hasUncovered, hasPartial, uncoveredCount, partialCount, statusIcon }
}

/**
 * Calculate PR coverage metrics from packages (only changed lines).
 * Counts all files, not just ones with uncovered lines.
 */
function calculatePRMetrics(packages: PackageCoverage[]): PRMetrics {
  let coveredLines = 0
  let totalLines = 0
  let branchCovered = 0
  let branchTotal = 0
  let hasBranchData = false

  for (const pkg of packages) {
    for (const file of pkg.files) {
      totalLines += file.lineMetrics.total
      coveredLines += file.lineMetrics.covered

      if (file.branchMetrics) {
        hasBranchData = true
        branchCovered += file.branchMetrics.covered
        branchTotal += file.branchMetrics.total
      }
    }
  }

  const linePercent = totalLines === 0 ? 0 : (coveredLines / totalLines) * 100
  const branchPercent = hasBranchData && branchTotal > 0 ? (branchCovered / branchTotal) * 100 : null

  return { coveredLines, totalLines, linePercent, branchPercent }
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/**
 * Format a ratio as "covered/total".
 */
function formatRatio(covered: number, total: number): string {
  return `${covered}/${total}`
}

/**
 * Format a percentage value (0-100) to up to 2 decimal places.
 * Removes trailing zeros for cleaner output.
 * Examples: 100 → "100%", 99.99 → "99.99%", 20.5 → "20.5%"
 */
function formatPercent(value: number): string {
  const formatted = value.toFixed(2)
  // Remove trailing zeros and decimal point if not needed
  return `${formatted.replace(/\.?0+$/, '')}%`
}

/**
 * Calculate and format percentage from covered/total ratio.
 * Returns "0%" if total is 0.
 */
function formatPercentFromRatio(covered: number, total: number): string {
  if (total === 0) return '0%'
  return formatPercent((covered / total) * 100)
}

/**
 * Format branch percentage or return "n/a" if no data.
 */
function formatBranchPercentOrNA(branchMetrics: CoverageMetrics | undefined): string {
  if (!branchMetrics || branchMetrics.total === 0) {
    return 'n/a'
  }
  return formatPercentFromRatio(branchMetrics.covered, branchMetrics.total)
}

// =============================================================================
// SECTION DATA BUILDERS
// =============================================================================

/**
 * Build all package section data from packages.
 * Only includes packages that have files with uncovered/partial lines.
 */
function buildPackageSections(
  packages: PackageCoverage[],
  fileContents: Map<string, string[]>,
  numberOfSurroundingLines: number,
): PackageSectionData[] {
  const sections: PackageSectionData[] = []

  for (const pkg of packages) {
    const sectionData = buildPackageSectionData(pkg, fileContents, numberOfSurroundingLines)
    if (sectionData !== null) {
      sections.push(sectionData)
    }
  }

  return sections
}

/**
 * Build section data for a single package.
 * Returns null if the package has no files with uncovered lines.
 */
function buildPackageSectionData(
  pkg: PackageCoverage,
  fileContents: Map<string, string[]>,
  numberOfSurroundingLines: number,
): PackageSectionData | null {
  if (pkg.files.length === 0) {
    return null
  }
  const header = `### ${pkg.name}`
  const files: FileSectionData[] = []
  let totalUncoveredLines = 0
  let totalPartialBranches = 0

  for (const file of pkg.files) {
    const content = file.resolvedPath ? (fileContents.get(file.resolvedPath) ?? []) : []
    const classification = classifyFileCoverage(file)

    totalUncoveredLines += classification.uncoveredCount
    totalPartialBranches += classification.partialCount

    files.push({
      filename: file.filename,
      content: renderFileSection(file, content, numberOfSurroundingLines, classification),
      uncoveredLines: classification.uncoveredCount,
      partialBranches: classification.partialCount,
    })
  }

  sortFiles(files)

  return {
    packageName: pkg.name,
    header,
    files,
    totalUncoveredLines,
    totalPartialBranches,
  }
}

// =============================================================================
// MARKDOWN RENDERING
// =============================================================================

/**
 * Build markdown for case when there are no uncovered lines.
 */
function buildMarkdownForNoUncoveredContent(badges: string, prMetrics: PRMetrics): string {
  const parts: string[] = []

  parts.push('## Repo Coverage')
  parts.push(badges)
  parts.push('')
  parts.push('---')
  parts.push('')
  parts.push('## PR Coverage')
  parts.push('')
  parts.push(renderPRSummaryLine(prMetrics))
  parts.push('')
  parts.push('---')
  parts.push('')
  parts.push(`<sub>Generated by \`coverage-pr-comment\`</sub>`)

  return parts.join('\n')
}

/**
 * Simple budget tracker for building output within a character limit.
 * Reserves space for a required tail (e.g., legend) and tracks what fits.
 */
class CharBudget {
  private parts: string[] = []
  private currentLength = 0
  private readonly reservedTailLength: number
  private readonly maxCharacters: number

  constructor(maxCharacters: number, reservedTail: string) {
    this.maxCharacters = maxCharacters
    this.reservedTailLength = reservedTail.length
  }

  /** Check if adding content would exceed the limit. */
  wouldExceed(content: string): boolean {
    return this.currentLength + content.length + this.reservedTailLength > this.maxCharacters
  }

  /** Try to append content. Returns true if it fits, false otherwise. */
  tryAppend(content: string): boolean {
    if (this.wouldExceed(content)) {
      return false
    }
    this.parts.push(content)
    this.currentLength += content.length
    return true
  }

  /** Force append content (used for initial header that must fit). */
  append(content: string): void {
    this.parts.push(content)
    this.currentLength += content.length
  }

  /** Get the current output without the reserved tail. */
  getOutput(): string {
    return this.parts.join('')
  }
}

/**
 * Build markdown with truncation at file level when limit exceeded.
 */
function buildMarkdownWithinLimitFileLevel(
  badges: string,
  prMetrics: PRMetrics,
  legend: string,
  packageSections: PackageSectionData[],
  maxCharacters: number,
  logger: Logger,
): string {
  // Legend with separator is always appended at the end
  const legendWithSeparator = `\n---\n\n${legend}`

  // Build the fixed header
  const header = `## Repo Coverage\n${badges}\n\n---\n\n## PR Coverage\n${renderPRSummaryLine(prMetrics)}\n\n`

  // Check if even the header + legend exceeds the limit
  if (header.length + legendWithSeparator.length > maxCharacters) {
    return (header + legendWithSeparator).slice(0, maxCharacters)
  }

  const budget = new CharBudget(maxCharacters, legendWithSeparator)
  budget.append(header)

  // Track omissions
  let omittedFiles = 0
  let omittedPackages = 0
  let truncated = false

  // Process packages and files
  packageLoop: for (let p = 0; p < packageSections.length; p++) {
    const pkg = packageSections[p]!

    // Try to include package header
    if (!budget.tryAppend(`${pkg.header}\n`)) {
      // Can't fit this package header - omit this and all remaining packages
      omittedPackages += packageSections.length - p
      for (let i = p; i < packageSections.length; i++) {
        omittedFiles += packageSections[i]!.files.length
      }
      truncated = true
      break
    }

    // Process files in this package
    for (let f = 0; f < pkg.files.length; f++) {
      const fileContent = pkg.files[f]?.content
      const isLastFileOverall = f === pkg.files.length - 1 && p === packageSections.length - 1
      const spacing = isLastFileOverall ? '\n' : '\n\n'

      if (!budget.tryAppend(fileContent + spacing)) {
        // Can't fit this file - omit remaining files in this package and all remaining packages
        omittedFiles += pkg.files.length - f
        omittedPackages += packageSections.length - (p + 1)
        for (let i = p + 1; i < packageSections.length; i++) {
          omittedFiles += packageSections[i]!.files.length
        }
        truncated = true
        break packageLoop
      }
    }
  }

  // Add truncation notice if needed and it fits
  if (truncated && (omittedFiles > 0 || omittedPackages > 0)) {
    const notice = renderTruncationNotice(omittedFiles, omittedPackages)
    budget.tryAppend(`${notice}\n`)

    if (omittedFiles > 0) {
      logger.warning(
        `Truncated ${omittedPackages} packages, ${omittedFiles} files to fit into size constraint of ${maxCharacters} characters`,
      )
    }
  }

  // Build final output with legend
  let output = budget.getOutput() + legendWithSeparator

  // Hard guarantee (should already be true)
  if (output.length > maxCharacters) {
    output = output.slice(0, maxCharacters)
  }

  return output
}

/**
 * Render PR summary line.
 */
function renderPRSummaryLine(metrics: PRMetrics): string {
  if (metrics.totalLines === 0) {
    return '<b>0/0</b> changed lines covered'
  }

  const linePercentStr = formatPercentFromRatio(metrics.coveredLines, metrics.totalLines)
  const branchPercentStr = metrics.branchPercent !== null ? formatPercent(metrics.branchPercent) : 'n/a'

  return `<b>${formatRatio(metrics.coveredLines, metrics.totalLines)}</b> changed lines covered (Lines: <b>${linePercentStr}</b>, Branches: <b>${branchPercentStr}</b>)`
}

/**
 * Render truncation notice with counts of omitted items.
 */
function renderTruncationNotice(omittedFiles: number, omittedPackages: number): string {
  const parts: string[] = []
  if (omittedFiles > 0) {
    parts.push(`${omittedFiles} file(s)`)
  }
  if (omittedPackages > 0) {
    parts.push(`${omittedPackages} package(s)`)
  }
  return `... (${parts.join(' and ')} not shown due to size limit)`
}

/**
 * Render the coverage legend explaining the symbols.
 */
function generateLegend(): string {
  return `<sub>Legend: ${COVERAGE_ICONS['not-covered']} uncovered · ${COVERAGE_ICONS.partial} partial branch · ${COVERAGE_ICONS.covered} covered · ${COVERAGE_ICONS['no-info']} non-executable/blank<br>Generated by \`coverage-pr-comment\`</sub>`
}

/**
 * Render coverage badges for the overall packages.
 */
function generateCoverageBadges(overallMetrics: PercentageCoverageMetrics): string {
  const badges: string[] = []
  badges.push(renderBadge('Line Coverage', overallMetrics.lineCoverage))
  badges.push(renderBadge('Branch Coverage', overallMetrics.branchCoverage))
  return badges.join(' ')
}

/**
 * Render a single shields.io badge markdown.
 */
function renderBadge(label: string, percent: number | undefined): string {
  const encodedLabel = encodeURIComponent(label)

  let value: string
  let color: string
  if (percent === undefined) {
    value = 'n/a'
    color = 'brightgreen'
  } else {
    value = formatPercent(percent)
    color = getBadgeColor(percent)
  }
  const encodedValue = encodeURIComponent(value)

  return `![${label}](https://img.shields.io/badge/${encodedLabel}-${encodedValue}-${color}.svg?style=flat)`
}

/**
 * Get badge color based on coverage percentage.
 */
function getBadgeColor(percent: number): string {
  if (percent >= 80) return 'brightgreen'
  if (percent >= 60) return 'green'
  if (percent >= 40) return 'yellowgreen'
  if (percent >= 20) return 'yellow'
  return 'red'
}

/**
 * Render a markdown section for a single file.
 * Uses inline format for fully covered files, details block for files with uncovered lines.
 */
function renderFileSection(
  file: FileCoverage,
  fileLines: string[],
  numberOfSurroundingLines: number,
  classification: FileCoverageClassification,
): string {
  const { hasUncovered, hasPartial, statusIcon } = classification

  // Fully covered - use inline format
  if (!hasUncovered && !hasPartial) {
    return `✓ ${FILE_STATUS_ICONS.fullyCovered} <b>${file.filename}</b> — <b>${formatRatio(file.lineMetrics.covered, file.lineMetrics.total)}</b> changed lines covered`
  }

  // Has uncovered/partial lines - use details block
  const lines: string[] = []

  const linePercent = formatPercentFromRatio(file.lineMetrics.covered, file.lineMetrics.total)
  const branchPercent = formatBranchPercentOrNA(file.branchMetrics)

  lines.push(`<details>`)
  lines.push(
    `<summary>${statusIcon} <b>${file.filename}</b> — <b>${formatRatio(file.lineMetrics.covered, file.lineMetrics.total)}</b> changed lines covered (Lines: <b>${linePercent}</b>, Branches: <b>${branchPercent}</b>)</summary>`,
  )
  lines.push('')

  const extension = getFileExtension(file.filename)
  lines.push(`\`\`\`${extension}`)
  lines.push(renderAnnotatedLines(file.lines, fileLines, numberOfSurroundingLines))
  lines.push('```')
  lines.push('</details>')

  return lines.join('\n')
}

/**
 * Extract file extension for syntax highlighting.
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  if (parts.length < 2) {
    return ''
  }

  const lastPart = parts[parts.length - 1]
  const ext = lastPart ? lastPart.toLowerCase() : ''

  const extensionMap: Record<string, string> = {
    cs: 'csharp',
    rs: 'rust',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
  }

  return extensionMap[ext] || ext
}

// =============================================================================
// LINE ANNOTATION
// =============================================================================

/**
 * Render annotated line content showing coverage state.
 * Only shows uncovered/partial lines with configurable context lines around them.
 * Uses smart ellipsis handling: shows single lines instead of "..." when gap is small.
 */
function renderAnnotatedLines(
  coverageLines: LineCoverage[],
  fileLines: string[],
  numberOfSurroundingLines: number,
): string {
  if (coverageLines.length === 0) {
    return '(no coverage data)'
  }

  const sortedLines = [...coverageLines].sort((a, b) => a.lineNumber - b.lineNumber)

  // Create a map for quick line lookup
  const lineMap = new Map<number, LineCoverage>()
  for (const line of sortedLines) {
    lineMap.set(line.lineNumber, line)
  }

  // Find all uncovered/partial lines (the "interesting" lines)
  const interestingLineNumbers = new Set<number>()
  for (const line of sortedLines) {
    if (line.state === 'not-covered' || line.state === 'partial') {
      interestingLineNumbers.add(line.lineNumber)
    }
  }

  // Expand to include context lines around interesting lines
  const linesToShow = new Set<number>()
  for (const lineNum of interestingLineNumbers) {
    for (let i = lineNum - numberOfSurroundingLines; i <= lineNum + numberOfSurroundingLines; i++) {
      if (i >= 1 && (i <= fileLines.length || lineMap.has(i))) {
        linesToShow.add(i)
      }
    }
  }

  const linesToShowArray = [...linesToShow].sort((a, b) => a - b)

  // Helper to get line content from fileLines (1-indexed to 0-indexed)
  const getLineContent = (lineNum: number): string => {
    const index = lineNum - 1
    if (index >= 0 && index < fileLines.length) {
      return fileLines[index] ?? ''
    }
    return ''
  }

  // Helper to render a single annotated line
  const renderLine = (lineNum: number): string => {
    const line = lineMap.get(lineNum)
    const icon = line ? COVERAGE_ICONS[line.state] : COVERAGE_ICONS['no-info']
    const lineNumStr = lineNum.toString().padStart(3, ' ')
    const content = getLineContent(lineNum)
    return `${lineNumStr} ${icon} ${content}`
  }

  const outputLines: string[] = []

  const minLineInData = sortedLines[0]?.lineNumber ?? 1
  const maxLineInData = sortedLines[sortedLines.length - 1]?.lineNumber ?? 1
  const firstLineToShow = linesToShowArray[0] ?? minLineInData
  const lastLineToShow = linesToShowArray[linesToShowArray.length - 1] ?? maxLineInData

  // Add leading gap handling
  if (firstLineToShow > 1) {
    outputLines.push(renderGap(0, firstLineToShow, lineMap, getLineContent))
  }

  let prevLineNumber = -1

  for (const lineNum of linesToShowArray) {
    // Handle gap between consecutive shown lines
    if (prevLineNumber !== -1 && lineNum > prevLineNumber + 1) {
      outputLines.push(renderGap(prevLineNumber, lineNum, lineMap, getLineContent))
    }

    outputLines.push(renderLine(lineNum))
    prevLineNumber = lineNum
  }

  // Add trailing gap handling
  if (lastLineToShow < fileLines.length) {
    outputLines.push(renderGap(lastLineToShow, fileLines.length + 1, lineMap, getLineContent))
  }

  return outputLines.join('\n')
}

/**
 * Render a gap between two line numbers.
 * If gap is just 1 line, renders that line; otherwise renders "...".
 *
 * @param prevLine - The last shown line (0 if at start)
 * @param nextLine - The next line to be shown (fileLines.length + 1 if at end)
 * @param lineMap - The map with available line coverage
 * @param getLineContent - the callback to get the content based on the line
 */
function renderGap(
  prevLine: number,
  nextLine: number,
  lineMap: Map<number, LineCoverage>,
  getLineContent: (lineNum: number) => string,
): string {
  const gapSize = nextLine - prevLine - 1

  if (gapSize === 1) {
    // Show the single hidden line
    const gapLineNum = prevLine + 1
    const gapLine = lineMap.get(gapLineNum)
    const gapIcon = gapLine ? COVERAGE_ICONS[gapLine.state] : COVERAGE_ICONS['no-info']
    const gapLineNumStr = gapLineNum.toString().padStart(3, ' ')
    const gapContent = getLineContent(gapLineNum)
    return `${gapLineNumStr} ${gapIcon} ${gapContent}`
  }

  return '...'
}

// =============================================================================
// SORTING
// =============================================================================

/**
 * Sort packages by uncovered lines, partial branches, then alphabetically.
 */
function sortPackages(packages: PackageSectionData[]): void {
  packages.sort((a, b) => {
    if (a.totalUncoveredLines !== b.totalUncoveredLines) {
      return b.totalUncoveredLines - a.totalUncoveredLines
    }
    if (a.totalPartialBranches !== b.totalPartialBranches) {
      return b.totalPartialBranches - a.totalPartialBranches
    }
    return a.packageName.localeCompare(b.packageName)
  })
}

/**
 * Sort files by uncovered lines, partial branches, then alphabetically.
 * Fully covered files (0 uncovered) come first, then files with uncovered lines.
 */
function sortFiles(files: FileSectionData[]): void {
  files.sort((a, b) => {
    const aIsFullyCovered = a.uncoveredLines === 0
    const bIsFullyCovered = b.uncoveredLines === 0
    if (aIsFullyCovered !== bIsFullyCovered) {
      return aIsFullyCovered ? -1 : 1
    }

    if (!aIsFullyCovered && a.uncoveredLines !== b.uncoveredLines) {
      return b.uncoveredLines - a.uncoveredLines
    }

    if (a.partialBranches !== b.partialBranches) {
      return b.partialBranches - a.partialBranches
    }

    return a.filename.localeCompare(b.filename)
  })
}
