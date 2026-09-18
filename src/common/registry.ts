import type { ScenicAreaMeta } from './types';
import { westlake } from '../scenic/westlake/meta';
import { wugongshan } from '../scenic/wugongshan/meta';

/**
 * 已接入景区注册表，按接入时间先后排列（新增景区在数组末尾追加即可）。
 * 入口页展示时倒序渲染——最新接入的景区排在最前。
 * 多页构建（vite.config.ts 扫描各景区 index.html）与卡片均自动生效。
 */
export const scenicAreas: readonly ScenicAreaMeta[] = [westlake, wugongshan];

/** 按 id 查找景区元信息；未接入的 id 返回 undefined */
export function findScenicArea(id: string): ScenicAreaMeta | undefined {
  return scenicAreas.find((area) => area.id === id);
}
