import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

// Compile the framework-independent playback module with the project's existing
// TypeScript toolchain, then exercise it using Node's built-in test runner.
const root = fileURLToPath(new URL("../", import.meta.url));
const output = mkdtempSync(join(tmpdir(), "seens-playback-tests-"));
try {
  const program = ts.createProgram([join(root, "src/features/player/playback-session.ts")], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    strict: true,
    skipLibCheck: true,
    rootDir: join(root, "src"),
    outDir: output,
    noEmitOnError: true,
  });
  const result = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  if (diagnostics.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (name) => name,
      getNewLine: () => "\n",
    }));
  }
  writeFileSync(join(output, "package.json"), '{"type":"commonjs"}');
  const tests = spawnSync(process.execPath, ["--test", join(root, "tests/playback-session.test.cjs")], {
    stdio: "inherit",
    env: { ...process.env, SEENS_TEST_BUILD_DIR: output },
  });
  if (tests.error) throw tests.error;
  process.exitCode = tests.status ?? 1;
} finally {
  rmSync(output, { recursive: true, force: true });
}
