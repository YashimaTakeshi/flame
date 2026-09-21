/**
 * レイヤーの依存方向を CI から強制する。
 * requirements.md §3 の原則③「描画コアは環境非依存に保つ」は、気をつけるのではなく
 * 違反したらビルドが落ちる形で守る。
 */
module.exports = {
  forbidden: [
    {
      name: 'core-is-pure',
      comment: 'core は他レイヤーに依存してはならない（requirements.md §3 原則③）',
      severity: 'error',
      from: { path: '^src/core' },
      to: { path: '^src/(render|worker|platform|app)' },
    },
    {
      name: 'core-no-npm-deps',
      comment: 'core が import してよい npm は zod と immer だけ',
      severity: 'error',
      from: { path: '^src/core' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
        pathNot: '^node_modules/(zod|immer)($|/)',
      },
    },
    {
      name: 'render-does-not-look-up',
      comment: 'render は app / worker / platform を知らない（描画バックエンド差し替えの前提）',
      severity: 'error',
      from: { path: '^src/render' },
      to: { path: '^src/(app|worker|platform)' },
    },
    {
      name: 'worker-scope',
      comment: 'worker が触れるのは render と core だけ',
      severity: 'error',
      from: { path: '^src/worker' },
      to: { path: '^src/(app|platform)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: '\\.d\\.ts$|^src/(main|sw)\\.tsx?$|^src/vite-env\\.d\\.ts$' },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    exclude: { path: 'node_modules' },
  },
};
