import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import { Octokit } from '@octokit/action'
import { retry } from '@octokit/plugin-retry'
import type { WebhookEvent } from '@octokit/webhooks-types'

export const getOctokit = () => new (Octokit.plugin(retry))()

export type Context = {
  repo: {
    owner: string
    repo: string
  }
  sha: string
  payload: WebhookEvent
}

export const getContext = async (): Promise<Context> => {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  return {
    repo: getRepo(),
    sha: getEnv('GITHUB_SHA'),
    payload: JSON.parse(await fs.readFile(getEnv('GITHUB_EVENT_PATH'), 'utf-8')) as WebhookEvent,
  }
}

const getRepo = () => {
  const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/')
  assert(owner, 'GITHUB_REPOSITORY must have an owner part')
  assert(repo, 'GITHUB_REPOSITORY must have a repo part')
  return { owner, repo }
}

const getEnv = (name: string): string => {
  assert(process.env[name], `${name} is required`)
  return process.env[name]
}

/**
 * Find the pull request number associated with the current context.
 */
export async function findPullRequestNumber(octokit: Octokit, context: Context): Promise<number | null> {
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
 * Get the base and head commit SHAs for comparison from the context.
 * For pull_request events, these come from the PR payload.
 */
export function getComparisonShas(context: Context): { baseSha: string; headSha: string } | null {
  if ('pull_request' in context.payload) {
    const prPayload = context.payload as {
      pull_request?: {
        base?: { sha?: string }
        head?: { sha?: string }
      }
    }
    if (prPayload.pull_request?.base?.sha !== undefined && prPayload.pull_request?.head?.sha !== undefined) {
      return { baseSha: prPayload.pull_request.base.sha, headSha: prPayload.pull_request.head.sha }
    }
  }

  return null
}

const COMMENT_MARKER = '<!-- pr-code-coverage-visualizer -->'

/**
 * Post or update a comment on the pull request.
 */
export async function postComment(
  octokit: Octokit,
  context: Context,
  pullNumber: number,
  markdown: string,
  updateExisting: boolean,
): Promise<{ url: string; updated: boolean }> {
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
      return { url: existingComment.html_url ?? '', updated: true }
    }
  }

  // Create new comment
  const { data: comment } = await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pullNumber,
    body,
  })

  return { url: comment.html_url ?? '', updated: false }
}
