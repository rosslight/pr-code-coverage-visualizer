import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CoberturaCoverageParser } from '../../src/coverage/index.js'

const RESOURCES_DIR = path.join(__dirname, '../resources/cobertura')

async function loadResource(filename: string): Promise<string> {
  return fs.readFile(path.join(RESOURCES_DIR, filename), 'utf-8')
}

describe('CoberturaCoverageParser', () => {
  const parser = new CoberturaCoverageParser()

  describe('valid structures', () => {
    it('parses minimal valid cobertura', async () => {
      const content = await loadResource('valid-minimal.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.name).toBe('minimal')
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      expect(file.filename).toBe('src/minimal.ts')
      expect(file.lines).toHaveLength(1)
      expect(file.lines[0]).toEqual({ lineNumber: 1, state: 'covered' })

      // Metrics
      expect(file.lineMetrics).toEqual({ covered: 1, total: 1 })
      expect(file.branchMetrics).toEqual({ covered: 1, total: 1 })
      expect(file.methodMetrics).toBeUndefined()
    })

    it('parses multiple packages', async () => {
      const content = await loadResource('valid-multiple-packages.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(3)
      expect(report.packages[0]!.name).toBe('package.one')
      expect(report.packages[1]!.name).toBe('package.two')
      expect(report.packages[2]!.name).toBe('package.three')

      // Package one: all lines covered
      const pkg1File = report.packages[0]!.files[0]!
      expect(pkg1File.lines).toEqual([
        { lineNumber: 1, state: 'covered' },
        { lineNumber: 2, state: 'covered' },
      ])
      expect(pkg1File.lineMetrics).toEqual({ covered: 2, total: 2 })
      expect(pkg1File.branchMetrics).toEqual({ covered: 2, total: 2 })
      expect(pkg1File.methodMetrics).toBeUndefined()

      // Package two: mixed coverage
      const pkg2File = report.packages[1]!.files[0]!
      expect(pkg2File.lines).toEqual([
        { lineNumber: 1, state: 'covered' },
        { lineNumber: 2, state: 'not-covered' },
      ])
      expect(pkg2File.lineMetrics).toEqual({ covered: 1, total: 2 })
      expect(pkg2File.branchMetrics).toEqual({ covered: 1, total: 1 })
      expect(pkg2File.methodMetrics).toBeUndefined()

      // Package three: nothing covered
      const pkg3File = report.packages[2]!.files[0]!
      expect(pkg3File.lines).toEqual([{ lineNumber: 1, state: 'not-covered' }])
      expect(pkg3File.lineMetrics).toEqual({ covered: 0, total: 1 })
      expect(pkg3File.branchMetrics).toBeUndefined()
      expect(pkg3File.methodMetrics).toBeUndefined()
    })

    it('parses multiple classes per package', async () => {
      const content = await loadResource('valid-multiple-classes.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(3)

      const files = report.packages[0]!.files
      expect(files[0]!.filename).toBe('src/first.ts')
      expect(files[1]!.filename).toBe('src/second.ts')
      expect(files[2]!.filename).toBe('src/third.ts')

      // Verify metrics per file
      expect(files[0]!.lineMetrics).toEqual({ covered: 2, total: 2 })
      expect(files[0]!.branchMetrics).toEqual({ covered: 2, total: 2 })
      expect(files[0]!.methodMetrics).toBeUndefined()

      expect(files[1]!.lineMetrics).toEqual({ covered: 1, total: 2 })
      expect(files[1]!.branchMetrics).toEqual({ covered: 1, total: 1 })
      expect(files[1]!.methodMetrics).toBeUndefined()

      expect(files[2]!.lineMetrics).toEqual({ covered: 1, total: 2 })
      expect(files[2]!.branchMetrics).toEqual({ covered: 1, total: 1 })
      expect(files[2]!.methodMetrics).toBeUndefined()
    })

    it('parses multiple lines with different states and calculates metrics', async () => {
      const content = await loadResource('valid-multiple-lines.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(5)
      expect(file.lines[0]).toEqual({ lineNumber: 1, state: 'covered' })
      expect(file.lines[1]).toEqual({ lineNumber: 2, state: 'covered' })
      expect(file.lines[2]).toEqual({ lineNumber: 3, state: 'not-covered' })
      expect(file.lines[3]).toEqual({ lineNumber: 4, state: 'covered' }) // 100% branch
      expect(file.lines[4]).toEqual({ lineNumber: 5, state: 'not-covered' })

      // Line metrics: 3 covered (1, 2, 4), 2 not covered (3, 5)
      expect(file.lineMetrics).toEqual({ covered: 3, total: 5 })
      expect(file.branchMetrics).toEqual({ covered: 3, total: 3 })
      expect(file.methodMetrics).toBeUndefined()
    })

    it('handles single elements (not arrays)', async () => {
      const content = await loadResource('valid-single-elements.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(1)
      expect(file.lines[0]!.lineNumber).toBe(42)
      expect(file.lineMetrics).toEqual({ covered: 1, total: 1 })
      expect(file.branchMetrics).toEqual({ covered: 1, total: 1 })
      expect(file.methodMetrics).toBeUndefined()
    })
  })

  describe('empty/missing elements', () => {
    it('handles empty packages element', async () => {
      const content = await loadResource('empty-packages.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(0)
    })

    it('handles missing packages element', async () => {
      const content = await loadResource('no-packages-element.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(0)
    })

    it('handles package with no classes', async () => {
      const content = await loadResource('package-no-classes.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(0)
    })

    it('handles class with no lines', async () => {
      const content = await loadResource('class-no-lines.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(0)
      expect(file.lineMetrics).toEqual({ covered: 0, total: 0 })
      expect(file.branchMetrics).toBeUndefined()
      expect(file.methodMetrics).toBeUndefined()
    })
  })

  describe('branch coverage', () => {
    it('marks 100% branch coverage as covered with correct metrics', async () => {
      const content = await loadResource('branch-full-coverage.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines[0]).toEqual({ lineNumber: 1, state: 'covered' }) // No branch
      expect(file.lines[1]).toEqual({ lineNumber: 2, state: 'covered' }) // 100% branch
      expect(file.lines[2]).toEqual({ lineNumber: 3, state: 'covered' }) // 100% branch

      // All lines covered
      expect(file.lineMetrics).toEqual({ covered: 3, total: 3 })
      // Branch metrics: all branches fully covered (no partial)
      expect(file.branchMetrics).toEqual({ covered: 3, total: 3 })
      expect(file.methodMetrics).toBeUndefined()
    })

    it('marks partial branch coverage as partial with correct metrics', async () => {
      const content = await loadResource('branch-partial-coverage.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines[0]).toEqual({ lineNumber: 1, state: 'covered' }) // No branch
      expect(file.lines[1]).toEqual({ lineNumber: 2, state: 'partial' }) // 50% branch
      expect(file.lines[2]).toEqual({ lineNumber: 3, state: 'partial' }) // 25% branch

      // Line metrics: partial counts as covered
      expect(file.lineMetrics).toEqual({ covered: 3, total: 3 })
      // Branch metrics: 1 covered (line 1), 2 partial (lines 2, 3) -> covered=1, total=3
      expect(file.branchMetrics).toEqual({ covered: 1, total: 3 })
      expect(file.methodMetrics).toBeUndefined()
    })

    it('handles lines without branches', async () => {
      const content = await loadResource('branch-no-coverage.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines[0]).toEqual({ lineNumber: 1, state: 'covered' })
      expect(file.lines[1]).toEqual({ lineNumber: 2, state: 'covered' })
      expect(file.lines[2]).toEqual({ lineNumber: 3, state: 'not-covered' })

      expect(file.lineMetrics).toEqual({ covered: 2, total: 3 })
      expect(file.branchMetrics).toEqual({ covered: 2, total: 2 })
      expect(file.methodMetrics).toBeUndefined()
    })

    it('handles lowercase branch="true"', async () => {
      const content = await loadResource('branch-lowercase.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines[0]).toEqual({ lineNumber: 1, state: 'covered' }) // branch="false"
      expect(file.lines[1]).toEqual({ lineNumber: 2, state: 'covered' }) // 100% branch
      expect(file.lines[2]).toEqual({ lineNumber: 3, state: 'partial' }) // 50% branch

      expect(file.lineMetrics).toEqual({ covered: 3, total: 3 })
      // 2 covered (lines 1, 2), 1 partial (line 3) -> covered=2, total=3
      expect(file.branchMetrics).toEqual({ covered: 2, total: 3 })
      expect(file.methodMetrics).toBeUndefined()
    })

    it('processes mixed branch scenarios with correct metrics', async () => {
      const content = await loadResource('branch-mixed.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(5)
      expect(file.lines[0]).toEqual({ lineNumber: 1, state: 'covered' }) // No branch, hits > 0
      expect(file.lines[1]).toEqual({ lineNumber: 2, state: 'covered' }) // 100% branch
      expect(file.lines[2]).toEqual({ lineNumber: 3, state: 'partial' }) // 50% branch
      expect(file.lines[3]).toEqual({ lineNumber: 4, state: 'not-covered' }) // 0 hits
      expect(file.lines[4]).toEqual({ lineNumber: 5, state: 'covered' }) // No branch, hits > 0

      // 4 lines with hits (covered or partial), 1 not covered
      expect(file.lineMetrics).toEqual({ covered: 4, total: 5 })
      // 3 covered (lines 1, 2, 5), 1 partial (line 3) -> covered=3, total=4
      expect(file.branchMetrics).toEqual({ covered: 3, total: 4 })
      expect(file.methodMetrics).toBeUndefined()
    })
  })

  describe('class merging', () => {
    it('merges multiple classes with same filename', async () => {
      const content = await loadResource('multiple-classes-same-file.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      expect(file.filename).toBe('src/shared.ts')
      expect(file.lines).toHaveLength(5)
      expect(file.lines.map((l) => l.lineNumber)).toEqual([1, 2, 3, 10, 11])

      // Merged metrics: 4 covered, 1 not covered (line 11)
      expect(file.lineMetrics).toEqual({ covered: 4, total: 5 })
      expect(file.branchMetrics).toEqual({ covered: 4, total: 4 })
      expect(file.methodMetrics).toBeUndefined()
    })

    it('applies correct line merge priority (covered > partial > not-covered)', async () => {
      const content = await loadResource('line-merge-priority.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files).toHaveLength(1)

      const file = report.packages[0]!.files[0]!
      // Line 5 appears in all three classes with different states
      // ClassOne: not-covered, ClassTwo: partial, ClassThree: covered
      // Should merge to 'covered' (highest priority)
      const line5 = file.lines.find((l) => l.lineNumber === 5)
      expect(line5).toEqual({ lineNumber: 5, state: 'covered' })

      // Line 1 only in ClassOne as not-covered
      const line1 = file.lines.find((l) => l.lineNumber === 1)
      expect(line1).toEqual({ lineNumber: 1, state: 'not-covered' })

      // 3 covered (lines 5, 10, 15), 1 not-covered (line 1)
      expect(file.lineMetrics).toEqual({ covered: 3, total: 4 })
      expect(file.branchMetrics).toBeDefined()
      expect(file.methodMetrics).toBeUndefined()
    })
  })

  describe('edge values', () => {
    it('handles all lines with zero hits', async () => {
      const content = await loadResource('zero-hits.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(5)
      file.lines.forEach((line) => {
        expect(line.state).toBe('not-covered')
      })

      expect(file.lineMetrics).toEqual({ covered: 0, total: 5 })
      // No covered/partial lines, so no branch metrics
      expect(file.branchMetrics).toBeUndefined()
      expect(file.methodMetrics).toBeUndefined()
    })

    it('handles high hit counts', async () => {
      const content = await loadResource('high-hit-count.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(3)
      file.lines.forEach((line) => {
        expect(line.state).toBe('covered')
      })

      expect(file.lineMetrics).toEqual({ covered: 3, total: 3 })
      expect(file.branchMetrics).toEqual({ covered: 3, total: 3 })
      expect(file.methodMetrics).toBeUndefined()
    })

    it('handles various condition-coverage formats', async () => {
      const content = await loadResource('condition-coverage-formats.xml')
      const report = await parser.parse(content)

      const file = report.packages[0]!.files[0]!
      expect(file.lines).toHaveLength(6)

      // 100% (2/2) -> covered
      expect(file.lines[0]).toEqual({ lineNumber: 1, state: 'covered' })
      // 50% (1/2) -> partial
      expect(file.lines[1]).toEqual({ lineNumber: 2, state: 'partial' })
      // 0% (0/2) -> partial (has hits, but not all branches)
      expect(file.lines[2]).toEqual({ lineNumber: 3, state: 'partial' })
      // 75% (3/4) -> partial
      expect(file.lines[3]).toEqual({ lineNumber: 4, state: 'partial' })
      // 33% (2/6) -> partial
      expect(file.lines[4]).toEqual({ lineNumber: 5, state: 'partial' })
      // 1% (1/100) -> partial
      expect(file.lines[5]).toEqual({ lineNumber: 6, state: 'partial' })

      // All lines have hits, all count as covered for line metrics
      expect(file.lineMetrics).toEqual({ covered: 6, total: 6 })
      // 1 covered (line 1), 5 partial -> covered=1, total=6
      expect(file.branchMetrics).toEqual({ covered: 1, total: 6 })
      expect(file.methodMetrics).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('throws on invalid XML syntax', async () => {
      const content = await loadResource('invalid-xml-syntax.xml')

      await expect(parser.parse(content)).rejects.toThrow()
    })

    it('throws on missing coverage root element', async () => {
      const content = await loadResource('missing-coverage-root.xml')

      await expect(parser.parse(content)).rejects.toThrow()
    })

    it('handles missing required attributes', async () => {
      const content = await loadResource('missing-required-attrs.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      expect(report.packages[0]!.files.length).toBeGreaterThan(0)
    })
  })

  describe('comprehensive metrics', () => {
    it('calculates all metrics correctly for complex file', async () => {
      const content = await loadResource('metrics-comprehensive.xml')
      const report = await parser.parse(content)

      expect(report.packages).toHaveLength(1)
      const file = report.packages[0]!.files[0]!

      // 10 lines total:
      // - Lines 1, 2, 3: covered (hits > 0, no branch)
      // - Line 4: covered (100% branch)
      // - Lines 5, 6: partial (branch with < 100%)
      // - Lines 7, 8, 9: not covered (hits = 0)
      // - Line 10: not covered (hits = 0, even with branch)
      expect(file.lines).toHaveLength(10)

      // Verify individual line states
      expect(file.lines.find((l) => l.lineNumber === 1)!.state).toBe('covered')
      expect(file.lines.find((l) => l.lineNumber === 4)!.state).toBe('covered')
      expect(file.lines.find((l) => l.lineNumber === 5)!.state).toBe('partial')
      expect(file.lines.find((l) => l.lineNumber === 6)!.state).toBe('partial')
      expect(file.lines.find((l) => l.lineNumber === 7)!.state).toBe('not-covered')
      expect(file.lines.find((l) => l.lineNumber === 10)!.state).toBe('not-covered')

      // Line metrics: covered + partial = 6, not covered = 4
      expect(file.lineMetrics).toEqual({ covered: 6, total: 10 })

      // Branch metrics: 4 covered (lines 1,2,3,4), 2 partial (lines 5,6) -> covered=4, total=6
      expect(file.branchMetrics).toEqual({ covered: 4, total: 6 })

      // Method metrics are not currently parsed by the parser
      expect(file.methodMetrics).toBeUndefined()
    })
  })
})
