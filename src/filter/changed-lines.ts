import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { ChangedLinesMap } from './model.js'

const execAsync = promisify(exec)

/**
 * Ensure a commit SHA is available locally by fetching it if needed.
 * This handles the common case where actions/checkout does a shallow clone.
 *
 * @param sha - The commit SHA to ensure is available
 */
async function ensureShaAvailable(sha: string): Promise<void> {
  try {
    // Check if the commit exists locally
    await execAsync(`git cat-file -e ${sha}^{commit}`)
  } catch {
    // Commit not available locally - fetch it
    await execAsync(`git fetch origin ${sha} --depth=1`)
  }
}

/**
 * Get changed lines by comparing two commits using local git.
 * Automatically fetches missing commits if needed (for shallow clones).
 *
 * @param baseSha - The base commit SHA to compare from
 * @param headSha - The head commit SHA to compare to
 * @returns Map of filename to set of changed line numbers
 */
export async function getChangedLinesFromGit(baseSha: string, headSha: string): Promise<ChangedLinesMap> {
  // Ensure both commits are available locally
  await ensureShaAvailable(baseSha)
  await ensureShaAvailable(headSha)

  const { stdout: diffOutput } = await execAsync(`git diff ${baseSha} ${headSha}`, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
  })

  return parseDiffOutput(diffOutput)
}

/**
 * Parse full git diff output to extract changed lines per file.
 *
 * @param diffOutput - Full git diff output
 * @returns Map of filename to set of changed line numbers
 */
export function parseDiffOutput(diffOutput: string): ChangedLinesMap {
  const changedLines: ChangedLinesMap = new Map()
  const lines = diffOutput.split('\n')

  let currentFile: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Parse diff header: diff --git a/path/to/file b/path/to/file
    const diffMatch = line.match(/^diff --git a\/.+ b\/(.+)$/)
    if (diffMatch) {
      currentFile = diffMatch[1]!
      continue
    }

    // Skip deleted files (indicated by /dev/null in new file)
    if (line.startsWith('+++ /dev/null')) {
      currentFile = null
      continue
    }

    // Skip if we don't have a current file
    if (!currentFile) {
      continue
    }

    // Parse hunk and extract changed lines
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      const startLine = Number.parseInt(hunkMatch[1]!, 10)
      const hunkChangedLines = parseHunkForChangedLines(lines, i, startLine)

      // Merge with existing changed lines for this file
      const existing = changedLines.get(currentFile) ?? new Set<number>()
      for (const lineNum of hunkChangedLines) {
        existing.add(lineNum)
      }
      changedLines.set(currentFile, existing)
    }
  }

  return changedLines
}

/**
 * Parse a single hunk starting from a given index to extract changed line numbers.
 *
 * @param lines - All lines of the diff
 * @param hunkStartIndex - Index of the hunk header line
 * @param startLine - Starting line number from the hunk header
 * @returns Set of changed line numbers in this hunk
 */
function parseHunkForChangedLines(lines: string[], hunkStartIndex: number, startLine: number): Set<number> {
  const changedLines = new Set<number>()
  let currentLine = startLine

  // Start after the hunk header
  for (let i = hunkStartIndex + 1; i < lines.length; i++) {
    const line = lines[i]!

    // Stop at next hunk or diff header
    if (line.startsWith('@@') || line.startsWith('diff --git')) {
      break
    }

    // Lines starting with '-' are removed lines (don't exist in new file)
    if (line.startsWith('-')) {
      // Don't increment currentLine for removed lines
      continue
    }

    // Lines starting with '+' are added lines
    if (line.startsWith('+')) {
      changedLines.add(currentLine)
      currentLine++
      continue
    }

    // Context lines (starting with space or no prefix) exist in both versions
    currentLine++
  }

  return changedLines
}

/**
 * Parse a unified diff patch to extract added/modified line numbers.
 *
 * The patch format uses @@ -old_start,old_count +new_start,new_count @@ headers
 * followed by context lines (starting with space), removed lines (starting with -)
 * and added lines (starting with +).
 *
 * We only care about added lines (lines starting with +) as those are the
 * "new" lines that exist in the PR's version of the file.
 *
 * @param patch - Unified diff patch string
 * @returns Set of line numbers that were added/modified
 */
export function parsePatchForChangedLines(patch: string): Set<number> {
  const changedLines = new Set<number>()
  const lines = patch.split('\n')

  let currentLine = 0

  for (const line of lines) {
    // Parse hunk header: @@ -old_start,old_count +new_start,new_count @@
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      currentLine = Number.parseInt(hunkMatch[1]!, 10)
      continue
    }

    // Skip if we haven't seen a hunk header yet
    if (currentLine === 0) {
      continue
    }

    // Lines starting with '-' are removed lines (don't exist in new file)
    if (line.startsWith('-')) {
      // Don't increment currentLine for removed lines
      continue
    }

    // Lines starting with '+' are added lines
    if (line.startsWith('+')) {
      changedLines.add(currentLine)
      currentLine++
      continue
    }

    // Context lines (starting with space or no prefix) exist in both versions
    // We don't add them to changed lines, but we do increment the line counter
    currentLine++
  }

  return changedLines
}
