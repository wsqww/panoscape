import * as maplibregl from 'maplibre-gl';
import type { HikeTrail } from './types';

/** 徒步路线 GeoJSON 数据源 ID */
const TRAIL_SOURCE_ID = 'panoscape-trail';

/** 路线描边（衬底）图层 ID：深色半透明底线，保证浅色底图与卫星影像上都可读 */
const TRAIL_CASING_LAYER_ID = 'panoscape-trail-casing';

/** 路线主线图层 ID */
const TRAIL_LINE_LAYER_ID = 'panoscape-trail-line';

/** 路线方向箭头图层 ID：沿线的行进方向指示 */
const TRAIL_ARROW_LAYER_ID = 'panoscape-trail-arrows';

/** 方向箭头图标在样式中的图片 ID（setStyle 会清掉图片，重挂时需重新添加） */
const TRAIL_ARROW_IMAGE_ID = 'psc-trail-arrow';

/** 主线颜色：取设计令牌 --psc-accent 的金色，绿底/影像底上都醒目 */
const TRAIL_COLOR = '#d8b56a';

/** 衬底颜色：深棕半透明，模拟轨迹常见的「描边」质感 */
const TRAIL_CASING_COLOR = 'rgba(43, 34, 22, 0.55)';

/**
 * 用离屏 canvas 绘制一枚指向 +X（东）的实心三角箭头，作为沿线方向图标。
 * 参数无；返回图片数据（48×48、2 倍像素密度，实际显示 24px）。
 */
function makeArrowImage(): maplibregl.StyleImageInterface {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  /** 箭头轮廓：细长三角，尖端朝右（icon-rotation-alignment: map 时随线路方向旋转） */
  ctx.beginPath();
  ctx.moveTo(10, 8);
  ctx.lineTo(40, 24);
  ctx.lineTo(10, 40);
  ctx.lineTo(18, 24);
  ctx.closePath();
  ctx.fillStyle = TRAIL_COLOR;
  ctx.strokeStyle = 'rgba(43, 34, 22, 0.85)';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

/**
 * 在地图上常显挂载徒步路线（GeoJSON 折线 + 衬边 + 方向箭头，贴地形渲染）。
 * 参数 map：目标地图实例；参数 trails：路线清单（每条一个 LineString 要素）。
 * 副作用：添加 source/layer/图片，并注册 style.load 持久监听——切底图 setStyle
 * 移除本模块资源后自动重挂（与 landmarks.ts 的幂等模式一致）。
 */
export function addTrails(map: maplibregl.Map, trails: HikeTrail[]): void {
  if (trails.length === 0) return;
  const featureCollection: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: 'FeatureCollection',
    features: trails.map((trail) => ({
      type: 'Feature',
      properties: { name: trail.name },
      geometry: { type: 'LineString', coordinates: trail.coordinates },
    })),
  };

  /** 幂等挂载全部路线资源：已存在的部分跳过，缺失的补齐（首次挂载与切底图重挂共用） */
  function attach(): void {
    if (!map.getSource(TRAIL_SOURCE_ID)) {
      map.addSource(TRAIL_SOURCE_ID, { type: 'geojson', data: featureCollection });
    }
    // setStyle 会清空样式图片：重挂时按需重建方向箭头
    if (!map.hasImage(TRAIL_ARROW_IMAGE_ID)) {
      map.addImage(TRAIL_ARROW_IMAGE_ID, makeArrowImage(), { pixelRatio: 2 });
    }
    if (!map.getLayer(TRAIL_CASING_LAYER_ID)) {
      map.addLayer({
        id: TRAIL_CASING_LAYER_ID,
        type: 'line',
        source: TRAIL_SOURCE_ID,
        paint: {
          'line-color': TRAIL_CASING_COLOR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4.5, 16, 8],
          'line-opacity': 0.9,
        },
      });
    }
    if (!map.getLayer(TRAIL_LINE_LAYER_ID)) {
      map.addLayer({
        id: TRAIL_LINE_LAYER_ID,
        type: 'line',
        source: TRAIL_SOURCE_ID,
        paint: {
          'line-color': TRAIL_COLOR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2.6, 16, 4.8],
          'line-opacity': 0.95,
        },
      });
    }
    if (!map.getLayer(TRAIL_ARROW_LAYER_ID)) {
      map.addLayer({
        id: TRAIL_ARROW_LAYER_ID,
        type: 'symbol',
        source: TRAIL_SOURCE_ID,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 200,
          'icon-image': TRAIL_ARROW_IMAGE_ID,
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.45, 16, 0.7],
        },
      });
    }
  }

  // setStyle（切底图）会移除 source/layer/图片：监听 style.load 在新样式上自动重挂
  map.on('style.load', attach);

  // 样式未就绪时挂载会抛错：推迟到 load 事件后再挂
  if (map.isStyleLoaded()) {
    attach();
  } else {
    map.once('load', attach);
  }
}
