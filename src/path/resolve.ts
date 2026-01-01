import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Result of resolving a file path.
 */
export type PathResolutionResult = {
  /** Relative path for markdown display */
  displayPath: string
  /** Absolute path for reading file contents */
  absolutePath: string
  /** Whether the file was successfully resolved (exists on disk) */
  resolved: boolean
}

/**
 * Logger interface for path resolution warnings.
 */
export type PathLogger = {
  warning: (message: string) => void
}

/**
 * Context for path resolution.
 */
export type PathResolutionContext = {
  /** Source paths from Cobertura XML <sources> element */
  sources: string[]
  /** Custom source directory (git root or CWD) */
  sourceDir: string
  /** Logger for warnings */
  logger: PathLogger
}

/**
 * Normalize a file path by converting backslashes to forward slashes.
 */
function normalizePath(filepath: string): string {
  return filepath.replace(/\\/g, '/')
}

/**
 * Check if a file exists at the given path.
 */
async function fileExists(filepath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filepath)
    return stat.isFile()
  } catch {
    return false
  }
}

/**
 * Resolve a single file path from a coverage report.
 *
 * Resolution order:
 * 1. If absolute path: check if exists, convert to relative from sourceDir
 * 2. Try each XML source: join with filename, check if exists
 * 3. Try sourceDir: join with filename, check if exists
 * 4. If unresolved: warn and return filename as-is
 *
 * @param filename - The filename from the coverage report
 * @param context - Path resolution context
 * @returns Resolution result with display and absolute paths
 */
export async function resolveFilePath(filename: string, context: PathResolutionContext): Promise<PathResolutionResult> {
  const normalizedFilename = normalizePath(filename)
  const normalizedSourceDir = normalizePath(context.sourceDir)

  // Case 1: Absolute path
  if (path.isAbsolute(normalizedFilename)) {
    if (await fileExists(normalizedFilename)) {
      // Convert to relative path from sourceDir for display
      const relativePath = normalizePath(path.relative(normalizedSourceDir, normalizedFilename))
      // Only use relative path if it doesn't escape the sourceDir
      if (!relativePath.startsWith('..')) {
        return {
          displayPath: relativePath,
          absolutePath: normalizedFilename,
          resolved: true,
        }
      }
      // File exists but is outside sourceDir - use the absolute path
      return {
        displayPath: normalizedFilename,
        absolutePath: normalizedFilename,
        resolved: true,
      }
    }
  }

  // Case 2: Try each XML source path
  for (const source of context.sources) {
    const normalizedSource = normalizePath(source)
    const candidatePath = path.join(normalizedSource, normalizedFilename)

    if (await fileExists(candidatePath)) {
      // Calculate relative path from sourceDir
      const relativePath = normalizePath(path.relative(normalizedSourceDir, candidatePath))
      return {
        displayPath: relativePath.startsWith('..') ? normalizedFilename : relativePath,
        absolutePath: normalizePath(candidatePath),
        resolved: true,
      }
    }
  }

  // Case 3: Try sourceDir directly
  const sourceCandidate = path.join(normalizedSourceDir, normalizedFilename)
  if (await fileExists(sourceCandidate)) {
    return {
      displayPath: normalizedFilename,
      absolutePath: normalizePath(sourceCandidate),
      resolved: true,
    }
  }

  // Case 4: Unresolved - warn and return as-is
  context.logger.warning(
    `Could not resolve file path: ${filename}. ` +
      `Tried sources: [${context.sources.join(', ')}] and sourceDir: ${context.sourceDir}`,
  )

  return {
    displayPath: normalizedFilename,
    absolutePath: normalizedFilename,
    resolved: false,
  }
}

/**
 * Resolve all file paths in a coverage report.
 *
 * @param filenames - Array of filenames from coverage report
 * @param context - Path resolution context
 * @returns Map of original filename to resolution result
 */
export async function resolveFilePaths(
  filenames: string[],
  context: PathResolutionContext,
): Promise<Map<string, PathResolutionResult>> {
  const results = new Map<string, PathResolutionResult>()

  for (const filename of filenames) {
    if (!results.has(filename)) {
      const result = await resolveFilePath(filename, context)
      results.set(filename, result)
    }
  }

  return results
}
