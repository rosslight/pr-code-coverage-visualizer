import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {CoberturaCoverageParser, LineCoverage} from '../../src/coverage/index.js'

const RESOURCES_DIR = path.join(__dirname, '../resources/cobertura')

async function loadResource(filename: string): Promise<string> {
  return fs.readFile(path.join(RESOURCES_DIR, filename), 'utf-8')
}

describe('CoberturaCoverageParser', () => {
  const parser = new CoberturaCoverageParser()

  describe('valid structures', () => {
    it('parses minimal valid cobertura', async () => {
      const content = await loadResource('valid-minimal.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.name).toBe('minimal')
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      expect(file.filename).toBe('src/minimal.ts')
      expect(file.lines).toHaveLength(1)
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 })

      // Metrics
      expect(file.coverage).toEqual({ linesCovered: 1, totalLines: 1, branchesCovered: 0, totalBranches: 0, lineCoverage: 1, branchCoverage: undefined })
    })

    it('parses multiple packages', async () => {
      const content = await loadResource('valid-multiple-packages.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(3)
      expect(report.packages[0]!.name).toBe('package.one')
      expect(report.packages[1]!.name).toBe('package.two')
      expect(report.packages[2]!.name).toBe('package.three')

      // Package one: all lines covered
      const pkg1File = report.packages[0]!.files[0]!
      expect(pkg1File.lines).toEqual<LineCoverage[]>([
        { lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 },
        { lineNumber: 2, covered: true, branchesCovered: 0, totalBranches: 0 }
      ])
      expect(pkg1File.coverage).toEqual({ linesCovered: 2, totalLines: 2, branchesCovered: 0, totalBranches: 0, lineCoverage: 1, branchCoverage: undefined })

      // Package two: mixed coverage
      const pkg2File = report.packages[1]!.files[0]!
      expect(pkg2File.lines).toEqual<LineCoverage[]>([
        { lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 },
        { lineNumber: 2, covered: false, branchesCovered: 0, totalBranches: 0 },
      ])
      expect(pkg2File.coverage).toEqual({ linesCovered: 1, totalLines: 2, branchesCovered: 0, totalBranches: 0, lineCoverage: 0.5, branchCoverage: undefined })

      // Package three: nothing covered
      const pkg3File = report.packages[2]!.files[0]!
      expect(pkg3File.lines).toEqual<LineCoverage[]>([{ lineNumber: 1, covered: false, branchesCovered: 0, totalBranches: 0 }])
      expect(pkg3File.coverage).toEqual({ linesCovered: 0, totalLines: 1, branchesCovered: 0, totalBranches: 0, lineCoverage: 0, branchCoverage: undefined })
    })

    it('parses multiple classes per package', async () => {
      const content = await loadResource('valid-multiple-classes.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(3)

      const files = report.packages[0]!.files!
      expect(files[0]?.filename).toBe('src/first.ts')
      expect(files[1]?.filename).toBe('src/second.ts')
      expect(files[2]?.filename).toBe('src/third.ts')

      // Verify metrics per file
      expect(files[0]?.coverage).toEqual({ linesCovered: 2, totalLines: 2, branchesCovered: 0, totalBranches: 0, lineCoverage: 1, branchCoverage: undefined })
      expect(files[1]?.coverage).toEqual({ linesCovered: 1, totalLines: 2, branchesCovered: 0, totalBranches: 0, lineCoverage: 0.5, branchCoverage: undefined })
      expect(files[2]?.coverage).toEqual({ linesCovered: 1, totalLines: 2, branchesCovered: 0, totalBranches: 0, lineCoverage: 0.5, branchCoverage: undefined })
    })

    it('parses multiple lines with different states and calculates metrics', async () => {
      const content = await loadResource('valid-multiple-lines.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(5)
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: false, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[3]).toEqual<LineCoverage>({ lineNumber: 4, covered: true, branchesCovered: 2, totalBranches: 2 })
      expect(file.lines[4]).toEqual<LineCoverage>({ lineNumber: 5, covered: false, branchesCovered: 0, totalBranches: 0 })

      expect(file.coverage).toEqual({ linesCovered: 3, totalLines: 5, branchesCovered: 2, totalBranches: 2, lineCoverage: 0.6, branchCoverage: 1 })
    })

    it('handles single elements (not arrays)', async () => {
      const content = await loadResource('valid-single-elements.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(1)
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 42, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.coverage).toEqual({ linesCovered: 1, totalLines: 1, branchesCovered: 0, totalBranches: 0, lineCoverage: 1, branchCoverage: undefined })
    })
  })

  describe('empty/missing elements', () => {
    it('handles empty packages element', async () => {
      const content = await loadResource('empty-packages.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(0)
    })

    it('handles missing packages element', async () => {
      const content = await loadResource('no-packages-element.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(0)
    })

    it('handles package with no classes', async () => {
      const content = await loadResource('package-no-classes.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(0)
    })

    it('handles class with no lines', async () => {
      const content = await loadResource('class-no-lines.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(0)
      expect(file.coverage).toEqual({ linesCovered: 0, totalLines: 0, branchesCovered: 0, totalBranches: 0, lineCoverage: 0, branchCoverage: undefined })
    })
  })

  describe('branch coverage', () => {
    it('marks 100% branch coverage as covered with correct metrics', async () => {
      const content = await loadResource('branch-full-coverage.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 }) // No branch
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 2, totalBranches: 2 }) // 100% branch
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: true, branchesCovered: 4, totalBranches: 4 }) // 100% branch

      // All lines covered
      expect(file.coverage).toEqual({ linesCovered: 3, totalLines: 3, branchesCovered: 6, totalBranches: 6, lineCoverage: 1, branchCoverage: 1 })
    })

    it('marks partial branch coverage as partial with correct metrics', async () => {
      const content = await loadResource('branch-partial-coverage.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 }) // No branch
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 1, totalBranches: 2 }) // 50% branch
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: true, branchesCovered: 1, totalBranches: 4 }) // 25% branch

      // Line metrics: partial counts as covered
      expect(file.coverage).toEqual({ linesCovered: 3, totalLines: 3, branchesCovered: 2, totalBranches: 6, lineCoverage: 1, branchCoverage: 2 / 6 })
    })

    it('handles lines without branches', async () => {
      const content = await loadResource('branch-no-coverage.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: false, branchesCovered: 0, totalBranches: 0 })

      expect(file.coverage).toEqual({ linesCovered: 2, totalLines: 3, branchesCovered: 0, totalBranches: 0, lineCoverage: 2 / 3, branchCoverage: undefined })
    })

    it('handles lowercase branch="true"', async () => {
      const content = await loadResource('branch-lowercase.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 }) // branch="false"
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 2, totalBranches: 2 }) // 100% branch
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: true, branchesCovered: 1, totalBranches: 2 }) // 50% branch

      expect(file.coverage).toEqual({ linesCovered: 3, totalLines: 3, branchesCovered: 3, totalBranches: 4, lineCoverage: 1, branchCoverage: 3 / 4 })
    })

    it('processes mixed branch scenarios with correct metrics', async () => {
      const content = await loadResource('branch-mixed.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(5)
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 }) // No branch, hits > 0
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 2, totalBranches: 2 }) // 100% branch
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: true, branchesCovered: 1, totalBranches: 2 }) // 50% branch
      expect(file.lines[3]).toEqual<LineCoverage>({ lineNumber: 4, covered: false, branchesCovered: 0, totalBranches: 2 }) // 0 hits, has branch but 0% coverage
      expect(file.lines[4]).toEqual<LineCoverage>({ lineNumber: 5, covered: true, branchesCovered: 0, totalBranches: 0 }) // No branch, hits > 0

      // 4 lines with hits (covered or partial), 1 not covered
      expect(file.coverage).toEqual({ linesCovered: 4, totalLines: 5, branchesCovered: 3, totalBranches: 6, lineCoverage: 0.8, branchCoverage: 3 / 6 })
    })
  })

  describe('class merging', () => {
    it('merges multiple classes with same filename', async () => {
      const content = await loadResource('multiple-classes-same-file.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      expect(file.filename).toBe('src/shared.ts')
      expect(file.lines).toHaveLength(5)
      expect(file.lines.map((l) => l.lineNumber)).toEqual([1, 2, 3, 10, 11])
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[3]).toEqual<LineCoverage>({ lineNumber: 10, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[4]).toEqual<LineCoverage>({ lineNumber: 11, covered: false, branchesCovered: 0, totalBranches: 0 })

      // Merged metrics: 4 covered, 1 not covered (line 11)
      expect(file.coverage).toEqual({ linesCovered: 4, totalLines: 5, branchesCovered: 0, totalBranches: 0, lineCoverage: 0.8, branchCoverage: undefined })
    })

    it('applies correct line merge priority (covered > partial > not-covered)', async () => {
      const content = await loadResource('line-merge-priority.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      const line5 = file.lines.find((l) => l.lineNumber === 5)
      expect(line5).toEqual<LineCoverage>({ lineNumber: 5, covered: true, branchesCovered: 2, totalBranches: 2 })
      const line1 = file.lines.find((l) => l.lineNumber === 1)
      expect(line1).toEqual<LineCoverage>({ lineNumber: 1, covered: false, branchesCovered: 0, totalBranches: 0 })

      expect(file.coverage).toEqual({ linesCovered: 3, totalLines: 4, branchesCovered: 2, totalBranches: 2, lineCoverage: 0.75, branchCoverage: 1 })
    })
  })

  describe('edge values', () => {
    it('handles all lines with zero hits', async () => {
      const content = await loadResource('zero-hits.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(5)
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: false, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: false, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: false, branchesCovered: 0, totalBranches: 2 })
      expect(file.lines[3]).toEqual<LineCoverage>({ lineNumber: 4, covered: false, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[4]).toEqual<LineCoverage>({ lineNumber: 5, covered: false, branchesCovered: 0, totalBranches: 0 })

      expect(file.coverage).toEqual({ linesCovered: 0, totalLines: 5, branchesCovered: 0, totalBranches: 2, lineCoverage: 0, branchCoverage: 0 })
    })

    it('handles high hit counts', async () => {
      const content = await loadResource('high-hit-count.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(3)
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 2, totalBranches: 2 })
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: true, branchesCovered: 0, totalBranches: 0 })

      expect(file.coverage).toEqual({ linesCovered: 3, totalLines: 3, branchesCovered: 2, totalBranches: 2, lineCoverage: 1, branchCoverage: 1 })
    })

    it('handles various condition-coverage formats', async () => {
      const content = await loadResource('condition-coverage-formats.xml')
      const report = await parser.parse(content, undefined)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(6)

      // 100% (2/2) -> covered
      expect(file.lines[0]).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 2, totalBranches: 2 })
      // 50% (1/2) -> covered (has hits, but partial branch)
      expect(file.lines[1]).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 1, totalBranches: 2 })
      // 0% (0/2) -> covered (has hits, but no branches covered)
      expect(file.lines[2]).toEqual<LineCoverage>({ lineNumber: 3, covered: true, branchesCovered: 0, totalBranches: 2 })
      // 75% (3/4) -> covered (has hits, but partial branch)
      expect(file.lines[3]).toEqual<LineCoverage>({ lineNumber: 4, covered: true, branchesCovered: 3, totalBranches: 4 })
      // 33% (2/6) -> covered (has hits, but partial branch)
      expect(file.lines[4]).toEqual<LineCoverage>({ lineNumber: 5, covered: true, branchesCovered: 2, totalBranches: 6 })
      // 1% (1/100) -> covered (has hits, but partial branch)
      expect(file.lines[5]).toEqual<LineCoverage>({ lineNumber: 6, covered: true, branchesCovered: 1, totalBranches: 100 })

      // All lines have hits, all count as covered for line metrics
      expect(file.coverage).toEqual({ linesCovered: 6, totalLines: 6, branchesCovered: 9, totalBranches: 116, lineCoverage: 1, branchCoverage: 9 / 116 })
    })
  })

  describe('error handling', () => {
    it('throws on invalid XML syntax', async () => {
      const content = await loadResource('invalid-xml-syntax.xml')

      await expect(parser.parse(content, undefined)).rejects.toThrow()
    })

    it('throws on missing coverage root element', async () => {
      const content = await loadResource('missing-coverage-root.xml')

      await expect(parser.parse(content, undefined)).rejects.toThrow()
    })

    it('handles missing required attributes', async () => {
      const content = await loadResource('missing-required-attrs.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files.length).toBeGreaterThan(0)
    })
  })

  describe('comprehensive metrics', () => {
    it('calculates all metrics correctly for complex file', async () => {
      const content = await loadResource('metrics-comprehensive.xml')
      const report = await parser.parse(content, undefined)

      expect(report.packages).toHaveLength(1)
      const file = report.packages[0]!.files[0]!

      // 13 lines total:
      // - Lines 1, 2, 3: covered (hits > 0, no branch)
      // - Line 4: covered (100% branch)
      // - Lines 5, 6: covered (branch with < 100%)
      // - Lines 7, 8, 9: not covered (hits = 0)
      // - Line 10: not covered (hits = 0, even with branch)
      // - Line 11: covered (hits > 0, no branch)
      // - Lines 15, 16: not covered (hits = 0)
      expect(file.lines).toHaveLength(13)

      // Verify individual line coverage
      expect(file.lines.find((l) => l.lineNumber === 1)).toEqual<LineCoverage>({ lineNumber: 1, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines.find((l) => l.lineNumber === 2)).toEqual<LineCoverage>({ lineNumber: 2, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines.find((l) => l.lineNumber === 3)).toEqual<LineCoverage>({ lineNumber: 3, covered: true, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines.find((l) => l.lineNumber === 4)).toEqual<LineCoverage>({ lineNumber: 4, covered: true, branchesCovered: 2, totalBranches: 2 })
      expect(file.lines.find((l) => l.lineNumber === 5)).toEqual<LineCoverage>({ lineNumber: 5, covered: true, branchesCovered: 1, totalBranches: 2 })
      expect(file.lines.find((l) => l.lineNumber === 6)).toEqual<LineCoverage>({ lineNumber: 6, covered: true, branchesCovered: 3, totalBranches: 4 })
      expect(file.lines.find((l) => l.lineNumber === 7)).toEqual<LineCoverage>({ lineNumber: 7, covered: false, branchesCovered: 0, totalBranches: 0 })
      expect(file.lines.find((l) => l.lineNumber === 10)).toEqual<LineCoverage>({ lineNumber: 10, covered: false, branchesCovered: 0, totalBranches: 2 })
      expect(file.lines.find((l) => l.lineNumber === 11)).toEqual<LineCoverage>({ lineNumber: 11, covered: true, branchesCovered: 0, totalBranches: 0 })

      // Line metrics: covered = 7, not covered = 6
      expect(file.coverage).toEqual({ linesCovered: 7, totalLines: 13, branchesCovered: 6, totalBranches: 10, lineCoverage: 7 / 13, branchCoverage: 6 / 10 })

      // Method metrics are not currently parsed by the parser
    })
  })
})
