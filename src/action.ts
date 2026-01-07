import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import { type Logger, processCoverage } from './core/index.js'
import { type Context, findPullRequestNumber, getComparisonShas, postComment } from './github.js'

export type Inputs = {
  files: string
  updateComment: boolean
  showChangedLinesOnly: boolean
  excludeFilesPattern: string
  sourceDir: string
}

/**
 * Logger implementation that uses @actions/core for GitHub Actions.
 */
const actionLogger: Logger = {
  info: (message) => core.info(message),
  warning: (message) => core.warning(message),
  debug: (message) => core.debug(message),
}

export const run = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<void> => {
  const shas = getComparisonShas(context)

  const excludePatterns = inputs.excludeFilesPattern
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const filePatterns = inputs.files
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  // Process coverage using the core module
  const result = await processCoverage(
    {
      filePatterns,
      sourceDir: inputs.sourceDir,
      excludePatterns,
      baseSha: shas?.baseSha,
      headSha: shas?.headSha,
      maxCharacters: 65536,
      numberOfSurroundingLines: 1,
    },
    actionLogger,
  )

  if (!result) {
    return
  }

  const { markdown, lineCoverage, branchCoverage, lineCoveragePr, branchCoveragePr } = result

  // Set GitHub Actions outputs
  core.setOutput('line-coverage', lineCoverage.toFixed(2))
  core.setOutput('branch-coverage', branchCoverage?.toFixed(2))
  core.setOutput('pr-line-coverage', lineCoveragePr.toFixed(2))
  core.setOutput('pr-branch-coverage', branchCoveragePr?.toFixed(2))

  // Find the pull request (needed for posting)
  const pullNumber = await findPullRequestNumber(octokit, context)

  if (!pullNumber) {
    core.info('No pull request found for this commit, writing to step summary instead')
    await core.summary.addRaw(markdown).write()
    return
  }

  // Post or update comment
  const { url, updated } = await postComment(octokit, context, pullNumber, markdown, inputs.updateComment)

  if (updated) {
    core.info(`Updated existing comment: ${url}`)
  } else {
    core.info(`Created new comment: ${url}`)
  }

  core.info('Coverage visualization posted successfully')
}
