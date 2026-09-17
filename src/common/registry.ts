import type { ScenicAreaMeta } from './types';
import { westlake } from '../scenic/westlake/meta';

/**
 * 已接入景区注册表。
 * 新增景区：在 src/scenic/<id>/ 新建 meta.ts 后，在此数组追加即可，
 * 入口页卡片与多页构建（vite.config.ts 扫描各景区 index.html）都会自动生效。
 */
export const scenicAreas: readonly ScenicAreaMeta[] = [westlake];

/** 按 id 查找景区元信息；未接入的 id 返回 undefined */
export function findScenicArea(id: string): ScenicAreaMeta | undefined {
  return scenicAreas.find((area) => area.id === id);
}
