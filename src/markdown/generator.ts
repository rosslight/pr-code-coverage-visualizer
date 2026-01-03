import type { CoverageMetrics, FileCoverage, LineCoverage, PackageCoverage } from '../coverage/model.js'

/** Emoji indicators for line coverage states */
const COVERAGE_ICONS = {
  covered: '🟩',
  partial: '🟨',
  'not-covered': '🟥',
  'no-info': '⬜',
} as const

/** Default maximum number of surrounding lines around an uncovered line */
export const DEFAULT_MAX_NUMBER_OF_SURROUNDING_LINES = 1

/** Default maximum characters for markdown output */
export const DEFAULT_MAX_CHARACTERS = 65536

/** Minimum characters required for meaningful markdown output (badges + legend + notice) */
export const MINIMUM_CHARACTERS = 500

/** Options for markdown generation */
export type MarkdownOptions = {
  /** Number of lines to show before and after uncovered lines (default: 1) */
  numberOfSurroundingLines?: number
  /** Maximum number of characters in the output (default: 65536, minimum: 500) */
  maxCharacters?: number
}

/**
 * Generate markdown visualization for coverage packages.
 * This is a pure function suitable for snapshot testing.
 *
 * @param packages - The normalized coverage packages
 * @param fileContents - Map of resolved (absolute) path to array of line contents
 * @param options - Optional configuration for markdown generation
 * @returns Markdown string representation
 * @throws Error if maxCharacters is below MINIMUM_CHARACTERS
 */
export function generateMarkdown(
  packages: PackageCoverage[],
  fileContents: Map<string, string[]>,
  options: MarkdownOptions = {},
): string {
  const numberOfSurroundingLines = options.numberOfSurroundingLines ?? DEFAULT_MAX_NUMBER_OF_SURROUNDING_LINES
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS

  // Validate minimum character limit
  if (maxCharacters < MINIMUM_CHARACTERS) {
    throw new Error(`maxCharacters must be at least ${MINIMUM_CHARACTERS}, got ${maxCharacters}`)
  }

  // Generate fixed content (badges and legend)
  const badges = generateCoverageBadges(packages)
  const legend = generateLegend()

  // Generate all package sections with their file contents
  const packageSections: PackageSectionData[] = []
  for (const pkg of packages) {
    const sectionData = generatePackageSectionData(pkg, fileContents, numberOfSurroundingLines)
    if (sectionData !== null) {
      packageSections.push(sectionData)
    }
  }

  // Check if all lines are covered (no package sections with uncovered lines)
  const hasUncoveredContent = packageSections.length > 0

  if (!hasUncoveredContent) {
    // No uncovered lines - return badges + success message
    // We assume that this always fits the minimum size
    const successMessage = '✅ All lines are covered!'
    return badges ? `${badges}\n\n${successMessage}` : successMessage
  }

  const separator = '\n\n'
  return buildMarkdownWithinLimitFileLevel({
    badges,
    legend,
    packageSections,
    separator,
    maxCharacters,
  })
}

function buildMarkdownWithinLimitFileLevel(params: {
  badges: string | null
  legend: string
  packageSections: PackageSectionData[]
  separator: string
  maxCharacters: number
}): string {
  const { badges, legend, packageSections, separator, maxCharacters } = params

  // Parts we will join with `separator`
  const parts: string[] = []
  if (badges) parts.push(badges)

  // We will always include legend at the end, so every "fit" check reserves room for it.
  const legendOnlyLength = joinedLength([...parts, legend], separator)
  if (legendOnlyLength > maxCharacters) {
    // Should not happen with MINIMUM_CHARACTERS, but be safe.
    const out = [...parts, legend].join(separator)
    return out.slice(0, maxCharacters)
  }

  let omittedFiles = 0
  let omittedPackages = 0

  // Build incrementally: header, then each file
  for (let p = 0; p < packageSections.length; p++) {
    const pkg = packageSections[p]!

    // Decide whether we can include this package header at all
    if (!canFitWithLegend(parts, pkg.header, legend, separator, maxCharacters)) {
      // Omit this package and all remaining
      omittedPackages += packageSections.length - p
      for (let i = p; i < packageSections.length; i++) omittedFiles += packageSections[i]!.files.length
      break
    }

    // Include header
    parts.push(pkg.header)

    for (let f = 0; f < pkg.files.length; f++) {
      const file = pkg.files[f]!.content

      if (!canFitWithLegend(parts, file, legend, separator, maxCharacters)) {
        // Can't fit this file or remaining files in this package
        omittedFiles += pkg.files.length - f

        // Also omit all remaining packages completely
        omittedPackages += packageSections.length - (p + 1)
        for (let i = p + 1; i < packageSections.length; i++) omittedFiles += packageSections[i]!.files.length

        // Optionally: if we added a package header but no files fit, you may want to keep it for context.
        // Current behavior: we keep the header.
        // If you *don't* want empty headers, you could remove it here when !includedAnyFileInThisPkg.

        p = packageSections.length // break outer
        break
      }

      parts.push(file)
    }
  }

  // Add truncation notice if anything omitted AND it fits
  if (omittedFiles > 0 || omittedPackages > 0) {
    const notice = generateTruncationNotice(omittedFiles, omittedPackages)
    if (canFitWithLegend(parts, notice, legend, separator, maxCharacters)) {
      parts.push(notice)
    }
  }

  // Finish with legend
  parts.push(legend)

  // Hard guarantee (should already be true)
  let out = parts.join(separator)
  if (out.length > maxCharacters) out = out.slice(0, maxCharacters)
  return out
}

function joinedLength(parts: string[], separator: string): number {
  if (parts.length === 0) return 0
  let len = 0
  for (const p of parts) len += p.length
  len += separator.length * (parts.length - 1)
  return len
}

function canFitWithLegend(parts: string[], candidate: string, legend: string, separator: string, max: number): boolean {
  const test = [...parts, candidate, legend]
  return joinedLength(test, separator) <= max
}

/** Data structure for a package section with its files */
type PackageSectionData = {
  packageName: string
  header: string
  files: FileSectionData[]
}

/** Data structure for a file section */
type FileSectionData = {
  filename: string
  content: string
}

/**
 * Generate truncation notice with counts of omitted items.
 */
function generateTruncationNotice(omittedFiles: number, omittedPackages: number): string {
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
 * Generate package section data without joining into final string.
 * Returns null if the package has no files with uncovered lines.
 */
function generatePackageSectionData(
  pkg: PackageCoverage,
  fileContents: Map<string, string[]>,
  numberOfSurroundingLines: number,
): PackageSectionData | null {
  // Filter to only files with uncovered lines
  const filesWithUncovered = pkg.files.filter(hasUncoveredLines)

  // Skip package entirely if all files are fully covered
  if (filesWithUncovered.length === 0) {
    return null
  }

  // Calculate aggregate metrics for the package
  const packageMetrics = calculatePackageMetrics(pkg.files)

  // Package header with coverage summary
  const linePercent = formatPercent(packageMetrics.lineMetrics)
  const branchPercent = packageMetrics.branchMetrics ? formatPercent(packageMetrics.branchMetrics) : null

  let header = `**${pkg.name}** (LineCoverage: ${linePercent}`
  if (branchPercent) {
    header += `, BranchCoverage: ${branchPercent}`
  }
  header += ')'

  // Generate file sections
  const files: FileSectionData[] = []
  for (const file of filesWithUncovered) {
    const content = file.resolvedPath ? (fileContents.get(file.resolvedPath) ?? []) : []
    files.push({
      filename: file.filename,
      content: generateFileSection(file, content, numberOfSurroundingLines),
    })
  }

  return {
    packageName: pkg.name,
    header,
    files,
  }
}

/**
 * Check if a file has any uncovered or partial lines.
 */
function hasUncoveredLines(file: FileCoverage): boolean {
  return file.lines.some((line) => line.state === 'not-covered' || line.state === 'partial')
}

/**
 * Generate a collapsible markdown section for a single file.
 */
function generateFileSection(file: FileCoverage, fileLines: string[], numberOfSurroundingLines: number): string {
  const lines: string[] = []

  // Start collapsible details section
  lines.push(`<details><summary>${file.filename}</summary>`)
  lines.push('')

  // Generate code block with coverage annotations
  const extension = getFileExtension(file.filename)
  lines.push('```' + extension)
  lines.push(generateAnnotatedLines(file.lines, fileLines, numberOfSurroundingLines))
  lines.push('```')

  lines.push('</details>')

  return lines.join('\n')
}

/**
 * Generate annotated line content showing coverage state.
 * Only shows uncovered/partial lines with configurable context lines around them.
 * Uses smart ellipsis handling: shows single lines instead of "..." when gap is small.
 */
function generateAnnotatedLines(
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
    // Add context before and after
    for (let i = lineNum - numberOfSurroundingLines; i <= lineNum + numberOfSurroundingLines; i++) {
      if (i >= 1 && (i <= fileLines.length || lineMap.has(i))) {
        linesToShow.add(i)
      }
    }
  }

  // Convert to sorted array
  const linesToShowArray = [...linesToShow].sort((a, b) => a - b)

  // Helper to get line content from fileLines (1-indexed to 0-indexed)
  const getLineContent = (lineNum: number): string => {
    const index = lineNum - 1
    if (index >= 0 && index < fileLines.length) {
      return fileLines[index] ?? ''
    }
    return ''
  }

  const outputLines: string[] = []

  // Determine the first and last line numbers in coverage data for ellipsis detection
  const minLineInData = sortedLines[0]?.lineNumber ?? 1
  const maxLineInData = sortedLines[sortedLines.length - 1]?.lineNumber ?? 1
  const firstLineToShow = linesToShowArray[0] ?? minLineInData
  const lastLineToShow = linesToShowArray[linesToShowArray.length - 1] ?? maxLineInData

  // Add leading ellipsis if there's content before the first shown line
  // If only 1 line is hidden, show the actual line instead of ellipsis
  if (firstLineToShow > 1) {
    if (firstLineToShow === 2) {
      // Only line 1 is hidden, show it
      const gapLine = lineMap.get(1)
      const gapIcon = gapLine ? COVERAGE_ICONS[gapLine.state] : COVERAGE_ICONS['no-info']
      const gapLineNumStr = '1'.padStart(3, ' ')
      const gapContent = getLineContent(1)
      outputLines.push(`${gapLineNumStr} ${gapIcon} ${gapContent}`)
    } else {
      outputLines.push('...')
    }
  }

  let prevLineNumber = -1

  for (const lineNum of linesToShowArray) {
    const line = lineMap.get(lineNum)

    // Check for gap and handle ellipsis
    if (prevLineNumber !== -1 && lineNum > prevLineNumber + 1) {
      const gapSize = lineNum - prevLineNumber - 1

      // If gap is just 1 line, show the actual line
      if (gapSize === 1) {
        const gapLineNum = prevLineNumber + 1
        const gapLine = lineMap.get(gapLineNum)
        const gapIcon = gapLine ? COVERAGE_ICONS[gapLine.state] : COVERAGE_ICONS['no-info']
        const gapLineNumStr = gapLineNum.toString().padStart(3, ' ')
        const gapContent = getLineContent(gapLineNum)
        outputLines.push(`${gapLineNumStr} ${gapIcon} ${gapContent}`)
      } else {
        // 2+ line gap: show single ellipsis
        outputLines.push('...')
      }
    }

    const icon = line ? COVERAGE_ICONS[line.state] : COVERAGE_ICONS['no-info']
    const lineNumStr = lineNum.toString().padStart(3, ' ')
    const content = getLineContent(lineNum)
    outputLines.push(`${lineNumStr} ${icon} ${content}`)

    prevLineNumber = lineNum
  }

  // Add trailing ellipsis if there's content after the last shown line
  // If only 1 line is hidden, show the actual line instead of ellipsis
  if (lastLineToShow < fileLines.length) {
    if (lastLineToShow === fileLines.length - 1) {
      // Only the last line is hidden, show it
      const lastLineNum = fileLines.length
      const gapLine = lineMap.get(lastLineNum)
      const gapIcon = gapLine ? COVERAGE_ICONS[gapLine.state] : COVERAGE_ICONS['no-info']
      const gapLineNumStr = lastLineNum.toString().padStart(3, ' ')
      const gapContent = getLineContent(lastLineNum)
      outputLines.push(`${gapLineNumStr} ${gapIcon} ${gapContent}`)
    } else {
      outputLines.push('...')
    }
  }

  return outputLines.join('\n')
}

/**
 * Generate the coverage legend explaining the symbols.
 */
function generateLegend(): string {
  return `${COVERAGE_ICONS['not-covered']} Not covered, ${COVERAGE_ICONS.partial} Missing branch coverage, ${COVERAGE_ICONS.covered} Covered`
}

/**
 * Generate coverage badges for the overall packages.
 * Returns badges for Line, Branch, and Function coverage if data is available.
 */
function generateCoverageBadges(packages: PackageCoverage[]): string | null {
  const metrics = calculateReportMetrics(packages)

  // Need at least line metrics to generate badges
  if (metrics.lineMetrics.total === 0) {
    return null
  }

  const badges: string[] = []

  // Line coverage badge
  badges.push(generateBadge('Line Coverage', metrics.lineMetrics))

  // Branch coverage badge
  if (metrics.branchMetrics && metrics.branchMetrics.total > 0) {
    badges.push(generateBadge('Branch Coverage', metrics.branchMetrics))
  }

  return badges.join('\n')
}

/**
 * Generate a single shields.io badge markdown.
 */
function generateBadge(label: string, metrics: CoverageMetrics): string {
  const percent = metrics.total === 0 ? 0 : (metrics.covered / metrics.total) * 100
  const color = getBadgeColor(percent)
  const encodedLabel = encodeURIComponent(label)
  const encodedValue = encodeURIComponent(`${percent.toFixed(2)}%`)

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
 * Calculate aggregate metrics for the entire packages.
 */
function calculateReportMetrics(packages: PackageCoverage[]): {
  lineMetrics: CoverageMetrics
  branchMetrics?: CoverageMetrics
} {
  let lineCovered = 0
  let lineTotal = 0
  let branchCovered = 0
  let branchTotal = 0
  let hasBranchData = false

  for (const pkg of packages) {
    for (const file of pkg.files) {
      lineCovered += file.lineMetrics.covered
      lineTotal += file.lineMetrics.total

      if (file.branchMetrics) {
        hasBranchData = true
        branchCovered += file.branchMetrics.covered
        branchTotal += file.branchMetrics.total
      }
    }
  }

  const result: {
    lineMetrics: CoverageMetrics
    branchMetrics?: CoverageMetrics
  } = {
    lineMetrics: { covered: lineCovered, total: lineTotal },
  }

  if (hasBranchData) {
    result.branchMetrics = { covered: branchCovered, total: branchTotal }
  }

  return result
}

/**
 * Calculate aggregate metrics for a package from its files.
 */
function calculatePackageMetrics(files: FileCoverage[]): {
  lineMetrics: CoverageMetrics
  branchMetrics?: CoverageMetrics
} {
  let lineCovered = 0
  let lineTotal = 0
  let branchCovered = 0
  let branchTotal = 0
  let hasBranchData = false

  for (const file of files) {
    lineCovered += file.lineMetrics.covered
    lineTotal += file.lineMetrics.total

    if (file.branchMetrics) {
      hasBranchData = true
      branchCovered += file.branchMetrics.covered
      branchTotal += file.branchMetrics.total
    }
  }

  const result: {
    lineMetrics: CoverageMetrics
    branchMetrics?: CoverageMetrics
  } = {
    lineMetrics: { covered: lineCovered, total: lineTotal },
  }

  if (hasBranchData) {
    result.branchMetrics = { covered: branchCovered, total: branchTotal }
  }

  return result
}

/**
 * Format coverage metrics as a percentage string.
 */
function formatPercent(metrics: CoverageMetrics): string {
  if (metrics.total === 0) {
    return '0%'
  }
  const percent = (metrics.covered / metrics.total) * 100
  return `${percent.toFixed(0)}%`
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

  // Map extensions to markdown code block language identifiers
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
