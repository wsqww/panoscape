import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { TIANDITU_KEY } from './config';
import 'maplibre-gl/dist/maplibre-gl.css';

/** OpenFreeMap 公共瓦片样式：免费、无需 API key，基于 OSM 真实数据 */
const OPEN_FREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/** AWS 开放数据的全球高程瓦片（Terrarium 编码），用于 3D 地形 */
const TERRAIN_TILES_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
/** 地形数据源 / 3D 建筑图层的固定 ID */
const TERRAIN_SOURCE_ID = 'panoscape-terrain';
export const BUILDING_LAYER_ID = 'panoscape-buildings-3d';

/** 建筑挤出图层的最低缩放级别：过低会渲染海量几何体，过高则预览图看不到楼宇 */
const BUILDING_MIN_ZOOM = 11;

/** 底图图层模式：standard=矢量标准图，satellite=卫星影像 */
export type BaseLayerMode = 'standard' | 'satellite';

/** Esri World Imagery 卫星底图样式（免费无 key；部分网络环境可能无法访问该域名） */
function esriSatelliteStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'satellite',
    sources: {
      'satellite-img': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '影像 © Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [{ id: 'satellite-img', type: 'raster', source: 'satellite-img' }],
  };
}

/**
 * 天地图卫星底图样式：国内直连稳定，CGCS2000 与 OSM 坐标系一致、无偏移。
 * 需要在 src/common/config.ts 填入免费申请的 TIANDITU_KEY。
 */
function tiandituSatelliteStyle(): StyleSpecification {
  const subdomains = [0, 1, 2, 3, 4, 5, 6, 7];
  return {
    version: 8,
    name: 'satellite',
    sources: {
      'satellite-img': {
        type: 'raster',
        tiles: subdomains.map(
          (i) =>
            `https://t${i}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`
        ),
        tileSize: 256,
        maxzoom: 18,
        attribution: '影像 © 国家地理信息公共服务平台 天地图',
      },
    },
    layers: [{ id: 'satellite-img', type: 'raster', source: 'satellite-img' }],
  };
}

/** 卫星底图样式：配置了天地图 key 时优先使用（国内更稳），否则回退 Esri */
function satelliteStyle(): StyleSpecification {
  return TIANDITU_KEY ? tiandituSatelliteStyle() : esriSatelliteStyle();
}

/** 底图样式表：standard=OpenFreeMap 矢量，satellite=卫星影像 */
const BASE_STYLES: Record<BaseLayerMode, string | StyleSpecification> = {
  standard: OPEN_FREEMAP_STYLE,
  get satellite(): string | StyleSpecification {
    return satelliteStyle();
  },
};

/** 场景创建选项：交互开关与各 3D 图层按需启停，入口页预览与游览页共用同一套配置 */
export interface SceneOptions {
  /** 地图挂载容器 */
  container: HTMLElement;
  /** 初始中心 [lng, lat] */
  center: [number, number];
  /** 初始缩放级别 */
  zoom: number;
  /** 初始俯仰角（度） */
  pitch: number;
  /** 初始方位角（度） */
  bearing: number;
  /** 是否响应用户交互（入口页预览设为 false），默认 true */
  interactive?: boolean;
  /** 是否渲染 OSM 真实高度 3D 建筑，默认 true */
  buildings?: boolean;
  /** 是否启用 3D 地形起伏，默认 true */
  terrain?: boolean;
  /** 最大俯仰角，默认 75 */
  maxPitch?: number;
  /** 最小缩放级别，默认 13：过低时地形透视会被 maplibre 压平且触发高程告警 */
  minZoom?: number;
  /** 隐藏版权控件（入口页预览改用自定义 ⓘ 图标），默认 false */
  hideAttribution?: boolean;
}

/** 在当前样式中探测主矢量瓦片源 ID（不同样式命名可能不同，运行时探测更稳） */
function findVectorSourceId(map: maplibregl.Map): string | null {
  const sources = map.getStyle().sources ?? {};
  return Object.keys(sources).find((key) => sources[key].type === 'vector') ?? null;
}

/** 添加 OSM 建筑挤出图层：高度取自 OpenMapTiles 的 render_height 真实字段，比例符合实际 */
function addBuildings(map: maplibregl.Map): void {
  const sourceId = findVectorSourceId(map);
  if (!sourceId) return;
  map.addLayer({
    id: BUILDING_LAYER_ID,
    type: 'fill-extrusion',
    source: sourceId,
    'source-layer': 'building',
    minzoom: BUILDING_MIN_ZOOM,
    paint: {
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 4],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], 4],
        0, '#f2efe7',
        24, '#eceade',
        60, '#e3dfd2',
        120, '#d8d3c5',
      ],
      'fill-extrusion-opacity': 0.97,
    },
  });
}

/** 添加高程数据源并启用 3D 地形；高程瓦片加载失败时自动降级为平面，不阻塞游览 */
function addTerrain(map: maplibregl.Map): void {
  map.addSource(TERRAIN_SOURCE_ID, {
    type: 'raster-dem',
    tiles: [TERRAIN_TILES_URL],
    encoding: 'terrarium',
    tileSize: 256,
    // maxzoom 取 13：与矢量瓦片最高层级对齐，避免超采样时的「高程计算」告警
    maxzoom: 13,
    attribution: '高程 © AWS Open Data',
  });
  // exaggeration 保持 1：山体与建筑比例均为真实比例
  map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1 });
  let degraded = false;
  map.on('error', (event) => {
    const sourceId = (event.error as (Error & { sourceId?: string }) | undefined)?.sourceId;
    if (!degraded && sourceId === TERRAIN_SOURCE_ID) {
      degraded = true;
      map.setTerrain(null);
      console.warn('[panoscape] 高程瓦片不可用，已降级为平面地形');
    }
  });
}

/** 设置天空与地平线雾效，增强俯瞰视角下的空间纵深；不支持 setSky 的环境静默跳过 */
function addSky(map: maplibregl.Map): void {
  const setter = (map as unknown as { setSky?: (sky: Record<string, unknown>) => void }).setSky;
  setter?.call(map, {
    'sky-color': '#79b4dd',
    'sky-horizon-blend': 0.55,
    'horizon-color': '#dcebf2',
    'horizon-fog-blend': 0.6,
    'fog-color': '#eaf2f4',
    'fog-ground-blend': 0.65,
  });
}

/** 将所有符号图层的注记改为中文优先：统一取 name:zh，缺失时回退 name（中国区域即中文名） */
function localizeLabels(map: maplibregl.Map): void {
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    if (map.getLayoutProperty(layer.id, 'text-field') === undefined) continue;
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:zh'], ['get', 'name']]);
  }
}

/** 在（新）样式上挂载场景增强图层：3D 建筑、地形、天空、中文注记。样式切换后需重新执行 */
function applySceneLayers(map: maplibregl.Map, options: { buildings: boolean; terrain: boolean }): void {
  if (options.buildings) addBuildings(map);
  if (options.terrain) addTerrain(map);
  addSky(map);
  localizeLabels(map);
}

/** 创建一张 3D 地图场景：统一底图、建筑、地形、天空与手势配置 */
export function createScene(options: SceneOptions): maplibregl.Map {
  const {
    container,
    center,
    zoom,
    pitch,
    bearing,
    interactive = true,
    buildings = true,
    terrain = true,
    maxPitch = 75,
    minZoom = 13,
    hideAttribution = false,
  } = options;
  // 构造时只传 center/zoom，pitch/bearing 统一在样式就绪后应用：
  // 开启 3D 地形时 maplibre 会按缩放级别约束俯仰角（低 zoom 压平），
  // 相机参数在图层挂载完成后一次性 jumpTo，行为最稳定
  const map = new maplibregl.Map({
    container,
    style: OPEN_FREEMAP_STYLE,
    center,
    zoom,
    maxPitch,
    minZoom,
    interactive,
    // 入口页预览隐藏版权控件（页脚已有完整署名）；游览页走 maplibre 默认版权控件
    ...(hideAttribution ? { attributionControl: false as const } : {}),
  });
  // 触屏默认双指仅缩放，手动开启旋转以支持「拖动旋转」
  map.touchZoomRotate.enableRotation();
  // 暴露地图实例，便于控制台调试与自动化测试
  (window as unknown as Record<string, unknown>).__pscMap = map;
  map.on('error', (event) => console.error('[panoscape] 地图错误:', event.error));
  // OpenFreeMap 样式引用的部分 POI 小图标在其图标集中缺失，用透明占位补齐以消除告警
  map.on('styleimagemissing', (event) => {
    if (map.hasImage(event.id)) return;
    map.addImage(event.id, { width: 1, height: 1, data: new Uint8ClampedArray(4) });
  });
  // 场景图层与相机只应用一次：'load' 在部分场景下可能重复触发，
  // 相机复位若再次执行会打断用户的飞行/浏览状态
  let sceneLayersApplied = false;
  let cameraApplied = false;
  // 底图样式可能自带灰色 3D 建筑图层（如 Liberty 的 building-3d，其表达式对缺失字段
  // 会逐要素抛出空值警告），必须在瓦片解析前（style.load）尽早隐藏——
  // 建筑渲染统一交给本项目的白模图层；style.load 持久监听以覆盖底图切换
  map.on('style.load', () => {
    for (const styleLayer of map.getStyle().layers ?? []) {
      if (styleLayer.type === 'fill-extrusion' && map.getLayer(styleLayer.id)) {
        map.setLayoutProperty(styleLayer.id, 'visibility', 'none');
      }
    }
  });
  map.on('load', () => {
    try {
      // 顺序很重要：先挂 3D 图层，最后应用相机——terrain 变更可能重置相机状态，
      // 相机应用必须放在所有样式操作之后（构造器相机同样会被丢弃，故在此显式 jumpTo）
      if (!sceneLayersApplied) {
        applySceneLayers(map, { buildings, terrain });
        sceneLayersApplied = true;
      }
      if (!cameraApplied) {
        map.jumpTo({ center, zoom, pitch, bearing });
        cameraApplied = true;
      }
    } catch (error) {
      console.error('[panoscape] 3D 图层初始化失败:', error);
    }
  });
  return map;
}

/**
 * 切换底图图层（矢量标准图 / 卫星影像）。
 * setStyle 会清空样式内自定义图层与数据源，因此在新样式就绪后重挂 3D 增强图层；
 * 相机（center/zoom/pitch/bearing）与 DOM 标记不受切换影响。
 */
export function switchBaseLayer(
  map: maplibregl.Map,
  mode: BaseLayerMode,
  options: { buildings: boolean; terrain: boolean }
): void {
  map.setStyle(BASE_STYLES[mode], { diff: false });
  map.once('style.load', () => {
    try {
      applySceneLayers(map, options);
    } catch (error) {
      console.error('[panoscape] 底图切换后 3D 图层重挂失败:', error);
    }
  });
}
