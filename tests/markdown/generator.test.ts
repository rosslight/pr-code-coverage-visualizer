import { describe, expect, it } from 'vitest'
import type { CoverageReport } from '../../src/coverage/model.js'
import { generateMarkdown } from '../../src/markdown/index.js'

describe('generateMarkdown', () => {
  it('generates markdown for a simple report', async () => {
    const report: CoverageReport = {
      packages: [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/example.ts',
              lines: [
                { lineNumber: 1, state: 'covered' },
                { lineNumber: 2, state: 'covered' },
                { lineNumber: 3, state: 'not-covered' },
                { lineNumber: 4, state: 'partial' },
              ],
              lineMetrics: { covered: 3, total: 4 },
              branchMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ],
    }

    const markdown = generateMarkdown(report)

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/simple-report.snap.md')
  })

  it('generates markdown for multiple packages', async () => {
    const report: CoverageReport = {
      packages: [
        {
          name: 'Package.Core',
          files: [
            {
              filename: 'src/core/utils.cs',
              lines: [
                { lineNumber: 10, state: 'covered' },
                { lineNumber: 11, state: 'covered' },
                { lineNumber: 12, state: 'covered' },
              ],
              lineMetrics: { covered: 3, total: 3 },
            },
          ],
        },
        {
          name: 'Package.Tests',
          files: [
            {
              filename: 'tests/test_utils.cs',
              lines: [
                { lineNumber: 5, state: 'not-covered' },
                { lineNumber: 6, state: 'not-covered' },
              ],
              lineMetrics: { covered: 0, total: 2 },
            },
          ],
        },
      ],
    }

    const markdown = generateMarkdown(report)

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/multiple-packages.snap.md')
  })

  it('generates markdown with line gaps shown as ellipsis', async () => {
    const report: CoverageReport = {
      packages: [
        {
          name: 'GapsPackage',
          files: [
            {
              filename: 'src/gaps.rs',
              lines: [
                { lineNumber: 1, state: 'covered' },
                { lineNumber: 2, state: 'covered' },
                // Gap here
                { lineNumber: 10, state: 'not-covered' },
                { lineNumber: 11, state: 'not-covered' },
                // Another gap
                { lineNumber: 50, state: 'partial' },
              ],
              lineMetrics: { covered: 2, total: 5 },
              branchMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ],
    }

    const markdown = generateMarkdown(report)

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/line-gaps-ellipsis.snap.md')
    expect(markdown).toContain('...')
  })

  it('generates markdown for empty package', async () => {
    const report: CoverageReport = {
      packages: [
        {
          name: 'EmptyPackage',
          files: [],
        },
      ],
    }

    const markdown = generateMarkdown(report)

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/empty-package.snap.md')
  })

  it('generates markdown with multiple files in same package', async () => {
    const report: CoverageReport = {
      packages: [
        {
          name: 'MultiFilePackage',
          files: [
            {
              filename: 'src/file1.py',
              lines: [
                { lineNumber: 1, state: 'covered' },
                { lineNumber: 2, state: 'covered' },
              ],
              lineMetrics: { covered: 2, total: 2 },
            },
            {
              filename: 'src/file2.py',
              lines: [
                { lineNumber: 1, state: 'not-covered' },
                { lineNumber: 2, state: 'not-covered' },
                { lineNumber: 3, state: 'partial' },
              ],
              lineMetrics: { covered: 1, total: 3 },
              branchMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ],
    }

    const markdown = generateMarkdown(report)

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/multiple-files-same-package.snap.md')
  })

  it('correctly maps file extensions to syntax highlighting', () => {
    const report: CoverageReport = {
      packages: [
        {
          name: 'ExtensionTest',
          files: [
            {
              filename: 'test.cs',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
            {
              filename: 'test.rs',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
            {
              filename: 'test.tsx',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ],
    }

    const markdown = generateMarkdown(report)

    expect(markdown).toContain('```csharp')
    expect(markdown).toContain('```rust')
    expect(markdown).toContain('```typescript')
  })
})
