import { describe, expect, it } from 'vitest'
import { parseDiffOutput, parsePatchForChangedLines } from '../../src/filter/index.js'

describe('parsePatchForChangedLines', () => {
  it('parses simple single-line addition', () => {
    const patch = `@@ -0,0 +1 @@
+new line`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set([1]))
  })

  it('parses multi-line additions', () => {
    const patch = `@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set([1, 2, 3]))
  })

  it('handles mixed additions and context lines', () => {
    const patch = `@@ -1,5 +1,7 @@
 unchanged line 1
 unchanged line 2
+new line 3
+new line 4
 unchanged line 5
+new line 6
 unchanged line 7`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set([3, 4, 6]))
  })

  it('ignores removed lines', () => {
    const patch = `@@ -1,4 +1,3 @@
 unchanged line 1
-removed line 2
 unchanged line 3
 unchanged line 4`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set())
  })

  it('handles modifications (remove + add)', () => {
    const patch = `@@ -1,3 +1,3 @@
 unchanged line 1
-old line 2
+new line 2
 unchanged line 3`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set([2]))
  })

  it('handles multiple hunks', () => {
    const patch = `@@ -1,3 +1,4 @@
 line 1
+added at line 2
 line 3
 line 4
@@ -10,3 +11,4 @@
 line 11
 line 12
+added at line 13
 line 14`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set([2, 13]))
  })

  it('handles hunk with only deletions', () => {
    const patch = `@@ -1,5 +1,3 @@
 line 1
-deleted line 2
-deleted line 3
 line 4
 line 5`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set())
  })

  it('handles empty patch', () => {
    const patch = ''

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set())
  })

  it('handles patch without hunk header', () => {
    const patch = `+some line
-another line`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set())
  })

  it('handles complex real-world patch', () => {
    // Simulating a more realistic TypeScript file change
    const patch = `@@ -1,10 +1,15 @@
 import { something } from './module'
+import { newImport } from './new-module'
 
 export function existingFunction() {
-  return 'old implementation'
+  return 'new implementation'
 }
 
+export function newFunction() {
+  return 'brand new'
+}
+
 export const constant = 42`

    const result = parsePatchForChangedLines(patch)

    // Line 2: new import
    // Line 5: modified return statement
    // Lines 8-11: new function
    expect(result).toEqual(new Set([2, 5, 8, 9, 10, 11]))
  })

  it('handles hunk starting at line other than 1', () => {
    const patch = `@@ -50,3 +50,5 @@
 existing line 50
+new line 51
+new line 52
 existing line 53
 existing line 54`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set([51, 52]))
  })

  it('handles hunk with no old line count', () => {
    // Sometimes git shows @@ -0,0 +1,3 @@ for new files
    const patch = `@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set([1, 2, 3]))
  })

  it('handles hunk without comma in counts', () => {
    // When only 1 line is affected, git may show @@ -5 +5 @@ instead of @@ -5,1 +5,1 @@
    const patch = `@@ -5 +5 @@
-old line
+new line`

    const result = parsePatchForChangedLines(patch)

    expect(result).toEqual(new Set([5]))
  })

  it('handles context lines without space prefix (edge case)', () => {
    // Some git configurations may not add space prefix for context
    const patch = `@@ -1,3 +1,4 @@
line 1
+added line
line 3
line 4`

    const result = parsePatchForChangedLines(patch)

    // "line 1" increments counter, then "+added line" at position 2
    expect(result).toEqual(new Set([2]))
  })

  it('tracks line numbers correctly with multiple deletions', () => {
    const patch = `@@ -1,6 +1,4 @@
 line 1
-deleted 2
-deleted 3
 line 4
+new line 5
 line 6`

    const result = parsePatchForChangedLines(patch)

    // After line 1, two deletions don't affect new line counter
    // line 4 is at position 2, new line is at position 3
    expect(result).toEqual(new Set([3]))
  })
})

describe('parseDiffOutput', () => {
  it('parses single file diff', () => {
    const diff = `diff --git a/src/file.ts b/src/file.ts
index abc123..def456 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@
 line 1
+new line
 line 3
 line 4`

    const result = parseDiffOutput(diff)

    expect(result.size).toBe(1)
    expect(result.get('src/file.ts')).toEqual(new Set([2]))
  })

  it('parses multiple file diffs', () => {
    const diff = `diff --git a/src/file1.ts b/src/file1.ts
index abc123..def456 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,2 +1,3 @@
 line 1
+added in file1
 line 2
diff --git a/src/file2.ts b/src/file2.ts
index 111222..333444 100644
--- a/src/file2.ts
+++ b/src/file2.ts
@@ -5,2 +5,3 @@
 line 5
+added in file2
 line 6`

    const result = parseDiffOutput(diff)

    expect(result.size).toBe(2)
    expect(result.get('src/file1.ts')).toEqual(new Set([2]))
    expect(result.get('src/file2.ts')).toEqual(new Set([6]))
  })

  it('handles new file', () => {
    const diff = `diff --git a/src/newfile.ts b/src/newfile.ts
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/src/newfile.ts
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`

    const result = parseDiffOutput(diff)

    expect(result.size).toBe(1)
    expect(result.get('src/newfile.ts')).toEqual(new Set([1, 2, 3]))
  })

  it('skips deleted files', () => {
    const diff = `diff --git a/src/deleted.ts b/src/deleted.ts
deleted file mode 100644
index abc123..0000000
--- a/src/deleted.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-line 1
-line 2
-line 3`

    const result = parseDiffOutput(diff)

    expect(result.size).toBe(0)
  })

  it('handles multiple hunks in same file', () => {
    const diff = `diff --git a/src/file.ts b/src/file.ts
index abc123..def456 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@
 line 1
+added at 2
 line 3
 line 4
@@ -10,3 +11,4 @@
 line 11
+added at 12
 line 13
 line 14`

    const result = parseDiffOutput(diff)

    expect(result.size).toBe(1)
    expect(result.get('src/file.ts')).toEqual(new Set([2, 12]))
  })

  it('handles empty diff', () => {
    const diff = ''

    const result = parseDiffOutput(diff)

    expect(result.size).toBe(0)
  })

  it('handles renamed files', () => {
    const diff = `diff --git a/old/path.ts b/new/path.ts
similarity index 90%
rename from old/path.ts
rename to new/path.ts
index abc123..def456 100644
--- a/old/path.ts
+++ b/new/path.ts
@@ -1,3 +1,4 @@
 line 1
+new line
 line 3
 line 4`

    const result = parseDiffOutput(diff)

    expect(result.size).toBe(1)
    expect(result.get('new/path.ts')).toEqual(new Set([2]))
  })
})
