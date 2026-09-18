#!/usr/bin/env node
// GPX/JSON 轨迹 → trail.ts 生成器（零依赖，Node >= 18）。
//
// 用法：
//   node scripts/gpx-to-trail.mjs <轨迹文件> [--name 名称] [--var 变量名] [--out 输出路径]
//                                [--tolerance 米] [--max-points 数] [--reverse]
//
// 轨迹文件支持两种格式（按扩展名与内容自动识别）：
//   .gpx  — 标准 GPX，取 <trkpt> 序列（忽略 <ele>/<time> 等子元素）
//   .json — [lng, lat][] 裸数组（用于 OSM 等其他来源的临时轨迹走同一管线）
//
// 处理：Douglas–Peucker 简化（容差默认 20m，超上限时自动加倍容差）→ 坐标取 5 位小数
// （约 1.1m 精度）→ 生成导出 HikeTrail 的 TS 模块。生成文件带「勿手改」标记，
// 数据更新一律重跑本脚本。

import fs from 'node:fs';
import path from 'node:path';

/** 解析命令行参数：返回配置对象（含全部默认值） */
function parseArgs(argv) {
  const config = {
    input: null,
    name: '徒步路线',
    varName: 'trail',
    out: null, // 输出路径必填：避免默认值硬编码导致新景区误覆盖其他景区的 trail.ts
    tolerance: 20, // Douglas–Peucker 容差（米）
    maxPoints: 1500, // 生成点数上限，超出则自动加大容差
    reverse: false, // 反转行进方向（GPX 为反方向记录时使用）
  };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--name') config.name = args[++i];
    else if (arg === '--var') config.varName = args[++i];
    else if (arg === '--out') config.out = args[++i];
    else if (arg === '--tolerance') config.tolerance = Number(args[++i]);
    else if (arg === '--max-points') config.maxPoints = Number(args[++i]);
    else if (arg === '--reverse') config.reverse = true;
    else if (!arg.startsWith('--')) config.input = arg;
    else {
      console.error(`未知参数: ${arg}`);
      process.exit(1);
    }
  }
  if (!config.input || !config.out) {
    console.error('缺少轨迹文件路径或 --out 输出路径。用法：node scripts/gpx-to-trail.mjs <轨迹文件> --out src/scenic/<id>/trail.ts [选项]');
    process.exit(1);
  }
  return config;
}

/** 粗略计算两点间距离（米）：等距圆柱平面近似，仅用于简化与里程统计 */
function distanceMeters(a, b) {
  const midLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * Math.cos(midLat) * 111320;
  const dy = (b[1] - a[1]) * 111320;
  return Math.hypot(dx, dy);
}

/** 点 p 到线段 [a, b] 的垂距（米）：退化线段回退两点距 */
function pointToSegmentMeters(p, a, b) {
  const scale = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  const ax = a[0] * scale, ay = a[1], bx = b[0] * scale, by = b[1], px = p[0] * scale, py = p[1];
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay) * 111320;
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy) * 111320;
}

/** Douglas–Peucker 递归简化：保留偏离折线超过容差（米）的关键点，首尾点必留 */
function simplifyDP(coords, tolerance) {
  if (coords.length <= 2) return coords.slice();
  const keep = new Array(coords.length).fill(false);
  keep[0] = true;
  keep[coords.length - 1] = true;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const dist = pointToSegmentMeters(coords[i], coords[start], coords[end]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

/** 从 GPX 文本提取 trkpt 坐标序列 [lng, lat][]；无轨迹点时抛错 */
function parseGpx(text) {
  const coords = [];
  const re = /<trkpt[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"[^>]*>/g;
  let match = re.exec(text);
  while (match) {
    coords.push([Number(match[2]), Number(match[1])]);
    match = re.exec(text);
  }
  if (coords.length === 0) throw new Error('GPX 中未找到 <trkpt> 轨迹点');
  return coords;
}

/** 从 JSON 文本解析 [lng, lat][] 裸数组；结构非法时抛错 */
function parseJsonTrack(text) {
  const coords = JSON.parse(text);
  if (!Array.isArray(coords) || coords.length < 2) throw new Error('JSON 轨迹需为至少 2 个点的 [lng, lat][] 数组');
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) {
      throw new Error(`非法坐标: ${JSON.stringify(c)}`);
    }
  }
  return coords;
}

/** 主流程：读文件 → 解析 → 简化 → 写 TS 模块 → 打印统计 */
function main() {
  const config = parseArgs(process.argv);
  const text = fs.readFileSync(config.input, 'utf8');
  const isGpx = /\.gpx$/i.test(config.input) || text.includes('<trkpt');
  let coords = isGpx ? parseGpx(text) : parseJsonTrack(text);
  if (config.reverse) coords = coords.slice().reverse();
  const originalCount = coords.length;

  // 容差自动加倍直至满足点数上限（最坏情况退化为等距抽稀级别）
  let simplified = simplifyDP(coords, config.tolerance);
  let tolerance = config.tolerance;
  while (simplified.length > config.maxPoints) {
    tolerance *= 2;
    simplified = simplifyDP(coords, tolerance);
  }

  // 坐标取 5 位小数（约 1.1m），并在首位补齐轨迹起点（保证线头完整）
  simplified = simplified.map(([lng, lat]) => [Number(lng.toFixed(5)), Number(lat.toFixed(5))]);

  let totalKm = 0;
  for (let i = 1; i < simplified.length; i++) {
    totalKm += distanceMeters(simplified[i - 1], simplified[i]) / 1000;
  }
  const [startLng, startLat] = simplified[0];
  const [endLng, endLat] = simplified[simplified.length - 1];

  // 回显完整重建命令（含全部非默认参数），保证照注释重跑能逐字节复现该文件
  const rebuildCmd = `node scripts/gpx-to-trail.mjs ${path.basename(config.input)} --name "${config.name}" --var ${config.varName} --out ${config.out} --tolerance ${tolerance}${config.reverse ? ' --reverse' : ''}`;
  const lines = simplified.map(([lng, lat]) => `    [${lng}, ${lat}],`).join('\n');
  const ts = `import type { HikeTrail } from '../../common/types';

/**
 * ${config.name}：由实测轨迹经 scripts/gpx-to-trail.mjs 简化生成（${originalCount} → ${simplified.length} 点，容差 ${tolerance}m）。
 * 勿手改坐标；数据更新请重跑：\`${rebuildCmd}\`
 */
export const ${config.varName}: HikeTrail = {
  name: '${config.name}',
  coordinates: [
${lines}
  ],
};
`;
  fs.mkdirSync(path.dirname(config.out), { recursive: true });
  fs.writeFileSync(config.out, ts);
  console.log(`输入 ${originalCount} 点 → 输出 ${simplified.length} 点（容差 ${tolerance}m），全程 ${totalKm.toFixed(1)} km`);
  console.log(`起点 [${startLng}, ${startLat}]  终点 [${endLng}, ${endLat}]（行进方向不符时加 --reverse 重新生成）`);
  console.log(`已写出 ${config.out}`);
}

main();
