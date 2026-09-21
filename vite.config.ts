import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    // 大きいアセット（和文フォント・世界の地名）は別チャンクのまま遅延で読ませる。
    // インライン化されると初回ロードに載ってしまう。
    assetsInlineLimit: 4096,
  },
  worker: { format: 'es' },
});
