import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { processCoverage, createCliLogger } from '../../src/core/process-coverage.js'

const FIXTURES_DIR = path.join(__dirname, '../resources/integration')

describe('processCoverage integration', () => {
  it('generates markdown for basic coverage', async () => {
    const testDir = path.join(FIXTURES_DIR, 'basic')

    const result = await processCoverage(
      {
        files: path.join(testDir, 'coverage.xml'),
        sourceDir: testDir,
        globPattern: '**/*',
      },
      createCliLogger(true),
    )

    expect(result).not.toBeNull()
    await expect(result!.markdown).toMatchFileSnapshot('./__snapshots__/basic-coverage.snap.md')
  })

  it('generates markdown for multiple packages', async () => {
    const testDir = path.join(FIXTURES_DIR, 'multiple-packages')

    const result = await processCoverage(
      {
        files: path.join(testDir, 'coverage.xml'),
        sourceDir: testDir,
        globPattern: '**/*',
      },
      createCliLogger(true),
    )

    expect(result).not.toBeNull()
    await expect(result!.markdown).toMatchFileSnapshot('./__snapshots__/multiple-packages.snap.md')
  })

  it('filters files by glob pattern', async () => {
    const testDir = path.join(FIXTURES_DIR, 'glob-filter')

    const result = await processCoverage(
      {
        files: path.join(testDir, 'coverage.xml'),
        sourceDir: testDir,
        globPattern: '**/include/**',
      },
      createCliLogger(true),
    )

    expect(result).not.toBeNull()
    expect(result!.markdown).toContain('wanted.ts')
    expect(result!.markdown).not.toContain('ignored.ts')
    await expect(result!.markdown).toMatchFileSnapshot('./__snapshots__/glob-filter.snap.md')
  })

  it('merges multiple coverage files', async () => {
    const testDir = path.join(FIXTURES_DIR, 'merge-reports')

    const result = await processCoverage(
      {
        files: `${testDir}/coverage-a.xml,${testDir}/coverage-b.xml`,
        sourceDir: testDir,
        globPattern: '**/*',
      },
      createCliLogger(true),
    )

    expect(result).not.toBeNull()
    await expect(result!.markdown).toMatchFileSnapshot('./__snapshots__/merge-reports.snap.md')
  })

  it('returns null when no files match pattern', async () => {
    const result = await processCoverage(
      {
        files: '/nonexistent/**/*.xml',
        sourceDir: '.',
        globPattern: '**/*',
      },
      createCliLogger(true),
    )

    expect(result).toBeNull()
  })
})
