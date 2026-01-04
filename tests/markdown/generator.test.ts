import { describe, expect, it } from 'vitest'
import { createCliLogger } from '../../src/core/process-coverage.js'
import type { PackageCoverage } from '../../src/coverage/model.js'
import { generateMarkdown, MINIMUM_CHARACTERS } from '../../src/markdown/index.js'

type FakeFileInfo = {
  resolvedPath: string
  numberOfLines: number
}

const logger = createCliLogger(true)

/**
 * Generate fake file contents for a coverage packages.
 * Creates mock lines keyed by resolvedPath.
 */
function createFakeFileContents(fileInfos: FakeFileInfo[]): Map<string, string[]> {
  const contents = new Map<string, string[]>()

  for (const fileInfo of fileInfos) {
    const lines = Array.from({ length: fileInfo.numberOfLines }, (_, i) => {
      return `some content in line ${i + 1}`
    })
    contents.set(fileInfo.resolvedPath, lines)
  }

  return contents
}

describe('generateMarkdown', () => {
  it('generates markdown for a simple packages', async () => {
    const packages: PackageCoverage[] = [
      {
        name: 'TestPackage',
        files: [
          {
            filename: 'src/example.ts',
            resolvedPath: '/repo/src/example.ts',
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
    ]

    const markdown = generateMarkdown(
      packages,
      createFakeFileContents([{ resolvedPath: '/repo/src/example.ts', numberOfLines: 10 }]),
      { lineCoverage: 42.24, branchCoverage: undefined },
      {},
      logger,
    )

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/simple-packages.snap.md')
  })

  it('generates markdown for multiple packages', async () => {
    const packages: PackageCoverage[] = [
      {
        name: 'Package.Core',
        files: [
          {
            filename: 'src/core/utils.cs',
            resolvedPath: '/repo/src/core/utils.cs',
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
            resolvedPath: '/repo/tests/test_utils.cs',
            lines: [
              { lineNumber: 5, state: 'not-covered' },
              { lineNumber: 6, state: 'not-covered' },
            ],
            lineMetrics: { covered: 0, total: 2 },
          },
        ],
      },
    ]

    const markdown = generateMarkdown(
      packages,
      createFakeFileContents([
        { resolvedPath: '/repo/src/core/utils.cs', numberOfLines: 15 },
        { resolvedPath: '/repo/tests/test_utils.cs', numberOfLines: 10 },
      ]),
      { lineCoverage: 42.24, branchCoverage: undefined },
      {},
      logger,
    )

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/multiple-packages.snap.md')
  })

  it('generates markdown with line gaps shown as ellipsis', async () => {
    const packages: PackageCoverage[] = [
      {
        name: 'GapsPackage',
        files: [
          {
            filename: 'src/gaps.rs',
            resolvedPath: '/repo/src/gaps.rs',
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
    ]

    const markdown = generateMarkdown(
      packages,
      createFakeFileContents([{ resolvedPath: '/repo/src/gaps.rs', numberOfLines: 50 }]),
      { lineCoverage: 42.24, branchCoverage: undefined },
      {},
      logger,
    )

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/line-gaps-ellipsis.snap.md')
    expect(markdown).toContain('...')
  })

  it('generates markdown for empty package', async () => {
    const packages: PackageCoverage[] = [
      {
        name: 'EmptyPackage',
        files: [],
      },
    ]

    const markdown = generateMarkdown(
      packages,
      createFakeFileContents([]),
      { lineCoverage: 42.24, branchCoverage: undefined },
      {},
      logger,
    )

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/empty-package.snap.md')
  })

  it('generates markdown with multiple files in same package', async () => {
    const packages: PackageCoverage[] = [
      {
        name: 'MultiFilePackage',
        files: [
          {
            filename: 'src/file1.py',
            resolvedPath: '/repo/src/file1.py',
            lines: [
              { lineNumber: 1, state: 'covered' },
              { lineNumber: 2, state: 'covered' },
            ],
            lineMetrics: { covered: 2, total: 2 },
          },
          {
            filename: 'src/file2.py',
            resolvedPath: '/repo/src/file2.py',
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
    ]

    const markdown = generateMarkdown(
      packages,
      createFakeFileContents([
        { resolvedPath: '/repo/src/file1.py', numberOfLines: 3 },
        { resolvedPath: '/repo/src/file2.py', numberOfLines: 3 },
      ]),
      { lineCoverage: 10, branchCoverage: 10 },
      {},
      logger,
    )

    await expect(markdown).toMatchFileSnapshot('./__snapshots__/multiple-files-same-package.snap.md')
  })

  it('correctly maps file extensions to syntax highlighting', () => {
    const packages: PackageCoverage[] = [
      {
        name: 'ExtensionTest',
        files: [
          {
            filename: 'test.cs',
            resolvedPath: '/repo/test.cs',
            lines: [{ lineNumber: 1, state: 'not-covered' }],
            lineMetrics: { covered: 0, total: 1 },
          },
          {
            filename: 'test.rs',
            resolvedPath: '/repo/test.rs',
            lines: [{ lineNumber: 1, state: 'not-covered' }],
            lineMetrics: { covered: 0, total: 1 },
          },
          {
            filename: 'test.tsx',
            resolvedPath: '/repo/test.tsx',
            lines: [{ lineNumber: 1, state: 'not-covered' }],
            lineMetrics: { covered: 0, total: 1 },
          },
        ],
      },
    ]

    const markdown = generateMarkdown(
      packages,
      createFakeFileContents([
        { resolvedPath: '/repo/test.cs', numberOfLines: 1 },
        { resolvedPath: '/repo/test.rs', numberOfLines: 2 },
        { resolvedPath: '/repo/test.tsx', numberOfLines: 3 },
      ]),
      { lineCoverage: 20, branchCoverage: 20 },
      {},
      logger,
    )

    expect(markdown).toContain('```csharp')
    expect(markdown).toContain('```rust')
    expect(markdown).toContain('```typescript')
  })

  describe('ellipsis handling', () => {
    it('prepends ellipsis when file has content before first shown line', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/test.ts',
              resolvedPath: '/repo/src/test.ts',
              // Coverage starts at line 5, but file has lines 1-10
              lines: [
                { lineNumber: 5, state: 'not-covered' },
                { lineNumber: 6, state: 'covered' },
              ],
              lineMetrics: { covered: 1, total: 2 },
            },
          ],
        },
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/src/test.ts', numberOfLines: 10 }]),
        { lineCoverage: 30, branchCoverage: 30 },
        {},
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/ellipsis-leading.snap.md')
    })

    it('appends ellipsis when file has content after last shown line', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/test.ts',
              resolvedPath: '/repo/src/test.ts',
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
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/src/test.ts', numberOfLines: 10 }]),
        { lineCoverage: 40, branchCoverage: 40 },
        {},
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/ellipsis-trailing.snap.md')
    })

    it('shows actual line instead of ellipsis for 1-line gap', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/test.ts',
              resolvedPath: '/repo/src/test.ts',
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
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/src/test.ts', numberOfLines: 5 }]),
        { lineCoverage: 50, branchCoverage: 50 },
        {},
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/gap-1-line.snap.md')
    })

    it('shows single ellipsis for 2+ line gap', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/test.ts',
              resolvedPath: '/repo/src/test.ts',
              // Lines 2 and 10 are uncovered with a large gap between
              lines: [
                { lineNumber: 1, state: 'covered' },
                { lineNumber: 2, state: 'not-covered' },
                { lineNumber: 3, state: 'covered' },
                // Gap: lines 4-5 not in coverage data
                { lineNumber: 6, state: 'covered' },
                { lineNumber: 7, state: 'not-covered' },
                { lineNumber: 8, state: 'covered' },
              ],
              lineMetrics: { covered: 4, total: 6 },
            },
          ],
        },
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/src/test.ts', numberOfLines: 15 }]),
        { lineCoverage: 60, branchCoverage: 60 },
        {},
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/gap-2-plus-lines.snap.md')
    })

    it('shows actual line 1 instead of leading ellipsis when only 1 line hidden at start', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/test.ts',
              resolvedPath: '/repo/src/test.ts',
              // Uncovered line is at 3, so with surrounding=1, lines 2-4 would be shown
              // Only line 1 is hidden - should show it instead of ellipsis
              lines: [
                { lineNumber: 2, state: 'covered' },
                { lineNumber: 3, state: 'not-covered' },
                { lineNumber: 4, state: 'covered' },
              ],
              lineMetrics: { covered: 3, total: 4 },
            },
          ],
        },
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/src/test.ts', numberOfLines: 6 }]),
        { lineCoverage: 70, branchCoverage: 70 },
        {},
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/ellipsis-leading-1-line.snap.md')
    })

    it('shows actual last line instead of trailing ellipsis when only 1 line hidden at end', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/test.ts',
              resolvedPath: '/repo/src/test.ts',
              // Last shown line is 4, file has 5 lines, so only line 5 is hidden
              lines: [
                { lineNumber: 1, state: 'covered' },
                { lineNumber: 2, state: 'covered' },
                { lineNumber: 3, state: 'not-covered' },
                { lineNumber: 4, state: 'covered' },
              ],
              lineMetrics: { covered: 4, total: 5 },
            },
          ],
        },
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/src/test.ts', numberOfLines: 5 }]),
        { lineCoverage: 80, branchCoverage: 80 },
        {},
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/ellipsis-trailing-1-line.snap.md')
    })
  })

  describe('missing file content handling', () => {
    it('renders empty content when file is not found', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/missing.ts',
              resolvedPath: '/repo/src/missing.ts',
              lines: [
                { lineNumber: 1, state: 'not-covered' },
                { lineNumber: 2, state: 'not-covered' },
              ],
              lineMetrics: { covered: 0, total: 2 },
            },
          ],
        },
      ]

      // Empty map - file not found on disk
      const fileContents = new Map<string, string[]>()

      const markdown = generateMarkdown(packages, fileContents, { lineCoverage: 42.24, branchCoverage: 50 }, {}, logger)

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/file-not-found.snap.md')
    })

    it('renders empty content when line number exceeds file length', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'TestPackage',
          files: [
            {
              filename: 'src/short.ts',
              resolvedPath: '/repo/src/short.ts',
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
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/src/short.ts', numberOfLines: 3 }]),
        { lineCoverage: 90, branchCoverage: 90 },
        {},
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/line-exceeds-file-length.snap.md')
    })
  })

  describe('character limit and truncation', () => {
    it('throws error when maxCharacters is below minimum', () => {
      const packages: PackageCoverage[] = [
        {
          name: 'Pkg',
          files: [
            {
              filename: 'a.ts',
              resolvedPath: '/repo/a.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ]

      expect(() =>
        generateMarkdown(
          packages,
          createFakeFileContents([{ resolvedPath: '/repo/a.ts', numberOfLines: 1 }]),
          { lineCoverage: 100, branchCoverage: 100 },
          {
            maxCharacters: 100,
          },
          logger,
        ),
      ).toThrow(`maxCharacters must be at least ${MINIMUM_CHARACTERS}`)
    })

    it('does not truncate when content fits within limit', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'SmallPkg',
          files: [
            {
              filename: 'small.ts',
              resolvedPath: '/repo/small.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/small.ts', numberOfLines: 2 }]),
        { lineCoverage: 42.24, branchCoverage: 50 },
        {
          maxCharacters: 2000,
        },
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/truncation-none.snap.md')
      expect(markdown).not.toContain('not shown due to size limit')
    })

    it('truncates files from end when limit exceeded', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'MultiFilePkg',
          files: [
            {
              filename: 'file1.ts',
              resolvedPath: '/repo/file1.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
            {
              filename: 'file2.ts',
              resolvedPath: '/repo/file2.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
            {
              filename: 'file3.ts',
              resolvedPath: '/repo/file3.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([
          { resolvedPath: '/repo/file1.ts', numberOfLines: 2 },
          { resolvedPath: '/repo/file2.ts', numberOfLines: 2 },
          { resolvedPath: '/repo/file3.ts', numberOfLines: 2 },
        ]),
        { lineCoverage: 42.24, branchCoverage: 50 },
        { maxCharacters: 1000 },
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/truncation-files.snap.md')
      expect(markdown).toContain('file(s)')
      expect(markdown).toContain('not shown due to size limit')
    })

    it('truncates entire packages from end when limit exceeded', async () => {
      const packages: PackageCoverage[] = [
        {
          name: 'Pkg1',
          files: [
            {
              filename: 'pkg1/a.ts',
              resolvedPath: '/repo/pkg1/a.ts',
              lines: [
                { lineNumber: 1, state: 'not-covered' },
                { lineNumber: 4, state: 'not-covered' },
              ],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
        {
          name: 'Pkg2',
          files: [
            {
              filename: 'pkg2/b.ts',
              resolvedPath: '/repo/pkg2/b.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
        {
          name: 'Pkg3',
          files: [
            {
              filename: 'pkg3/c.ts',
              resolvedPath: '/repo/pkg3/c.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([
          { resolvedPath: '/repo/pkg1/a.ts', numberOfLines: 5 },
          { resolvedPath: '/repo/pkg2/b.ts', numberOfLines: 2 },
          { resolvedPath: '/repo/pkg3/c.ts', numberOfLines: 2 },
        ]),
        { lineCoverage: 42.24, branchCoverage: 50 },
        { maxCharacters: 900 },
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/truncation-packages.snap.md')
      expect(markdown).toContain('package(s)')
      expect(markdown).toContain('not shown due to size limit')
    })

    it('shows minimal output with badges and legend when severely limited', async () => {
      // Create multiple files to force truncation at minimum limit
      const packages: PackageCoverage[] = [
        {
          name: 'LargePkg',
          files: [
            {
              filename: 'file1.ts',
              resolvedPath: '/repo/file1.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
            {
              filename: 'file2.ts',
              resolvedPath: '/repo/file2.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
            {
              filename: 'file3.ts',
              resolvedPath: '/repo/file3.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
            {
              filename: 'file4.ts',
              resolvedPath: '/repo/file4.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ]

      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([
          { resolvedPath: '/repo/file1.ts', numberOfLines: 2 },
          { resolvedPath: '/repo/file2.ts', numberOfLines: 2 },
          { resolvedPath: '/repo/file3.ts', numberOfLines: 2 },
          { resolvedPath: '/repo/file4.ts', numberOfLines: 2 },
        ]),
        { lineCoverage: 42.24, branchCoverage: 50 },
        { maxCharacters: 1000 },
        logger,
      )

      await expect(markdown).toMatchFileSnapshot('./__snapshots__/truncation-minimal.snap.md')
      // Should always have badges and legend
      expect(markdown).toContain('img.shields.io')
      expect(markdown).toContain('uncovered')
      // Should show truncation notice
      expect(markdown).toContain('not shown due to size limit')
    })

    it('uses default maxCharacters of 65536 when not specified', () => {
      const packages: PackageCoverage[] = [
        {
          name: 'Pkg',
          files: [
            {
              filename: 'test.ts',
              resolvedPath: '/repo/test.ts',
              lines: [{ lineNumber: 1, state: 'not-covered' }],
              lineMetrics: { covered: 0, total: 1 },
            },
          ],
        },
      ]

      // Should not throw and should not truncate small content
      const markdown = generateMarkdown(
        packages,
        createFakeFileContents([{ resolvedPath: '/repo/test.ts', numberOfLines: 2 }]),
        { lineCoverage: 42.24, branchCoverage: 50 },
        {},
        logger,
      )

      expect(markdown).not.toContain('not shown due to size limit')
      expect(markdown.length).toBeLessThan(65536)
    })
  })
})
