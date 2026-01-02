# Changelog

## [1.1.0](https://github.com/rosslight/pr-code-coverage-visualizer/compare/v1.0.0...v1.1.0) (2026-01-02)


### Features

* add basic CLI entry point ([b2beeee](https://github.com/rosslight/pr-code-coverage-visualizer/commit/b2beeeec74c04bece2025b6b398466c76d6735bd))
* Add file content ([49ae69e](https://github.com/rosslight/pr-code-coverage-visualizer/commit/49ae69e72ccb8325511c6f0b30abf414b1b7f4b0))
* Add report to summary if no PR could be found ([1615e77](https://github.com/rosslight/pr-code-coverage-visualizer/commit/1615e77c69f53caafde73ae0f6585ee8aaedfd42))
* Add summary badges on the top ([e827b6b](https://github.com/rosslight/pr-code-coverage-visualizer/commit/e827b6b1896a5d00fbb0a0878b82213ef5864827))
* Add truncation support ([6fc6760](https://github.com/rosslight/pr-code-coverage-visualizer/commit/6fc67600f15e7d9790d204aee414e18cf1a71fd3))
* Emit uncovered lines only ([2635ab5](https://github.com/rosslight/pr-code-coverage-visualizer/commit/2635ab54d6c891448136e341ac70cdec548fc21e))
* Implement basic functionality ([526c8a9](https://github.com/rosslight/pr-code-coverage-visualizer/commit/526c8a9c44af437e01b5d64f02a1c37eb55dce2b))
* Implement filter strategies ([144b659](https://github.com/rosslight/pr-code-coverage-visualizer/commit/144b659c034c405c32d4c75efa6c32f02deb2e86))


### Bug Fixes

* Calculate ref using shas ([4a3f097](https://github.com/rosslight/pr-code-coverage-visualizer/commit/4a3f0979acf43424221eee7cc629c013546f73c9))
* Do not use ellipsis if there is a single line to the start/end ([3a51db7](https://github.com/rosslight/pr-code-coverage-visualizer/commit/3a51db705e734b40053d695f3d0538b4fb9a820b))
* Ensure shas are fetched ([af052c0](https://github.com/rosslight/pr-code-coverage-visualizer/commit/af052c0e61a8da13c8ca273128d5b72356cd9d32))
* Ensure shellInjection is not possible ([f66ecac](https://github.com/rosslight/pr-code-coverage-visualizer/commit/f66ecacfbdd4cc0eb3a2c78fa43aa219f879bfac))
* Ensure the BaseRef is fetched correctly ([eb346a5](https://github.com/rosslight/pr-code-coverage-visualizer/commit/eb346a55bb3f7748a30fdb5c25b21d0cbd5d64f5))
* Generate details as closed ([4384316](https://github.com/rosslight/pr-code-coverage-visualizer/commit/43843161ce1170d3ab26bfc34f214eb889b9565d))
* Properly include lines around uncovered data even if they are not part of the coverage data ([a3ba01c](https://github.com/rosslight/pr-code-coverage-visualizer/commit/a3ba01c441bb723d92cf6e3cd2a18074843c808b))
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
