import type { BuildInfo } from './build-info';

declare global {
  /** vite.config.ts の define で差し込まれる */
  const __BUILD__: BuildInfo;
}

export {};
