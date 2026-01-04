import * as core from '@actions/core'
import { run } from './action.js'
import { getContext, getOctokit } from './github.js'

try {
  await run(
    {
      files: core.getInput('files', { required: true }),
      updateComment: core.getBooleanInput('update-comment'),
      showChangedLinesOnly: core.getBooleanInput('show-changed-lines-only'),
      globPattern: core.getInput('show-glob-only') || '**',
      sourceDir: core.getInput('source') || process.env['GITHUB_WORKSPACE'] || process.cwd(),
    },
    getOctokit(),
    await getContext(),
  )
} catch (e) {
  core.setFailed(e instanceof Error ? e : String(e))
  console.error(e)
}
