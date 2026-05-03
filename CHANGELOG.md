# Changelog

## [2.2.1](https://github.com/rosslight/pr-code-coverage-visualizer/compare/v2.2.0...v2.2.1) (2026-05-03)


### Bug Fixes

* Catch errors when adding a github comment and write to the step summary instead ([#15](https://github.com/rosslight/pr-code-coverage-visualizer/issues/15)) ([b0681fe](https://github.com/rosslight/pr-code-coverage-visualizer/commit/b0681fe0699c96d118f030dffcd0f1130b45bcb9))

## [2.2.0](https://github.com/rosslight/pr-code-coverage-visualizer/compare/v2.1.0...v2.2.0) (2026-01-06)


### Features

* Rework glob functionality to work by excluding specific things ([#12](https://github.com/rosslight/pr-code-coverage-visualizer/issues/12)) ([464ad7a](https://github.com/rosslight/pr-code-coverage-visualizer/commit/464ad7a76294e40d51290e1d9303176e275e8ab7))

## [2.1.0](https://github.com/rosslight/pr-code-coverage-visualizer/compare/v2.0.0...v2.1.0) (2026-01-06)


### Features

* Filter glob before changed files to calculate percentages correctly ([3bdf96f](https://github.com/rosslight/pr-code-coverage-visualizer/commit/3bdf96fd4b00d0a5478339dc713e161323477a79))


### Bug Fixes

* Add a linebreak for fully covered lines ([5e28190](https://github.com/rosslight/pr-code-coverage-visualizer/commit/5e281906948d0e40efe0598ddae88ed18744e153))
* Branch coverage calculation ([#11](https://github.com/rosslight/pr-code-coverage-visualizer/issues/11)) ([a7e62f9](https://github.com/rosslight/pr-code-coverage-visualizer/commit/a7e62f95c8efc83915004a86730787ada44d4170))

## [2.0.0](https://github.com/rosslight/pr-code-coverage-visualizer/compare/v1.1.0...v2.0.0) (2026-01-04)


### ⚠ BREAKING CHANGES

* Update runner to node24

### Features

* Add logging information to markdown generation ([5481319](https://github.com/rosslight/pr-code-coverage-visualizer/commit/5481319f393b933451654a9a3a69ff73928125fd))
* Drop non-functional function-coverage ([e239e8c](https://github.com/rosslight/pr-code-coverage-visualizer/commit/e239e8cd3c1bc2a3e60230638c303edb0a162f4a))
* Improved markdown generation with repo summary ([b486b3a](https://github.com/rosslight/pr-code-coverage-visualizer/commit/b486b3ad485fe5352f1dbafc500300af1ce36e2f))
* Refactor generator and get truncation working ([0ada9bc](https://github.com/rosslight/pr-code-coverage-visualizer/commit/0ada9bc26daa263a4257eea9aba716127b4c011d))


### Bug Fixes

* Calculate repo wide coverage correctly ([d1b88dd](https://github.com/rosslight/pr-code-coverage-visualizer/commit/d1b88dd18c5e1ff0ff0109ef1564fb6da274da44))
* Comment on open PRs only ([7468ba1](https://github.com/rosslight/pr-code-coverage-visualizer/commit/7468ba1052af8659c26a0134fb90c3dbeaf2dd4e))
* Consolidate percentage formatting ([a87a571](https://github.com/rosslight/pr-code-coverage-visualizer/commit/a87a5715cfccc7af3ca2d9f6a89d36f75e90850a))
* Ordering and whitespaces ([178c9f6](https://github.com/rosslight/pr-code-coverage-visualizer/commit/178c9f64abc7f4bd39dddffcd5ed1e20a7b2e466))
* Parse git diff files with absolute paths ([a999cfa](https://github.com/rosslight/pr-code-coverage-visualizer/commit/a999cfaa00d79a2e13324c6922d811efcc3ece62))
* Spacing between badges to ensure they are rendered in a single line ([eb9dcf9](https://github.com/rosslight/pr-code-coverage-visualizer/commit/eb9dcf9f696a2ddd72235751605c5ce644b00643))


### Build System

* Update runner to node24 ([3e8aa38](https://github.com/rosslight/pr-code-coverage-visualizer/commit/3e8aa3807da68428eb4e7beec93bac98ad8f3965))

## [1.1.0](https://github.com/rosslight/pr-code-coverage-visualizer/compare/v1.0.0...v1.1.0) (2026-01-02)

### Features
* add basic CLI entry point ([b2beeee](https://github.com/rosslight/pr-code-coverage-visualizer/commit/b2beeeec74c04bece2025b6b398466c76d6735bd))

### Bug Fixes
* Calculate ref using shas ([4a3f097](https://github.com/rosslight/pr-code-coverage-visualizer/commit/4a3f0979acf43424221eee7cc629c013546f73c9))
* Ensure shas are fetched ([af052c0](https://github.com/rosslight/pr-code-coverage-visualizer/commit/af052c0e61a8da13c8ca273128d5b72356cd9d32))
* Ensure shellInjection is not possible ([f66ecac](https://github.com/rosslight/pr-code-coverage-visualizer/commit/f66ecacfbdd4cc0eb3a2c78fa43aa219f879bfac))
* Ensure the BaseRef is fetched correctly ([eb346a5](https://github.com/rosslight/pr-code-coverage-visualizer/commit/eb346a55bb3f7748a30fdb5c25b21d0cbd5d64f5))
* Respect SourcePath config ([c6921dc](https://github.com/rosslight/pr-code-coverage-visualizer/commit/c6921dc42bec7c478a9b3dba7f953ea3fb64dbb8))

## 1.0.0 (2026-01-01)

### Features
* Add file content ([49ae69e](https://github.com/rosslight/pr-code-coverage-visualizer/commit/49ae69e72ccb8325511c6f0b30abf414b1b7f4b0))
* Add report to summary if no PR could be found ([1615e77](https://github.com/rosslight/pr-code-coverage-visualizer/commit/1615e77c69f53caafde73ae0f6585ee8aaedfd42))
* Add summary badges on the top ([e827b6b](https://github.com/rosslight/pr-code-coverage-visualizer/commit/e827b6b1896a5d00fbb0a0878b82213ef5864827))
* Add truncation support ([6fc6760](https://github.com/rosslight/pr-code-coverage-visualizer/commit/6fc67600f15e7d9790d204aee414e18cf1a71fd3))
* Emit uncovered lines only ([2635ab5](https://github.com/rosslight/pr-code-coverage-visualizer/commit/2635ab54d6c891448136e341ac70cdec548fc21e))
* Implement basic functionality ([526c8a9](https://github.com/rosslight/pr-code-coverage-visualizer/commit/526c8a9c44af437e01b5d64f02a1c37eb55dce2b))
* Implement filter strategies ([144b659](https://github.com/rosslight/pr-code-coverage-visualizer/commit/144b659c034c405c32d4c75efa6c32f02deb2e86))

### Bug Fixes
* Do not use ellipsis if there is a single line to the start/end ([3a51db7](https://github.com/rosslight/pr-code-coverage-visualizer/commit/3a51db705e734b40053d695f3d0538b4fb9a820b))
* Generate details as closed ([4384316](https://github.com/rosslight/pr-code-coverage-visualizer/commit/43843161ce1170d3ab26bfc34f214eb889b9565d))
* Properly include lines around uncovered data even if they are not part of the coverage data ([a3ba01c](https://github.com/rosslight/pr-code-coverage-visualizer/commit/a3ba01c441bb723d92cf6e3cd2a18074843c808b))
