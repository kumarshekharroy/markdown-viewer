import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

const workflow = YAML.parse(readFileSync(resolve('.github/workflows/desktop-build.yml'), 'utf8'));
const script = workflow.jobs.cleanup.steps[0].with.script as string;
// Execute the actual workflow code with mocked API clients, never a live GitHub token.
const cleanup = new Function(
  'github',
  'context',
  'core',
  'process',
  `return (async () => { ${script} })();`
) as (...args: unknown[]) => Promise<void>;

const mac = 'markdown-viewer-macos-universal';
const windows = 'markdown-viewer-windows-x64';
const artifact = (id: number, runId: number, name: string) => ({
  id,
  name,
  expired: false,
  workflow_run: { id: runId }
});
type Artifact = ReturnType<typeof artifact>;
type Run = { workflow_id: number; status: string };

async function prune(
  artifacts: Artifact[],
  {
    current = 20,
    succeeded = true,
    runs = {}
  }: { current?: number; succeeded?: boolean; runs?: Record<number, Run> } = {}
) {
  const deleteArtifact = vi.fn().mockResolvedValue({});
  const github = {
    paginate: vi.fn().mockResolvedValue(artifacts),
    rest: {
      actions: {
        listArtifactsForRepo: vi.fn(),
        deleteArtifact,
        getWorkflowRun: vi.fn(async ({ run_id }: { run_id: number }) => ({
          data: runs[run_id] ?? {
            workflow_id: 7,
            status: run_id === current ? 'in_progress' : 'completed'
          }
        }))
      }
    }
  };
  await cleanup(
    github,
    { repo: { owner: 'test', repo: 'markdown-viewer' }, runId: current },
    { info: vi.fn(), warning: vi.fn() },
    { env: { BUILD_SUCCEEDED: String(succeeded) } }
  );
  return deleteArtifact.mock.calls.map(([args]) => args.artifact_id as number).sort();
}

describe('desktop artifact cleanup', () => {
  it('keeps the latest pair and never deletes unrelated workflows or artifacts', async () => {
    const deleted = await prune(
      [
        artifact(1, 10, mac),
        artifact(2, 10, windows),
        artifact(3, 20, mac),
        artifact(4, 20, windows),
        artifact(5, 15, 'web-report'),
        artifact(6, 15, mac),
        artifact(7, 15, windows)
      ],
      { runs: { 15: { workflow_id: 99, status: 'completed' } } }
    );
    expect(deleted).toEqual([1, 2]);
  });

  it('does not replace a newer build when an older build finishes later', async () => {
    expect(
      await prune(
        [
          artifact(101, 10, mac),
          artifact(102, 10, windows),
          artifact(3, 20, mac),
          artifact(4, 20, windows)
        ],
        { current: 10 }
      )
    ).toEqual([101, 102]);
  });

  it('leaves another in-progress build alone until its cleanup can run', async () => {
    expect(
      await prune(
        [
          artifact(1, 10, mac),
          artifact(2, 10, windows),
          artifact(3, 20, mac),
          artifact(4, 20, windows),
          artifact(5, 30, windows)
        ],
        { runs: { 30: { workflow_id: 7, status: 'in_progress' } } }
      )
    ).toEqual([1, 2]);
  });

  it('removes a failed build partial upload while retaining the previous complete pair', async () => {
    expect(
      await prune([artifact(1, 20, mac), artifact(2, 20, windows), artifact(3, 30, windows)], {
        current: 30,
        succeeded: false
      })
    ).toEqual([3]);
  });

  it('retains at most one upload per platform before the first complete build', async () => {
    expect(
      await prune(
        [
          artifact(1, 10, windows),
          artifact(2, 15, mac),
          artifact(3, 20, windows),
          artifact(4, 30, windows)
        ],
        { current: 30, succeeded: false }
      )
    ).toEqual([1, 3]);
  });

  it('keeps the newest upload of each platform when a workflow is rerun', async () => {
    expect(
      await prune([artifact(1, 20, mac), artifact(2, 20, mac), artifact(3, 20, windows)])
    ).toEqual([1]);
  });
});
