import { describe, expect, it } from 'vitest'
import { createCliLogger, type Logger } from '../../src/core/process-coverage.js'
import type { PackageCoverage } from '../../src/coverage/model.js'
import { filterByGlob } from '../../src/filter/index.js'

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

  it('includes all files when no exclude patterns are provided', () => {
    const result = filterByGlob(sampleReport, [], mockLogger)
    expect(result).toHaveLength(2)
    expect(result[0]?.files).toHaveLength(3)
    expect(result[1]?.files).toHaveLength(1)
  })

  it('excludes files matching directory pattern', () => {
    const result = filterByGlob(sampleReport, ['**/tests/**'], mockLogger)
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('Package1')
    expect(result[0]?.files).toHaveLength(2)
    expect(result[0]?.files.map((f) => f.filename)).toEqual(['src/utils/helper.ts', 'src/components/Button.tsx'])
    expect(result[1]?.files).toHaveLength(1)
  })

  it('excludes files matching extension pattern', () => {
    const result = filterByGlob(sampleReport, ['*.ts'], mockLogger)
    expect(result).toHaveLength(2)
    expect(result[0]?.files).toHaveLength(1)
    expect(result[0]?.files[0]?.filename).toBe('src/components/Button.tsx')
    expect(result[1]?.files).toHaveLength(1)
  })

  it('excludes files matching specific file pattern', () => {
    const result = filterByGlob(sampleReport, ['**/helper.ts'], mockLogger)
    expect(result).toHaveLength(2)
    expect(result[0]?.files).toHaveLength(2)
    expect(result[0]?.files.map((f) => f.filename)).toEqual(['src/components/Button.tsx', 'tests/helper.test.ts'])
  })

  it('removes empty packages after excluding all their files', () => {
    const result = filterByGlob(sampleReport, ['**/lib/**'], mockLogger)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Package1')
  })

  it('includes all files when exclude patterns match nothing', () => {
    const result = filterByGlob(sampleReport, ['**/nonexistent/**'], mockLogger)
    expect(result).toHaveLength(2)
    expect(result[0]?.files).toHaveLength(3)
    expect(result[1]?.files).toHaveLength(1)
  })

  it('excludes files matching any of multiple patterns', () => {
    const result = filterByGlob(sampleReport, ['**/tests/**', '**/lib/**'], mockLogger)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Package1')
    expect(result[0]?.files).toHaveLength(2)
    expect(result[0]?.files.map((f) => f.filename)).toEqual(['src/utils/helper.ts', 'src/components/Button.tsx'])
  })

  it('normalizes patterns without slash by prepending **/', () => {
    const result = filterByGlob(sampleReport, ['*.tsx'], mockLogger)
    expect(result).toHaveLength(2)
    expect(result[0]?.files).toHaveLength(2)
    expect(result[0]?.files.map((f) => f.filename)).toEqual(['src/utils/helper.ts', 'tests/helper.test.ts'])
  })

  it('includes files without resolvedPath even when they match patterns', () => {
    const reportWithMissingPath: PackageCoverage[] = [
      {
        name: 'Package1',
        files: [
          {
            filename: 'src/no-path.ts',
            resolvedPath: undefined,
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
          {
            filename: 'src/with-path.ts',
            resolvedPath: '/repo/src/with-path.ts',
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
          linesCovered: 2,
          totalLines: 2,
          branchesCovered: 0,
          totalBranches: 0,
          lineCoverage: 1,
          branchCoverage: undefined,
        },
      },
    ]

    const result = filterByGlob(reportWithMissingPath, ['**/*.ts'], mockLogger)
    expect(result).toHaveLength(1)
    expect(result[0]?.files).toHaveLength(1)
    expect(result[0]?.files[0]?.filename).toBe('src/no-path.ts')
  })
})
