#!/usr/bin/env node
import * as fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { parseArgs, promisify } from 'node:util'
import { processCoverage, type Logger } from './core/index.js'
import { isValidGitRef } from './filter/changed-lines.js'

const execFileAsync = promisify(execFile)

/**
 * Logger implementation for CLI that uses console.
 */
const cliLogger: Logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warning: (message) => console.warn(`[WARN] ${message}`),
}

/**
 * Print usage information.
 */
function printHelp(): void {
  console.log(`
coverage-visualizer - Generate coverage reports from Cobertura XML files

USAGE:
  coverage-visualizer --files <patterns> [options]

OPTIONS:
  --files <patterns>       Coverage file patterns (required, comma or newline separated)
  --output <path>          Output file path (optional, prints to stdout if not specified)
  --source <path>          Source directory for resolving file paths (default: current directory)
  --base-ref <ref>         Git ref to compare against (e.g., origin/main, HEAD~1)
  --show-changed-only      Filter to show only changed lines (requires --base-ref)
  --show-glob <pattern>    Glob pattern to filter which files to show (default: **)
  --help                   Show this help message

EXAMPLES:
  # Generate report for all coverage files
  coverage-visualizer --files "coverage/*.xml"

  # Save report to file
  coverage-visualizer --files "coverage/*.xml" --output report.md

  # Show only changed lines compared to main branch
  coverage-visualizer --files "coverage/*.xml" --base-ref origin/main --show-changed-only

  # Filter to specific directory
  coverage-visualizer --files "coverage/*.xml" --show-glob "src/components/**"
`)
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      files: { type: 'string', short: 'f' },
      output: { type: 'string', short: 'o' },
      source: { type: 'string', short: 's' },
      'base-ref': { type: 'string', short: 'b' },
      'show-changed-only': { type: 'boolean', default: false },
      'show-glob': { type: 'string', default: '**' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  })

  // Show help
  if (values.help) {
    printHelp()
    process.exit(0)
  }

  // Validate required arguments
  if (!values.files) {
    console.error('Error: --files is required\n')
    printHelp()
    process.exit(1)
  }

  // Validate base-ref is provided if show-changed-only is set
  if (values['show-changed-only'] && !values['base-ref']) {
    console.error('Error: --base-ref is required when using --show-changed-only\n')
    printHelp()
    process.exit(1)
  }

  let baseSha: string | undefined
  let headSha: string | undefined

  if (values['base-ref']) {
    // Validate git ref format to prevent argument injection
    if (!isValidGitRef(values['base-ref'])) {
      console.error(`Error: Invalid git ref format: ${values['base-ref']}\n`)
      console.error('Git refs must start with alphanumeric and contain only safe characters.')
      process.exit(1)
    }

    try {
      // Using execFile to prevent shell injection
      const { stdout: baseOut } = await execFileAsync('git', ['rev-parse', values['base-ref']])
      baseSha = baseOut.trim()

      const { stdout: headOut } = await execFileAsync('git', ['rev-parse', 'HEAD'])
      headSha = headOut.trim()
    } catch (error) {
      console.warn(
        `[WARN] Failed to resolve git SHAs for base-ref '${values['base-ref']}': ${error}. Showing all lines instead.`,
      )
    }
  }

  // Process coverage
  const result = await processCoverage(
    {
      files: values.files,
      sourceDir: values.source ?? process.cwd(),
      showChangedLinesOnly: values['show-changed-only'] ?? false,
      showGlobOnly: values['show-glob'] ?? '**',
      ...(values['base-ref'] && { baseRef: values['base-ref'] }),
      ...(baseSha && headSha ? { baseSha, headSha } : {}),
    },
    cliLogger,
  )

  if (!result) {
    process.exit(1)
  }

  const { markdown, metrics } = result

  // Output results
  if (values.output) {
    await fs.writeFile(values.output, markdown, 'utf-8')
    console.log(`\nReport written to: ${values.output}`)
  } else {
    console.log('\n' + markdown)
  }

  // Print metrics summary
  console.log('\n--- Coverage Summary ---')
  console.log(`Line Coverage:     ${metrics.lineCoverage.toFixed(2)}%`)
  console.log(`Branch Coverage:   ${metrics.branchCoverage.toFixed(2)}%`)
  console.log(`Function Coverage: ${metrics.functionCoverage.toFixed(2)}%`)
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
