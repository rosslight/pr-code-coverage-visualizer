import type { CoverageMetrics, CoverageReport, FileCoverage, LineCoverage, PackageCoverage } from '../coverage/model.js'

/** Emoji indicators for line coverage states */
const COVERAGE_ICONS = {
  covered: '🟩',
  partial: '🟨',
  'not-covered': '🔳',
} as const

/** Options for markdown generation */
export type MarkdownOptions = {
  /** Number of context lines to show before and after uncovered lines (default: 1) */
  contextLines?: number
}

/**
 * Generate markdown visualization for a coverage report.
 * This is a pure function suitable for snapshot testing.
 *
 * @param report - The normalized coverage report
 * @param options - Optional configuration for markdown generation
 * @returns Markdown string representation
 */
export function generateMarkdown(report: CoverageReport, options: MarkdownOptions = {}): string {
  const sections: string[] = []

  // Generate per-package sections (skip packages with no uncovered lines)
  for (const pkg of report.packages) {
    const section = generatePackageSection(pkg, options)
    if (section !== null) {
      sections.push(section)
    }
  }

  // If no packages have uncovered lines, show a success message
  if (sections.length === 0) {
    return '✅ All lines are covered!'
  }

  // Add legend at the end
  sections.push(generateLegend())

  return sections.join('\n\n')
}

/**
 * Check if a file has any uncovered or partial lines.
 */
function hasUncoveredLines(file: FileCoverage): boolean {
  return file.lines.some((line) => line.state === 'not-covered' || line.state === 'partial')
}

/**
 * Generate a markdown section for a single package.
 * Returns null if the package has no files with uncovered lines.
 */
function generatePackageSection(pkg: PackageCoverage, options: MarkdownOptions): string | null {
  // Filter to only files with uncovered lines
  const filesWithUncovered = pkg.files.filter(hasUncoveredLines)

  // Skip package entirely if all files are fully covered
  if (filesWithUncovered.length === 0) {
    return null
  }

  const lines: string[] = []

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

  lines.push(header)

  // Generate file sections only for files with uncovered lines
  for (const file of filesWithUncovered) {
    lines.push(generateFileSection(file, options))
  }

  return lines.join('\n')
}

/**
 * Generate a collapsible markdown section for a single file.
 */
function generateFileSection(file: FileCoverage, options: MarkdownOptions): string {
  const lines: string[] = []

  // Start collapsible details section
  lines.push(`<details open><summary>${file.filename}</summary>`)
  lines.push('')

  // Generate code block with coverage annotations
  const extension = getFileExtension(file.filename)
  lines.push('```' + extension)
  lines.push(generateAnnotatedLines(file.lines, options))
  lines.push('```')

  lines.push('</details>')

  return lines.join('\n')
}

/**
 * Generate annotated line content showing coverage state.
 * Only shows uncovered/partial lines with configurable context lines around them.
 * Uses smart ellipsis handling: shows single lines instead of "..." when gap is small.
 */
function generateAnnotatedLines(coverageLines: LineCoverage[], options: MarkdownOptions): string {
  if (coverageLines.length === 0) {
    return '(no coverage data)'
  }

  const contextLines = options.contextLines ?? 1
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
    // Add context before
    for (let i = lineNum - contextLines; i <= lineNum + contextLines; i++) {
      if (lineMap.has(i)) {
        linesToShow.add(i)
      }
    }
  }

  // Convert to sorted array
  const linesToShowArray = [...linesToShow].sort((a, b) => a - b)

  const outputLines: string[] = []
  let prevLineNumber = -1

  for (const lineNum of linesToShowArray) {
    const line = lineMap.get(lineNum)
    if (!line) continue

    // Check for gap and handle ellipsis
    if (prevLineNumber !== -1 && lineNum > prevLineNumber + 1) {
      const gapSize = lineNum - prevLineNumber - 1

      // If gap is just 1 line and that line exists in our data, show it instead of "..."
      if (gapSize === 1) {
        const gapLineNum = prevLineNumber + 1
        const gapLine = lineMap.get(gapLineNum)
        if (gapLine) {
          const gapIcon = COVERAGE_ICONS[gapLine.state]
          const gapLineNumStr = gapLineNum.toString().padStart(3, ' ')
          outputLines.push(`${gapLineNumStr} ${gapIcon}`)
        } else {
          outputLines.push('...')
        }
      } else {
        outputLines.push('...')
      }
    }

    const icon = COVERAGE_ICONS[line.state]
    const lineNumStr = lineNum.toString().padStart(3, ' ')
    outputLines.push(`${lineNumStr} ${icon}`)

    prevLineNumber = lineNum
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
