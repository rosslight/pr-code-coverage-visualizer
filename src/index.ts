import * as core from '@actions/core'
import { getContext, getOctokit } from './github.js'
import { run } from './run.js'

try {
  await run(
    {
      files: core.getInput('files', { required: true }),
      updateComment: core.getBooleanInput('update-comment'),
      pathGlob: core.getInput('path-glob'),
    },
    getOctokit(),
    await getContext(),
  )
} catch (e) {
  core.setFailed(e instanceof Error ? e : String(e))
  console.error(e)
}
