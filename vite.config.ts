import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 扫描 scenic/ 下的景区目录，生成多页构建入口表：新增景区无需修改本文件 */
function scenicInputs(): Record<string, string> {
  const scenicDir = fileURLToPath(new URL('./scenic', import.meta.url));
  const inputs: Record<string, string> = {};
  for (const entry of readdirSync(scenicDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      inputs[`scenic/${entry.name}/index`] = `${scenicDir}/${entry.name}/index.html`;
    }
  }
  return inputs;
}

export default defineConfig({
  // 相对路径产物，便于 GitHub Pages / Vercel 等静态托管直接部署
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        ...scenicInputs(),
      },
    },
  },
  server: {
    host: '0.0.0.0',
  }
});
