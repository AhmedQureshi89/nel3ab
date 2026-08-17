// REQ-1.6 — the non-vacuous test harness.
//
// `vitest run` alone is NOT enough. Measured 2026-08-17: with
// `passWithNoTests: false` set on every project, deleting one project's only
// test file still exits 0 ("Test Files 5 passed (5)") — Vitest only fails when
// the *whole* run collects nothing. A project silently dropping out of
// collection is exactly the vacuous green this phase exists to prevent
// (specs.md §2.9, verification.md §10), so this script asserts the collected
// count instead of trusting the exit code.
//
// It runs Vitest once, with the JSON reporter alongside the default one, then
// asserts that every workspace project on disk contributed at least one
// collected test file. The expected count is derived from the workspace itself,
// not hard-coded, so adding a seventh project without a test also fails.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const slash = (p) => p.replaceAll('\\', '/')

/** Every workspace member: a directory under apps/* or packages/* with a manifest. */
const workspaceProjects = ['apps', 'packages']
  .flatMap((group) =>
    readdirSync(join(repoRoot, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${group}/${entry.name}`),
  )
  .filter((dir) => existsSync(join(repoRoot, dir, 'package.json')))
  .sort()

const outDir = mkdtempSync(join(tmpdir(), 'nel3ab-vitest-'))
const reportPath = join(outDir, 'report.json')
const vitestBin = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs')

const result = spawnSync(
  process.execPath,
  [
    vitestBin,
    'run',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${reportPath}`,
    ...process.argv.slice(2),
  ],
  { cwd: repoRoot, stdio: 'inherit' },
)

const fail = (message) => {
  console.error(`\n[check-collected-tests] FAIL: ${message}`)
  rmSync(outDir, { recursive: true, force: true })
  process.exit(1)
}

if (result.status !== 0) {
  console.error(`\n[check-collected-tests] vitest exited ${result.status}`)
  rmSync(outDir, { recursive: true, force: true })
  process.exit(result.status === null ? 1 : result.status)
}

if (!existsSync(reportPath)) fail('vitest produced no JSON report')

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
rmSync(outDir, { recursive: true, force: true })

const files = [...new Set((report.testResults ?? []).map((r) => slash(r.name)))]
const owned = new Map(workspaceProjects.map((p) => [p, []]))
for (const file of files) {
  const owner = workspaceProjects.find((p) => file.includes(`/${p}/`))
  if (owner) owned.get(owner).push(file)
}

const empty = workspaceProjects.filter((p) => owned.get(p).length === 0)
const orphans = files.filter((f) => !workspaceProjects.some((p) => f.includes(`/${p}/`)))

console.error(
  `\n[check-collected-tests] ${files.length} test file(s) across ` +
    `${workspaceProjects.length} workspace project(s); ` +
    `${report.numPassedTests} assertion(s) passed, ${report.numFailedTests} failed.`,
)
for (const project of workspaceProjects) {
  console.error(`  ${project}: ${owned.get(project).length} file(s)`)
}

if (report.success !== true) fail('vitest reported success: false')
if (report.numFailedTests > 0) fail(`${report.numFailedTests} failing test(s)`)
if (empty.length > 0) fail(`no tests collected for: ${empty.join(', ')}`)
if (orphans.length > 0) fail(`test file outside any workspace project: ${orphans.join(', ')}`)
if (files.length < workspaceProjects.length) {
  fail(`collected ${files.length} test file(s) for ${workspaceProjects.length} project(s)`)
}
if (report.numPassedTests < workspaceProjects.length) {
  fail(`${report.numPassedTests} passing assertion(s) for ${workspaceProjects.length} project(s)`)
}

console.error('[check-collected-tests] OK')
