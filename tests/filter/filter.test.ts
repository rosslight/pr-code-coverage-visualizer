import assert from 'node:assert'
import { describe, expect, it } from 'vitest'
import { createCliLogger, type Logger } from '../../src/core/process-coverage.js'
import type { PackageCoverage } from '../../src/coverage/model.js'
import { filterByChangedLines, filterByGlob } from '../../src/filter/index.js'
import type { ChangedLinesMap } from '../../src/filter/model.js'

/** Mock logger that does nothing */
const mockLogger: Logger = createCliLogger(true)

describe('filterByGlob', () => {
  const sampleReport: PackageCoverage[] = [
    {
      name: 'Package1',
      files: [
        {
          filename: 'src/utils/helper.ts',
          resolvedPath: '/repo/src/utils/helper.ts',
          lines: [
            { lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 },
            { lineNumber: 2, covered: false, branchesCovered: 0, totalBranches: 0 },
          ],
          coverage: {
            linesCovered: 1,
            totalLines: 2,
            branchesCovered: 0,
            totalBranches: 0,
            lineCoverage: 0.5,
            branchCoverage: undefined,
          },
        },
        {
          filename: 'src/components/Button.tsx',
          resolvedPath: '/repo/src/components/Button.tsx',
          lines: [
            { lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 },
            { lineNumber: 2, covered: true, branchesCovered: 0, totalBranches: 0 },
          ],
          coverage: {
            linesCovered: 2,
            totalLines: 2,
            branchesCovered: 0,
            totalBranches: 0,
            lineCoverage: 1,
            branchCoverage: undefined,
          },
        },
        {
          filename: 'tests/helper.test.ts',
          resolvedPath: '/repo/tests/helper.test.ts',
          lines: [{ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 }],
          coverage: {
            linesCovered: 1,
            totalLines: 1,
            branchesCovered: 0,
            totalBranches: 0,
            lineCoverage: 1,
            branchCoverage: undefined,
          },
        },
      ],
      coverage: {
        linesCovered: 4,
        totalLines: 5,
        branchesCovered: 0,
        totalBranches: 0,
        lineCoverage: 4 / 5,
        branchCoverage: undefined,
      },
    },
    {
      name: 'Package2',
      files: [
        {
          filename: 'lib/index.js',
          resolvedPath: '/repo/lib/index.js',
          lines: [{ lineNumber: 1, covered: false, branchesCovered: 0, totalBranches: 0 }],
          coverage: {
            linesCovered: 0,
            totalLines: 1,
            branchesCovered: 0,
            totalBranches: 0,
            lineCoverage: 0,
            branchCoverage: undefined,
          },
        },
      ],
      coverage: {
        linesCovered: 0,
        totalLines: 1,
        branchesCovered: 0,
        totalBranches: 0,
        lineCoverage: 0,
        branchCoverage: undefined,
      },
    },
  ]

  it('matches all files with ** pattern', () => {
    const result = filterByGlob(sampleReport, '**', mockLogger)
    expect(result).toHaveLength(2)
    expect(result[0]?.files).toHaveLength(3)
    expect(result[1]?.files).toHaveLength(1)
  })

  it('filters files by directory pattern', () => {
    const result = filterByGlob(sampleReport, '**/src/**', mockLogger)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Package1')
    expect(result[0]?.files).toHaveLength(2)
  })

  it('filters files by extension pattern', () => {
    const result = filterByGlob(sampleReport, '**/*.tsx', mockLogger)
    expect(result).toHaveLength(1)
    expect(result[0]?.files).toHaveLength(1)
    expect(result[0]?.files[0]?.filename).toBe('src/components/Button.tsx')
  })

  it('removes empty packages after filtering', () => {
    const result = filterByGlob(sampleReport, '**/lib/**', mockLogger)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Package2')
  })

  it('returns empty packages array when nothing matches', () => {
    const result = filterByGlob(sampleReport, 'nonexistent/**', mockLogger)
    expect(result).toHaveLength(0)
  })

  it('supports specific file matching', () => {
    const result = filterByGlob(sampleReport, '**/helper.ts', mockLogger)
    expect(result).toHaveLength(1)
    expect(result[0]?.files).toHaveLength(1)
    expect(result[0]?.files[0]?.filename).toBe('src/utils/helper.ts')
  })
})

describe('filterByChangedLines', () => {
  const sampleReport: PackageCoverage[] = [
    {
      name: 'Package1',
      files: [
        {
          filename: 'src/file1.ts',
          resolvedPath: '/repo/src/file1.ts',
          lines: [
            { lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 },
            { lineNumber: 2, covered: false, branchesCovered: 0, totalBranches: 0 },
            { lineNumber: 3, covered: true, branchesCovered: 0, totalBranches: 0 },
            { lineNumber: 4, covered: true, branchesCovered: 1, totalBranches: 2 },
            { lineNumber: 5, covered: true, branchesCovered: 0, totalBranches: 0 },
          ],
          coverage: {
            linesCovered: 4,
            totalLines: 5,
            branchesCovered: 1,
            totalBranches: 2,
            lineCoverage: 0.8,
            branchCoverage: 0.5,
          },
        },
        {
          filename: 'src/file2.ts',
          resolvedPath: '/repo/src/file2.ts',
          lines: [
            { lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 },
            { lineNumber: 2, covered: true, branchesCovered: 0, totalBranches: 0 },
          ],
          coverage: {
            linesCovered: 2,
            totalLines: 2,
            branchesCovered: 0,
            totalBranches: 0,
            lineCoverage: 1,
            branchCoverage: undefined,
          },
        },
      ],
      coverage: {
        linesCovered: 6,
        totalLines: 7,
        branchesCovered: 1,
        totalBranches: 2,
        lineCoverage: 6 / 7,
        branchCoverage: 0.5,
      },
    },
  ]

  it('filters lines to only those that were changed', () => {
    const changedLines: ChangedLinesMap = new Map([['/repo/src/file1.ts', new Set([2, 4])]])

    const result = filterByChangedLines(sampleReport, changedLines, mockLogger)

    expect(result).toHaveLength(1)
    expect(result[0]?.files).toHaveLength(1)

    const file = result[0]?.files[0]
    assert(file)
    expect(file.filename).toBe('src/file1.ts')
    expect(file.lines).toHaveLength(2)
    expect(file.lines.map((l) => l.lineNumber)).toEqual([2, 4])
  })

  it('recalculates line metrics based on filtered lines', () => {
    const changedLines: ChangedLinesMap = new Map([['/repo/src/file1.ts', new Set([1, 2, 3])]])

    const result = filterByChangedLines(sampleReport, changedLines, mockLogger)

    const file = result[0]?.files[0]
    assert(file)
    expect(file.coverage.linesCovered).toBe(2) // lines 1 and 3 are covered
    expect(file.coverage.totalLines).toBe(3) // 3 lines total
  })

  it('preserves branch metrics from original file', () => {
    const changedLines: ChangedLinesMap = new Map([['/repo/src/file1.ts', new Set([1, 2])]])

    const result = filterByChangedLines(sampleReport, changedLines, mockLogger)

    const file = result[0]?.files[0]
    assert(file)
    expect(file.coverage.branchesCovered).toBe(0) // line 1 has no branches, line 2 has no branches
    expect(file.coverage.totalBranches).toBe(0) // no branches in filtered lines
  })

  it('excludes files with no changed lines info', () => {
    const changedLines: ChangedLinesMap = new Map([['/repo/src/file1.ts', new Set([1])]])

    const result = filterByChangedLines(sampleReport, changedLines, mockLogger)

    expect(result[0]?.files).toHaveLength(1)
    expect(result[0]?.files[0]?.filename).toBe('src/file1.ts')
  })

  it('excludes files with empty changed lines set', () => {
    const changedLines: ChangedLinesMap = new Map([
      ['/repo/src/file1.ts', new Set([1])],
      ['/repo/src/file2.ts', new Set()],
    ])

    const result = filterByChangedLines(sampleReport, changedLines, mockLogger)

    expect(result[0]?.files).toHaveLength(1)
  })

  it('removes packages with no files after filtering', () => {
    const changedLines: ChangedLinesMap = new Map([['/repo/nonexistent.ts', new Set([1])]])

    const result = filterByChangedLines(sampleReport, changedLines, mockLogger)

    expect(result).toHaveLength(0)
  })

  it('removes files with no lines after filtering', () => {
    const changedLines: ChangedLinesMap = new Map([['/repo/src/file1.ts', new Set([100])]])

    const result = filterByChangedLines(sampleReport, changedLines, mockLogger)

    expect(result).toHaveLength(0)
  })

  it('includes files without resolvedPath without filtering', () => {
    const reportWithMissingPath: PackageCoverage[] = [
      {
        name: 'Package1',
        files: [
          {
            filename: 'src/no-path.ts',
            // No resolvedPath
            lines: [
              { lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 },
              { lineNumber: 2, covered: false, branchesCovered: 0, totalBranches: 0 },
            ],
            coverage: {
              linesCovered: 1,
              totalLines: 2,
              branchesCovered: 0,
              totalBranches: 0,
              lineCoverage: 0.5,
              branchCoverage: undefined,
            },
          },
        ],
        coverage: {
          linesCovered: 1,
          totalLines: 2,
          branchesCovered: 0,
          totalBranches: 0,
          lineCoverage: 0.5,
          branchCoverage: undefined,
        },
      },
    ]

    const changedLines: ChangedLinesMap = new Map([['/repo/other-file.ts', new Set([1])]])

    const result = filterByChangedLines(reportWithMissingPath, changedLines, mockLogger)

    // File without resolvedPath should be included with all its lines
    expect(result).toHaveLength(1)
    expect(result[0]?.files).toHaveLength(1)
    expect(result[0]?.files[0]?.lines).toHaveLength(2)
  })
})
