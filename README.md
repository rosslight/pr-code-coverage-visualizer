# pr-code-coverage-visualizer [![ts](https://github.com/int128/typescript-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/typescript-action/actions/workflows/ts.yaml)

This is a github action which is supposed to be run for a PR and visualizes the test coverage.

Everytime this action is run, we add a comment to the PR showing the current coverage.

If the trigger is not `pull_request`, this action does nothing. Also, if the length of the comment would exceed the GitHub limit, lines are trunctuated.

## Features

- Accepts code coverage as one or multiple `cobertura.xml` files
- Visualizes coverage summary and per-file annotated snippets in the pull request

## Specification

To run this action, create a workflow as follows:

```yaml
on: pull_request

permissions:
  contents: read
  pull-requests: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # Generate coverage files
      - name: 
        uses: rosslight/pr-code-coverage-visualizer@v1
        with:
          files: |
            coverage/coverage1.xml
            coverage/coverage2.xml
          update-comment: true
```

### Inputs

| Name             | Default    | Description                                                     |
|------------------|------------|-----------------------------------------------------------------|
| `files`          | (required) | One or multiple files. Can be multiple lines. Glob is supported |
| `update-comment` | true       | Visualize for changed lines only                                |
| `path-glob`      | true       | Select subdirectories to show coverage data for                 |

### Outputs

| Name                | Description           |
|---------------------|-----------------------|
| `line-coverage`     | The line coverage     |
| `function-coverage` | The function coverage |
| `branch-coverage`   | The branch coverage   |

### Example output

![Function Coverage](https://img.shields.io/badge/Function%20Coverage-28.23%25-brightgreen.svg?style=flat)
![Line Coverage](https://img.shields.io/badge/Line%20Coverage-32.12%25-brightgreen.svg?style=flat)
![Branch Coverage](https://img.shields.io/badge/Branch%20Coverage-38.89%25-brightgreen.svg?style=flat)

**Uncovered files:**

`My rust project` (LineCoverage: 100%, BranchCoverage: 70%)
<details><summary>path/to/rust/file1.rs</summary>

```rs
...
 9 🟥 pub fn add(a: int, b: int) -> int {
10 🟥    return a + b
11 🟥 }
...
41 🟩 pub fn add(a: int, b: int) -> int {
42 🟩    return a + b
43 🟩 }
...
```
</details>

`My .NET project` (LineCoverage: 70%, BranchCoverage: 10%)
<details><summary>path/to/dotnet/file1.cs</summary>

```cs
...
 8 🟥 pub int add(int a, int b)
 9 🟥 {
10 🟥     return a + b
11 🟥 }
...
```
</details>

🟥 Not covered, 🟨 Missing branch coverage, 🟩 Covered

## Development

### Release workflow

Releases are generated from conventional commits and aggregated using release-please.

When the release-please pull request is merged into main branch, a new release is created by GitHub Actions which includes the dist/ folder.
