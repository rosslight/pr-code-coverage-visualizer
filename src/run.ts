import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import { glob } from 'glob'
import { CoberturaCoverageParser, type CoverageReport } from './coverage/index.js'
import type { Context } from './github.js'
import { generateMarkdown } from './markdown/index.js'

export type Inputs = {
  files: string
  updateComment: boolean
  pathGlob: string
}

export const run = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<void> => {
  // Find all matching coverage files
  const filePatterns = inputs.files
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  core.info(`Looking for coverage files matching: ${filePatterns.join(', ')}`)

  const matchedFiles = await glob(filePatterns, { absolute: true })

  if (matchedFiles.length === 0) {
    core.warning('No coverage files found matching the specified patterns')
    return
  }

  core.info(`Found ${matchedFiles.length} coverage file(s)`)

  // Parse all coverage files
  const parser = new CoberturaCoverageParser()
  const reports: CoverageReport[] = []

  for (const file of matchedFiles) {
    core.info(`Parsing: ${file}`)
    const content = await fs.readFile(file, 'utf-8')
    const report = await parser.parse(content)
    reports.push(report)
  }

  // Merge all reports into one
  const mergedReport = mergeReports(reports)

  // Collect all unique file paths from the report
  const filePaths = new Set<string>()
  for (const pkg of mergedReport.packages) {
    for (const file of pkg.files) {
      filePaths.add(file.filename)
    }
  }

  // Read file contents from disk
  const fileContents = await readFileContents([...filePaths])

  // Generate markdown
  const markdown = generateMarkdown(mergedReport, fileContents)

  // Calculate overall metrics for outputs
  const overallMetrics = calculateOverallMetrics(mergedReport)

  core.setOutput('line-coverage', overallMetrics.lineCoverage.toFixed(2))
  core.setOutput('branch-coverage', overallMetrics.branchCoverage.toFixed(2))
  core.setOutput('function-coverage', overallMetrics.functionCoverage.toFixed(2))

  // Find the pull request
  const pullNumber = await findPullRequestNumber(octokit, context)

  if (!pullNumber) {
    core.info('No pull request found for this commit, writing to step summary instead')
    await core.summary.addRaw(markdown).write()
    return
  }

  // Post or update comment
  await postComment(octokit, context, pullNumber, markdown, inputs.updateComment)

  core.info('Coverage visualization posted successfully')
}

/**
 * Merge multiple coverage reports into one.
 */
function mergeReports(reports: CoverageReport[]): CoverageReport {
  const packageMap = new Map<string, CoverageReport['packages'][0]>()

  for (const report of reports) {
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

  return { packages: Array.from(packageMap.values()) }
}

/**
 * Calculate overall coverage metrics from a merged report.
 */
function calculateOverallMetrics(report: CoverageReport): {
  lineCoverage: number
  branchCoverage: number
  functionCoverage: number
} {
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
 * Find the pull request number associated with the current context.
 */
async function findPullRequestNumber(octokit: Octokit, context: Context): Promise<number | null> {
  // Check if we're already in a pull_request event
  if ('pull_request' in context.payload) {
    const prPayload = context.payload as { pull_request?: { number: number } }
    if (prPayload.pull_request?.number) {
      return prPayload.pull_request.number
    }
  }

  // Otherwise, find PRs associated with this commit
  const { data: pulls } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    owner: context.repo.owner,
    repo: context.repo.repo,
    commit_sha: context.sha,
  })

  return pulls[0]?.number ?? null
}

/**
 * Read file contents from disk for a list of file paths.
 * Returns a map of filepath -> lines array.
 * Files that don't exist return empty arrays.
 */
async function readFileContents(filepaths: string[]): Promise<Map<string, string[]>> {
  const contents = new Map<string, string[]>()

  for (const filepath of filepaths) {
    try {
      const content = await fs.readFile(filepath, 'utf-8')
      contents.set(filepath, content.split('\n'))
    } catch {
      // File doesn't exist or can't be read - use empty array
      contents.set(filepath, [])
    }
  }

  return contents
}

const COMMENT_MARKER = '<!-- pr-code-coverage-visualizer -->'

/**
 * Post or update a comment on the pull request.
 */
async function postComment(
  octokit: Octokit,
  context: Context,
  pullNumber: number,
  markdown: string,
  updateExisting: boolean,
): Promise<void> {
  const body = `${COMMENT_MARKER}\n${markdown}`

  if (updateExisting) {
    // Try to find existing comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pullNumber,
    })

    const existingComment = comments.find((comment) => comment.body?.includes(COMMENT_MARKER))

    if (existingComment) {
      await octokit.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: existingComment.id,
        body,
      })
      core.info(`Updated existing comment: ${existingComment.html_url}`)
      return
    }
  }

  // Create new comment
  const { data: comment } = await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pullNumber,
    body,
  })

  core.info(`Created new comment: ${comment.html_url}`)
}
