#!/usr/bin/env node
import * as fs from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { processCoverage, type Logger } from './core/index.js'

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

  // Process coverage
  const result = await processCoverage(
    {
      files: values.files,
      showChangedLinesOnly: values['show-changed-only'] ?? false,
      showGlobOnly: values['show-glob'] ?? '**',
      ...(values['base-ref'] && { baseRef: values['base-ref'] }),
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
