import type { Octokit } from '@octokit/action'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Inputs, run } from '../src/action.js'
import type { Context } from '../src/github.js'

const mocks = vi.hoisted(() => ({
  processCoverage: vi.fn(),
  findPullRequestNumber: vi.fn(),
  getComparisonShas: vi.fn(),
  postComment: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  setOutput: vi.fn(),
  summaryAddRaw: vi.fn(),
  summaryWrite: vi.fn(),
}))

vi.mock('@actions/core', () => ({
  info: mocks.info,
  warning: mocks.warning,
  debug: mocks.debug,
  setOutput: mocks.setOutput,
  summary: {
    addRaw: mocks.summaryAddRaw,
  },
}))

vi.mock('../src/core/index.js', () => ({
  processCoverage: mocks.processCoverage,
}))

vi.mock('../src/github.js', () => ({
  findPullRequestNumber: mocks.findPullRequestNumber,
  getComparisonShas: mocks.getComparisonShas,
  postComment: mocks.postComment,
}))

const inputs: Inputs = {
  files: 'coverage.xml',
  updateComment: true,
  showChangedLinesOnly: true,
  excludeFilesPattern: '',
  sourceDir: '/repo',
}

const context = {
  repo: {
    owner: 'owner',
    repo: 'repo',
  },
  sha: 'head-sha',
  payload: {
    pull_request: {
      number: 123,
      state: 'open',
    },
  },
} as unknown as Context

const octokit = {} as Octokit

describe('run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.summaryWrite.mockResolvedValue(undefined)
    mocks.summaryAddRaw.mockReturnValue({ write: mocks.summaryWrite })
    mocks.getComparisonShas.mockReturnValue({ baseSha: 'base-sha', headSha: 'head-sha' })
    mocks.processCoverage.mockResolvedValue({
      markdown: 'coverage markdown',
      lineCoverage: 0.75,
      branchCoverage: 0.5,
      lineCoveragePr: 0.8,
      branchCoveragePr: undefined,
    })
  })

  it('posts a PR comment when comment posting succeeds', async () => {
    mocks.findPullRequestNumber.mockResolvedValue(123)
    mocks.postComment.mockResolvedValue({
      url: 'https://github.com/owner/repo/pull/123#issuecomment-1',
      updated: false,
    })

    await run(inputs, octokit, context)

    expect(mocks.postComment).toHaveBeenCalledWith(octokit, context, 123, 'coverage markdown', true)
    expect(mocks.summaryAddRaw).not.toHaveBeenCalled()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.info).toHaveBeenCalledWith(
      'Created new comment: https://github.com/owner/repo/pull/123#issuecomment-1',
    )
    expect(mocks.info).toHaveBeenCalledWith('Coverage visualization posted successfully')
  })

  it('falls back to the step summary when comment posting fails', async () => {
    const error = Object.assign(new Error('Resource not accessible by integration'), { status: 403 })
    mocks.findPullRequestNumber.mockResolvedValue(123)
    mocks.postComment.mockRejectedValue(error)

    await expect(run(inputs, octokit, context)).resolves.toBeUndefined()

    expect(mocks.warning).toHaveBeenCalledWith(
      'Failed to post or update PR comment (status 403: Resource not accessible by integration). Falling back to the step summary instead.',
    )
    expect(mocks.summaryAddRaw).toHaveBeenCalledWith('coverage markdown')
    expect(mocks.summaryWrite).toHaveBeenCalledTimes(1)
    expect(mocks.info).toHaveBeenCalledWith('Coverage visualization written to step summary')
  })

  it('writes to the step summary when no PR is found', async () => {
    mocks.findPullRequestNumber.mockResolvedValue(null)

    await run(inputs, octokit, context)

    expect(mocks.postComment).not.toHaveBeenCalled()
    expect(mocks.summaryAddRaw).toHaveBeenCalledWith('coverage markdown')
    expect(mocks.summaryWrite).toHaveBeenCalledTimes(1)
    expect(mocks.info).toHaveBeenCalledWith('No pull request found for this commit, writing to step summary instead')
  })
})
