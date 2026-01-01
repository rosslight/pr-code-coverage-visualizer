import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import { processCoverage, type Logger } from './core/index.js'
import { findPullRequestNumber, getBaseRef, postComment, type Context } from './github.js'

export type Inputs = {
  files: string
  updateComment: boolean
  showChangedLinesOnly: boolean
  showGlobOnly: string
  sourceDir: string
}

/**
 * Logger implementation that uses @actions/core for GitHub Actions.
 */
const actionLogger: Logger = {
  info: (message) => core.info(message),
  warning: (message) => core.warning(message),
}

export const run = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<void> => {
  // Get the base ref from GitHub context
  const baseRef = getBaseRef(context) ?? undefined

  // Process coverage using the core module
  const result = await processCoverage(
    {
      files: inputs.files,
      sourceDir: inputs.sourceDir,
      showChangedLinesOnly: inputs.showChangedLinesOnly,
      showGlobOnly: inputs.showGlobOnly,
      baseRef,
    },
    actionLogger,
  )

  if (!result) {
    return
  }

  const { markdown, metrics } = result

  // Set GitHub Actions outputs
  core.setOutput('line-coverage', metrics.lineCoverage.toFixed(2))
  core.setOutput('branch-coverage', metrics.branchCoverage.toFixed(2))
  core.setOutput('function-coverage', metrics.functionCoverage.toFixed(2))

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
