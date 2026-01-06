import * as path from 'node:path'
import type { Logger } from '../core/index.js'
import { CoberturaCoverageParser } from '../coverage/index.js'
import type { FileCoverage, PackageCoverage } from '../coverage/model.js'
import type { ChangedLinesMap } from './model.js'

/**
 * Filter coverage packages to only include files matching a glob pattern.
 */
export function filterByGlob(packages: PackageCoverage[], pattern: string, logger: Logger): PackageCoverage[] {
  const effectivePattern = pattern.includes('/') ? pattern : `**/${pattern}`
  const totalFilesBefore = packages.reduce((sum, pkg) => sum + pkg.files.length, 0)

  const filteredPackages = packages
    .map((pkg) => {
      const files = pkg.files.filter((file) => {
        const filePath = file.resolvedPath ?? file.filename
        logger.debug?.(`Filtering '${filePath}' against glob '${effectivePattern}'`)
        return path.matchesGlob(filePath, effectivePattern)
      })
      return {
        name: pkg.name,
        files: files,
        coverage: CoberturaCoverageParser.calculateFileCoverage(files),
      }
    })
    .filter((pkg) => pkg.files.length > 0)

  const totalFilesAfter = filteredPackages.reduce((sum, pkg) => sum + pkg.files.length, 0)
  logger.info(`Filtered ${totalFilesAfter}/${totalFilesBefore} files against glob '${effectivePattern}'`)

  return filteredPackages
}

/**
 * Filter coverage packages to only include lines that were changed.
 * Files without a resolvedPath are included without filtering.
 */
export function filterByChangedLines(
  packages: PackageCoverage[],
  changedLines: ChangedLinesMap,
  logger: Logger,
): PackageCoverage[] {
  const changedFilePaths = Array.from(changedLines.keys())
  logger.debug?.(`Filtering against changed files ${JSON.stringify(changedFilePaths)}`)

  const totalFilesBefore = packages.reduce((sum, pkg) => sum + pkg.files.length, 0)

  const filteredPackages = packages
    .map((pkg): PackageCoverage => {
      const files = pkg.files
        .map((file) => {
          // If no resolvedPath, include file without filtering
          if (!file.resolvedPath) {
            return file
          }
          return filterFileLines(file, changedLines.get(file.resolvedPath))
        })
        .filter((file) => file.lines.length > 0)
      return {
        name: pkg.name,
        files: files,
        coverage: CoberturaCoverageParser.calculateFileCoverage(files),
      }
    })
    .filter((pkg) => pkg.files.length > 0)

  const totalFilesAfter = filteredPackages.reduce((sum, pkg) => sum + pkg.files.length, 0)
  logger.info(`Filtered ${totalFilesAfter}/${totalFilesBefore} files against changed files`)

  return filteredPackages
}

/**
 * Filter a file's coverage to only include specified lines.
 */
function filterFileLines(file: FileCoverage, changedLineNumbers: Set<number> | undefined): FileCoverage {
  if (!changedLineNumbers || changedLineNumbers.size === 0) {
    return { ...file, lines: [], coverage: CoberturaCoverageParser.calculateCoverage([]) }
  }

  const filteredLines = file.lines.filter((line) => changedLineNumbers.has(line.lineNumber))

  return {
    ...file,
    lines: filteredLines,
    coverage: CoberturaCoverageParser.calculateCoverage(filteredLines),
  }
}
