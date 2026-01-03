import type { CoverageReport } from '../model.js'

/**
 * Abstract interface for coverage format parsers.
 * Implement this interface to add support for new coverage formats (LCOV, JaCoCo, etc.)
 */
export interface CoverageParser {
  /**
   * Parse coverage data from a string content.
   * @param content - The raw content of the coverage file
   * @param filePath - The filePath of the coverage file, if present
   * @returns A normalized CoverageReport
   */
  parse(content: string, filePath: string | undefined): Promise<CoverageReport>
}
