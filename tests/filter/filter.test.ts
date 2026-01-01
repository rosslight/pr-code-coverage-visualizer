import { describe, expect, it } from 'vitest'
import type { CoverageReport } from '../../src/coverage/model.js'
import { applyFilters, filterByChangedLines, filterByGlob } from '../../src/filter/index.js'
import type { ChangedLinesMap, FilterContext } from '../../src/filter/model.js'

describe('filterByGlob', () => {
  const sampleReport: CoverageReport = {
    packages: [
      {
        name: 'Package1',
        files: [
          {
            filename: 'src/utils/helper.ts',
            lines: [
              { lineNumber: 1, state: 'covered' },
              { lineNumber: 2, state: 'not-covered' },
            ],
            lineMetrics: { covered: 1, total: 2 },
          },
          {
            filename: 'src/components/Button.tsx',
            lines: [
              { lineNumber: 1, state: 'covered' },
              { lineNumber: 2, state: 'covered' },
            ],
            lineMetrics: { covered: 2, total: 2 },
          },
          {
            filename: 'tests/helper.test.ts',
            lines: [{ lineNumber: 1, state: 'covered' }],
            lineMetrics: { covered: 1, total: 1 },
          },
        ],
      },
      {
        name: 'Package2',
        files: [
          {
            filename: 'lib/index.js',
            lines: [{ lineNumber: 1, state: 'not-covered' }],
            lineMetrics: { covered: 0, total: 1 },
          },
        ],
      },
    ],
  }

  it('matches all files with ** pattern', () => {
    const result = filterByGlob(sampleReport, '**')
    expect(result.packages).toHaveLength(2)
    expect(result.packages[0]!.files).toHaveLength(3)
    expect(result.packages[1]!.files).toHaveLength(1)
  })

  it('filters files by directory pattern', () => {
    const result = filterByGlob(sampleReport, 'src/**')
    expect(result.packages).toHaveLength(1)
    expect(result.packages[0]!.name).toBe('Package1')
    expect(result.packages[0]!.files).toHaveLength(2)
    expect(result.packages[0]!.files.map((f) => f.filename)).toEqual([
      'src/utils/helper.ts',
      'src/components/Button.tsx',
    ])
  })

  it('filters files by extension pattern', () => {
    const result = filterByGlob(sampleReport, '**/*.tsx')
    expect(result.packages).toHaveLength(1)
    expect(result.packages[0]!.files).toHaveLength(1)
    expect(result.packages[0]!.files[0]!.filename).toBe('src/components/Button.tsx')
  })

  it('removes empty packages after filtering', () => {
    const result = filterByGlob(sampleReport, 'lib/**')
    expect(result.packages).toHaveLength(1)
    expect(result.packages[0]!.name).toBe('Package2')
  })

  it('returns empty packages array when nothing matches', () => {
    const result = filterByGlob(sampleReport, 'nonexistent/**')
    expect(result.packages).toHaveLength(0)
  })

  it('supports specific file matching', () => {
    const result = filterByGlob(sampleReport, '**/helper.ts')
    expect(result.packages).toHaveLength(1)
    expect(result.packages[0]!.files).toHaveLength(1)
    expect(result.packages[0]!.files[0]!.filename).toBe('src/utils/helper.ts')
  })
})

describe('filterByChangedLines', () => {
  const sampleReport: CoverageReport = {
    packages: [
      {
        name: 'Package1',
        files: [
          {
            filename: 'src/file1.ts',
            lines: [
              { lineNumber: 1, state: 'covered' },
              { lineNumber: 2, state: 'not-covered' },
              { lineNumber: 3, state: 'covered' },
              { lineNumber: 4, state: 'partial' },
              { lineNumber: 5, state: 'covered' },
            ],
            lineMetrics: { covered: 3, total: 5 },
            branchMetrics: { covered: 1, total: 2 },
          },
          {
            filename: 'src/file2.ts',
            lines: [
              { lineNumber: 1, state: 'covered' },
              { lineNumber: 2, state: 'covered' },
            ],
            lineMetrics: { covered: 2, total: 2 },
          },
        ],
      },
    ],
  }

  it('filters lines to only those that were changed', () => {
    const changedLines: ChangedLinesMap = new Map([['src/file1.ts', new Set([2, 4])]])

    const result = filterByChangedLines(sampleReport, changedLines)

    expect(result.packages).toHaveLength(1)
    expect(result.packages[0]!.files).toHaveLength(1)

    const file = result.packages[0]!.files[0]!
    expect(file.filename).toBe('src/file1.ts')
    expect(file.lines).toHaveLength(2)
    expect(file.lines.map((l) => l.lineNumber)).toEqual([2, 4])
  })

  it('recalculates line metrics based on filtered lines', () => {
    const changedLines: ChangedLinesMap = new Map([['src/file1.ts', new Set([1, 2, 3])]])

    const result = filterByChangedLines(sampleReport, changedLines)

    const file = result.packages[0]!.files[0]!
    expect(file.lineMetrics.covered).toBe(2) // lines 1 and 3 are covered
    expect(file.lineMetrics.total).toBe(3) // 3 lines total
  })

  it('preserves branch metrics from original file', () => {
    const changedLines: ChangedLinesMap = new Map([['src/file1.ts', new Set([1, 2])]])

    const result = filterByChangedLines(sampleReport, changedLines)

    const file = result.packages[0]!.files[0]!
    expect(file.branchMetrics).toEqual({ covered: 1, total: 2 })
  })

  it('excludes files with no changed lines info', () => {
    const changedLines: ChangedLinesMap = new Map([['src/file1.ts', new Set([1])]])

    const result = filterByChangedLines(sampleReport, changedLines)

    expect(result.packages[0]!.files).toHaveLength(1)
    expect(result.packages[0]!.files[0]!.filename).toBe('src/file1.ts')
  })

  it('excludes files with empty changed lines set', () => {
    const changedLines: ChangedLinesMap = new Map([
      ['src/file1.ts', new Set([1])],
      ['src/file2.ts', new Set()],
    ])

    const result = filterByChangedLines(sampleReport, changedLines)

    expect(result.packages[0]!.files).toHaveLength(1)
  })

  it('removes packages with no files after filtering', () => {
    const changedLines: ChangedLinesMap = new Map([['nonexistent.ts', new Set([1])]])

    const result = filterByChangedLines(sampleReport, changedLines)

    expect(result.packages).toHaveLength(0)
  })

  it('removes files with no lines after filtering', () => {
    const changedLines: ChangedLinesMap = new Map([['src/file1.ts', new Set([100])]])

    const result = filterByChangedLines(sampleReport, changedLines)

    expect(result.packages).toHaveLength(0)
  })
})

describe('applyFilters', () => {
  const sampleReport: CoverageReport = {
    packages: [
      {
        name: 'Package1',
        files: [
          {
            filename: 'src/utils/helper.ts',
            lines: [
              { lineNumber: 1, state: 'covered' },
              { lineNumber: 2, state: 'not-covered' },
              { lineNumber: 3, state: 'covered' },
            ],
            lineMetrics: { covered: 2, total: 3 },
          },
          {
            filename: 'tests/helper.test.ts',
            lines: [{ lineNumber: 1, state: 'covered' }],
            lineMetrics: { covered: 1, total: 1 },
          },
        ],
      },
    ],
  }

  it('returns unfiltered report when using default options', () => {
    const context: FilterContext = {
      options: {
        globPattern: '**/**',
        showChangedLinesOnly: false,
      },
      changedLines: undefined,
    }

    const result = applyFilters(sampleReport, context)

    expect(result.wasFiltered).toBe(false)
    expect(result.report).toBe(sampleReport) // Same reference
  })

  it('applies only glob filter when showChangedLinesOnly is false', () => {
    const context: FilterContext = {
      options: {
        globPattern: 'src/**',
        showChangedLinesOnly: false,
      },
      changedLines: new Map([['src/utils/helper.ts', new Set([1])]]),
    }

    const result = applyFilters(sampleReport, context)

    expect(result.wasFiltered).toBe(true)
    expect(result.report.packages[0]!.files).toHaveLength(1)
    expect(result.report.packages[0]!.files[0]!.filename).toBe('src/utils/helper.ts')
    // All lines should be present (changed lines filter not applied)
    expect(result.report.packages[0]!.files[0]!.lines).toHaveLength(3)
  })

  it('applies only changed lines filter when glob is **/**', () => {
    const context: FilterContext = {
      options: {
        globPattern: '**/**',
        showChangedLinesOnly: true,
      },
      changedLines: new Map([['src/utils/helper.ts', new Set([2])]]),
    }

    const result = applyFilters(sampleReport, context)

    expect(result.wasFiltered).toBe(true)
    expect(result.report.packages[0]!.files).toHaveLength(1)
    expect(result.report.packages[0]!.files[0]!.lines).toHaveLength(1)
    expect(result.report.packages[0]!.files[0]!.lines[0]!.lineNumber).toBe(2)
  })

  it('applies both filters when configured', () => {
    const context: FilterContext = {
      options: {
        globPattern: 'src/**',
        showChangedLinesOnly: true,
      },
      changedLines: new Map([
        ['src/utils/helper.ts', new Set([1, 2])],
        ['tests/helper.test.ts', new Set([1])], // This file is filtered out by glob
      ]),
    }

    const result = applyFilters(sampleReport, context)

    expect(result.wasFiltered).toBe(true)
    expect(result.report.packages[0]!.files).toHaveLength(1)
    expect(result.report.packages[0]!.files[0]!.filename).toBe('src/utils/helper.ts')
    expect(result.report.packages[0]!.files[0]!.lines).toHaveLength(2)
  })

  it('skips changed lines filter when changedLines is undefined', () => {
    const context: FilterContext = {
      options: {
        globPattern: '**/**',
        showChangedLinesOnly: true,
      },
      changedLines: undefined,
    }

    const result = applyFilters(sampleReport, context)

    expect(result.wasFiltered).toBe(false)
    expect(result.report).toBe(sampleReport)
  })

  it('skips changed lines filter when changedLines is empty', () => {
    const context: FilterContext = {
      options: {
        globPattern: '**/**',
        showChangedLinesOnly: true,
      },
      changedLines: new Map(),
    }

    const result = applyFilters(sampleReport, context)

    expect(result.wasFiltered).toBe(false)
    expect(result.report).toBe(sampleReport)
  })
})

