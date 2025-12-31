import type { CoverageMetrics, CoverageReport, FileCoverage, LineCoverage, PackageCoverage } from '../coverage/model.js'

/** Emoji indicators for line coverage states */
const COVERAGE_ICONS = {
  covered: '🟩',
  partial: '🟨',
  'not-covered': '🔳',
} as const

/**
 * Generate markdown visualization for a coverage report.
 * This is a pure function suitable for snapshot testing.
 *
 * @param report - The normalized coverage report
 * @returns Markdown string representation
 */
export function generateMarkdown(report: CoverageReport): string {
  const sections: string[] = []

  // Generate per-package sections
  for (const pkg of report.packages) {
    sections.push(generatePackageSection(pkg))
  }

  // Add legend at the end
  sections.push(generateLegend())

  return sections.join('\n\n')
}

/**
 * Generate a markdown section for a single package.
 */
function generatePackageSection(pkg: PackageCoverage): string {
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

  // Generate file sections
  for (const file of pkg.files) {
    lines.push(generateFileSection(file))
  }

  return lines.join('\n')
}

/**
 * Generate a collapsible markdown section for a single file.
 */
function generateFileSection(file: FileCoverage): string {
  const lines: string[] = []

  // Start collapsible details section
  lines.push(`<details open><summary>${file.filename}</summary>`)
  lines.push('')

  // Generate code block with coverage annotations
  const extension = getFileExtension(file.filename)
  lines.push('```' + extension)
  lines.push(generateAnnotatedLines(file.lines))
  lines.push('```')

  lines.push('</details>')

  return lines.join('\n')
}

/**
 * Generate annotated line content showing coverage state.
 * Groups consecutive lines and adds ellipsis for gaps.
 */
function generateAnnotatedLines(coverageLines: LineCoverage[]): string {
  if (coverageLines.length === 0) {
    return '(no coverage data)'
  }

  const sortedLines = [...coverageLines].sort((a, b) => a.lineNumber - b.lineNumber)
  const outputLines: string[] = []

  let prevLineNumber = -1

  for (const line of sortedLines) {
    // Add ellipsis if there's a gap in line numbers
    if (prevLineNumber !== -1 && line.lineNumber > prevLineNumber + 1) {
      outputLines.push('...')
    }

    const icon = COVERAGE_ICONS[line.state]
    const lineNum = line.lineNumber.toString().padStart(3, ' ')
    outputLines.push(`${lineNum} ${icon}`)

    prevLineNumber = line.lineNumber
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
