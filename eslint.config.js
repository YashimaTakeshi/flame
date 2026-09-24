import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * この設定の要は「5つの API を唯一の入口に集約する」こと。
 *
 *   fillText / createElement('canvas') / createImageBitmap / measureText / fetch
 *
 * どれも呼べてしまうと静かに壊れる種類の API で、後から集約するのは不可能なので
 * コードを書き始める前に入れる。根拠の実測は docs/poc/ にある。
 *
 * ★ フラット設定の落とし穴 ★
 * 同じルール名を複数のブロックで指定すると、マージではなく **後勝ちで上書き** される。
 * ブロックを分けて書くと、最後のブロックの selector しか効かない（実際に踏んだ）。
 * そのため selector は1つの表にまとめ、例外のあるファイルでは
 * 「その1件を除いた全部」を再指定する。`restrict()` がその再構成をする。
 */

/** 素の呼び出しを禁止する API と、その唯一の入口 */
const RESTRICTED = {
  measureText: {
    selector: "MemberExpression[property.name='measureText']",
    message: '測定は render/measure.ts に集約する。実行層で測り直すと、プレビューと書き出しで別の値を使うことになる（docs/design.md §2.6）',
  },
  createCanvasElement: {
    selector:
      "CallExpression[callee.object.name='document'][callee.property.name='createElement'][arguments.0.value='canvas']",
    message: 'canvas の生成は render/guards.ts の createVerifiedCanvas を通す。面積上限を超えると例外を投げず透明な黒を返すため（docs/design.md §11.2）',
  },
  newOffscreenCanvas: {
    selector: "NewExpression[callee.name='OffscreenCanvas']",
    message: 'canvas の生成は render/guards.ts の createVerifiedCanvas を通す（docs/design.md §11.2）',
  },
  fontsCheck: {
    selector: "MemberExpression[property.name='check'][object.property.name='fonts']",
    message: 'document.fonts.check() は描画後に true を返すため検知に使えない。FontRegistry の台帳で判定する（docs/design.md §11.3）',
  },
  fillText: {
    selector: "MemberExpression[property.name='fillText']",
    message: 'fillText は render/ops/text.ts 経由のみ。書体の読み込み待ちを型で保証するため（docs/design.md §11.3）',
  },
  createImageBitmap: {
    selector: "CallExpression[callee.name='createImageBitmap']",
    message: 'デコードは platform/decode.ts に一本化する。経路が分かれると Orientation の扱いがずれ、プレビューと書き出しの一致が破れる（docs/design.md §16.5）',
  },
};

/** core だけに課す追加の制約。core は決定論的で、外界を知らない */
const CORE_ONLY = {
  newDate: {
    selector: "NewExpression[callee.name='Date']",
    message: 'core は現在時刻を知らない。時刻は SceneInput で渡す',
  },
  dateNow: {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'core は現在時刻を知らない。時刻は SceneInput で渡す',
  },
  mathRandom: {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: 'core は決定論的であること。ゆらぎは seed から導く',
  },
};

/** 指定したキーだけを外し、残り全部を禁止する */
const restrict = (table, ...exempt) => [
  'error',
  ...Object.entries(table)
    .filter(([key]) => !exempt.includes(key))
    .map(([, v]) => v),
];

const CORE_GLOBALS = [
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
  'fetch', 'Image', 'OffscreenCanvas', 'FontFace', 'caches', 'performance',
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.fontwork', '.geowork', 'scripts/**', 'site/**' /* 紹介ページ（静的 HTML と手元で流す道具） */, '*.cjs', 'public/**' /* 同梱の静的ファイル（boot.js は素の JS） */] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node で動くもの（テストのランナー、ビルド用のスクリプト）。
  // src に課している制約はここには掛からない。
  {
    files: ['**/*.mjs', 'vite.config.ts', 'tests/browser/runner.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly', console: 'readonly', Buffer: 'readonly', __dirname: 'readonly',
        // page.evaluate に渡す関数はブラウザ側で動く
        window: 'readonly',
      },
    },
    rules: { 'no-restricted-globals': 'off', 'no-restricted-syntax': 'off' },
  },

  // ブラウザで動くテスト（実ブラウザでの回帰テスト）
  {
    files: ['tests/browser/**/*.ts'],
    languageOptions: { globals: { window: 'readonly', console: 'readonly' } },
  },

  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // 既定: src の全ファイルで6つの API を禁止し、fetch も禁じる
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': restrict(RESTRICTED),
      'no-restricted-globals': ['error', 'fetch'],
    },
  },

  // core: 上の6つに加えて、外界と非決定性を断つ
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        ...restrict(RESTRICTED).slice(1),
        ...restrict(CORE_ONLY).slice(1)],
      'no-restricted-globals': ['error', ...CORE_GLOBALS],
    },
  },

  // ここから下は「唯一の入口」だけの例外。1件ずつ外し、残りは禁止のまま。
  {
    files: ['src/render/measure.ts'],
    rules: { 'no-restricted-syntax': restrict(RESTRICTED, 'measureText') },
  },
  {
    files: ['src/render/guards.ts'],
    rules: {
      'no-restricted-syntax': restrict(RESTRICTED, 'createCanvasElement', 'newOffscreenCanvas'),
    },
  },
  {
    files: ['src/render/ops/text.ts'],
    rules: { 'no-restricted-syntax': restrict(RESTRICTED, 'fillText') },
  },
  {
    files: ['src/platform/decode.ts'],
    rules: { 'no-restricted-syntax': restrict(RESTRICTED, 'createImageBitmap') },
  },
  {
    files: ['src/platform/net.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
);
