import { describe, expect, it } from 'vitest'
import type { CoverageReport } from '../../src/coverage/model.js'
import { generateMarkdown } from '../../src/markdown/index.js'

type FakeFileInfo = {
  filename: string
  numberOfLines: number
}

/**
 * Generate fake file contents for a coverage report.
 * Creates mock lines based on the maximum line number in each file.
 */
function createFakeFileContents(fileInfos: FakeFileInfo[]): Map<string, string[]> {
  const contents = new Map<string, string[]>()

  for (const fileInfo of fileInfos) {
    const lines = Array.from({ length: fileInfo.numberOfLines }, (_, i) => {
      return `some content in line ${i + 1}`
    })
    contents.set(fileInfo.filename, lines)
  }

  return contents
}

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

    const markdown = generateMarkdown(
      report,
      createFakeFileContents([{ filename: 'src/example.ts', numberOfLines: 10 }]),
    )

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

    const markdown = generateMarkdown(
      report,
      createFakeFileContents([
        { filename: 'src/core/utils.cs', numberOfLines: 15 },
        { filename: 'tests/test_utils.cs', numberOfLines: 10 },
      ]),
    )

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

    const markdown = generateMarkdown(
      report,
      createFakeFileContents([{ filename: 'src/gaps.rs', numberOfLines: 50 }]),
    )

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

    const markdown = generateMarkdown(report, createFakeFileContents([]))

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

    const markdown = generateMarkdown(
      report,
      createFakeFileContents([
        { filename: 'src/file1.py', numberOfLines: 3 },
        { filename: 'src/file2.py', numberOfLines: 3 },
      ]),
    )

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

    const markdown = generateMarkdown(
      report,
      createFakeFileContents([
        { filename: 'test.cs', numberOfLines: 1 },
        { filename: 'test.rs', numberOfLines: 2 },
        { filename: 'test.tsx', numberOfLines: 3 },
      ]),
    )

    expect(markdown).toContain('```csharp')
    expect(markdown).toContain('```rust')
    expect(markdown).toContain('```typescript')
  })

  describe('ellipsis handling', () => {
    it('prepends ellipsis when file has content before first shown line', async () => {
      const report: CoverageReport = {
        packages: [
          {
            name: 'TestPackage',
            files: [
              {
                filename: 'src/test.ts',
                // Coverage starts at line 5, but file has lines 1-10
                lines: [
                  { lineNumber: 5, state: 'not-covered' },
                  { lineNumber: 6, state: 'covered' },
                ],
                lineMetrics: { covered: 1, total: 2 },
              },
            ],
          },
        ],
      }

      const markdown = generateMarkdown(
        report,
        createFakeFileContents([{ filename: 'src/test.ts', numberOfLines: 10 }]),
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/ellipsis-leading.snap.md')
    })

    it('appends ellipsis when file has content after last shown line', async () => {
      const report: CoverageReport = {
        packages: [
          {
            name: 'TestPackage',
            files: [
              {
                filename: 'src/test.ts',
                // Coverage ends at line 3, but file has 10 lines
                lines: [
                  { lineNumber: 1, state: 'covered' },
                  { lineNumber: 2, state: 'not-covered' },
                  { lineNumber: 3, state: 'covered' },
                ],
                lineMetrics: { covered: 2, total: 3 },
              },
            ],
          },
        ],
      }

      const markdown = generateMarkdown(
        report,
        createFakeFileContents([{ filename: 'src/test.ts', numberOfLines: 10 }]),
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/ellipsis-trailing.snap.md')
    })

    it('shows actual line instead of ellipsis for 1-line gap', async () => {
      const report: CoverageReport = {
        packages: [
          {
            name: 'TestPackage',
            files: [
              {
                filename: 'src/test.ts',
                // Lines 2 and 4 are uncovered, line 3 is covered (1-line gap)
                lines: [
                  { lineNumber: 1, state: 'covered' },
                  { lineNumber: 2, state: 'not-covered' },
                  { lineNumber: 3, state: 'covered' },
                  { lineNumber: 4, state: 'not-covered' },
                  { lineNumber: 5, state: 'covered' },
                ],
                lineMetrics: { covered: 3, total: 5 },
              },
            ],
          },
        ],
      }

      const fileContents = new Map([['src/test.ts', ['line 1', 'line 2', 'THE GAP LINE', 'line 4', 'line 5']]])

      const markdown = generateMarkdown(report, fileContents)

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/gap-1-line.snap.md')
    })

    it('shows single ellipsis for 2+ line gap', async () => {
      const report: CoverageReport = {
        packages: [
          {
            name: 'TestPackage',
            files: [
              {
                filename: 'src/test.ts',
                // Lines 2 and 10 are uncovered with a large gap between
                lines: [
                  { lineNumber: 1, state: 'covered' },
                  { lineNumber: 2, state: 'not-covered' },
                  { lineNumber: 3, state: 'covered' },
                  // Gap: lines 4-8 not in coverage data
                  { lineNumber: 9, state: 'covered' },
                  { lineNumber: 10, state: 'not-covered' },
                  { lineNumber: 11, state: 'covered' },
                ],
                lineMetrics: { covered: 4, total: 6 },
              },
            ],
          },
        ],
      }

      const markdown = generateMarkdown(
        report,
        createFakeFileContents([{ filename: 'src/test.ts', numberOfLines: 15 }]),
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/gap-2-plus-lines.snap.md')
    })
  })

  describe('missing file content handling', () => {
    it('renders empty content when file is not found', async () => {
      const report: CoverageReport = {
        packages: [
          {
            name: 'TestPackage',
            files: [
              {
                filename: 'src/missing.ts',
                lines: [
                  { lineNumber: 1, state: 'not-covered' },
                  { lineNumber: 2, state: 'not-covered' },
                ],
                lineMetrics: { covered: 0, total: 2 },
              },
            ],
          },
        ],
      }

      // Empty map - file not found on disk
      const fileContents = new Map<string, string[]>()

      const markdown = generateMarkdown(report, fileContents)

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/file-not-found.snap.md')
    })

    it('renders empty content when line number exceeds file length', async () => {
      const report: CoverageReport = {
        packages: [
          {
            name: 'TestPackage',
            files: [
              {
                filename: 'src/short.ts',
                // Coverage says line 100, but file only has 3 lines
                lines: [
                  { lineNumber: 99, state: 'covered' },
                  { lineNumber: 100, state: 'not-covered' },
                  { lineNumber: 101, state: 'covered' },
                ],
                lineMetrics: { covered: 2, total: 3 },
              },
            ],
          },
        ],
      }

      const fileContents = new Map([
        ['src/short.ts', ['line 1', 'line 2', 'line 3']], // Only 3 lines
      ])

      const markdown = generateMarkdown(report, fileContents)

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/line-exceeds-file-length.snap.md')
    })
  })
})
