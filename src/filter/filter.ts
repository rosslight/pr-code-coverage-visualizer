import * as path from 'node:path'
import type { Logger } from '../core/index.js'
import { CoberturaCoverageParser } from '../coverage/index.js'
import type { PackageCoverage } from '../coverage/model.js'

/**
 * Filter coverage packages to exclude files matching any of the provided glob patterns.
 * If patterns array is empty, no files are excluded (all files are included).
 */
export function filterByGlob(packages: PackageCoverage[], patterns: string[], logger: Logger): PackageCoverage[] {
  if (patterns.length === 0) {
    return packages
  }

  // Normalize patterns: if pattern doesn't contain '/', prepend '**/'
  const effectivePatterns = patterns.map((pattern) => (pattern.includes('/') ? pattern : `**/${pattern}`))

  const totalFilesBefore = packages.reduce((sum, pkg) => sum + pkg.files.length, 0)

  const filteredPackages = packages
    .map((pkg) => {
      const files = pkg.files.filter((file) => {
        const filePath = file.resolvedPath
        // Files without resolvedPath are included (not excluded)
        if (!filePath) {
          return true
        }

        // Exclude file if it matches ANY of the patterns
        const shouldExclude = effectivePatterns.some((pattern) => {
          const matches = path.matchesGlob(filePath, pattern)
          if (matches) {
            logger.debug?.(`Excluding '${filePath}' (matches exclude-pattern '${pattern}')`)
          }
          return matches
        })

        return !shouldExclude
      })
      return {
        name: pkg.name,
        files: files,
        coverage: CoberturaCoverageParser.calculateFileCoverage(files),
      }
    })
    .filter((pkg) => pkg.files.length > 0)

  const totalFilesAfter = filteredPackages.reduce((sum, pkg) => sum + pkg.files.length, 0)
  logger.info(
    `Filtered ${totalFilesAfter}/${totalFilesBefore} files against exclude-patterns: [${effectivePatterns.join(', ')}]`,
  )

  return filteredPackages
}
