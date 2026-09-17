import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import maplibregl from 'maplibre-gl';
import type { LandmarkModel } from './types';
import { BUILDING_LAYER_ID } from './scene';

/** 地标 3D 图层 ID */
const LANDMARK_LAYER_ID = 'panoscape-landmarks';

/** 各类地标保护圈的基础半径（米），实际半径再乘以地标缩放倍率；圈内的原生建筑挤出体会被隐藏 */
const ZONE_RADIUS_BY_KIND: Record<string, number> = {
  pagoda: 80,
  slimTower: 40,
  pavilion: 70,
  glb: 60,
};

/** 按模型种类计算保护圈半径（米） */
function zoneRadiusFor(spec: LandmarkModel): number {
  return (ZONE_RADIUS_BY_KIND[spec.kind] ?? 60) * (spec.scale ?? 1);
}

/** 白模通用材质：浅暖白 + 平面着色 + 双面渲染（局部坐标系带镜像，单面渲染会被背面剔除） */
const WHITE_MATERIAL = new THREE.MeshLambertMaterial({
  color: 0xf3f1ea,
  flatShading: true,
  side: THREE.DoubleSide,
});

/** 生成竖直圆柱/棱柱几何：将 Cylinder 默认的 Y 轴向转为场景的 Z 轴向（竖直） */
function prismGeo(rTop: number, rBottom: number, height: number, segments: number): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** 在组内放置竖直八边形柱体（base 为底部标高，align 为绕竖直轴的棱面对齐角） */
function addOctagon(group: THREE.Group, base: number, rTop: number, rBottom: number, height: number, align = 0): void {
  const mesh = new THREE.Mesh(prismGeo(rTop, rBottom, height, 8), WHITE_MATERIAL);
  mesh.position.set(0, 0, base + height / 2);
  mesh.rotation.z = align;
  group.add(mesh);
}

/** 在组内放置方体（w=东西向，d=南北向，base 为底部标高，偏移为米制东/北向量） */
function addBox(group: THREE.Group, base: number, width: number, depth: number, height: number, east = 0, north = 0): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), WHITE_MATERIAL);
  mesh.position.set(east, north, base + height / 2);
  group.add(mesh);
}

/** 在组内放置四棱锥屋顶（覆盖 w×d 的方体平面） */
function addPyramid(group: THREE.Group, base: number, width: number, depth: number, height: number): void {
  const radius = (Math.hypot(width, depth) / 2) * 1.12;
  const mesh = new THREE.Mesh(prismGeo(0.05, radius, height, 4), WHITE_MATERIAL);
  mesh.position.set(0, 0, base + height / 2);
  mesh.rotation.z = Math.PI / 4;
  group.add(mesh);
}

/** 在组内放置圆锥（塔刹顶） */
function addCone(group: THREE.Group, base: number, radius: number, height: number): void {
  const geometry = new THREE.ConeGeometry(radius, height, 8);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, WHITE_MATERIAL);
  mesh.position.set(0, 0, base + height / 2);
  group.add(mesh);
}

/**
 * 程序化生成：多层塔（雷峰塔式）。
 * 两级八边形台基 + 北向坡道 + 殿基殿顶 + 五层收分塔身/挑檐 + 塔刹，总高约 55m。
 */
function buildPagoda(): THREE.Group {
  const group = new THREE.Group();
  addOctagon(group, 0, 20, 21, 1.6);
  addOctagon(group, 1.6, 16, 16.5, 1.4, Math.PI / 8);
  addBox(group, 0, 6, 14, 1.4, 0, 24);
  addBox(group, 3, 15, 15, 3.4);
  addPyramid(group, 6.4, 17.5, 17.5, 2.4);
  let base = 8.8;
  const wallHeight = 6.2;
  const roofHeight = 2.1;
  for (let i = 0; i < 5; i++) {
    const radius = 8.2 * Math.pow(0.86, i);
    addOctagon(group, base, radius, radius * 1.08, wallHeight, Math.PI / 8);
    addOctagon(group, base + wallHeight, radius * 0.45, radius * 1.55, roofHeight, Math.PI / 8);
    base += wallHeight + roofHeight;
  }
  addCone(group, base, 0.9, 4.2);
  return group;
}

/**
 * 程序化生成：细瘦古塔（保俶塔式）。
 * 小台基 + 七层收分塔身/密檐 + 塔刹，总高约 37m。
 */
function buildSlimTower(): THREE.Group {
  const group = new THREE.Group();
  addOctagon(group, 0, 4.6, 5.2, 2.2);
  let base = 2.2;
  for (let i = 0; i < 7; i++) {
    const radius = 2.9 * Math.pow(0.9, i);
    addOctagon(group, base, radius, radius * 1.05, 3.4, Math.PI / 8);
    addOctagon(group, base + 3.4, radius * 0.4, radius * 1.45, 0.9, Math.PI / 8);
    base += 4.3;
  }
  addCone(group, base, 0.5, 4.6);
  return group;
}

/**
 * 程序化生成：多层楼阁（城隍阁式）。
 * 一层台基 + 三层收分楼身/攒尖屋顶 + 顶刹，总高约 34m。
 */
function buildPavilion(): THREE.Group {
  const group = new THREE.Group();
  addBox(group, 0, 32, 26, 1.8);
  const tiers: Array<[number, number, number]> = [
    [22, 17, 6.5],
    [16, 12.5, 5.4],
    [11, 9, 4.6],
  ];
  let base = 1.8;
  for (const [width, depth, height] of tiers) {
    addBox(group, base, width, depth, height);
    base += height;
    addPyramid(group, base, width + 5, depth + 5, 2.6);
    base += 2.6;
  }
  addBox(group, base, 4, 4, 1.4);
  addCone(group, base + 1.4, 1.6, 2.6);
  return group;
}

/** 按模型种类分发到对应的程序化生成器 */
function buildModel(kind: LandmarkModel['kind']): THREE.Group {
  if (kind === 'pagoda') return buildPagoda();
  if (kind === 'slimTower') return buildSlimTower();
  return buildPavilion();
}

/** 加载外部 GLB 模型：GLTF 为 Y-up，绕 X 轴 +90° 转为场景的 Z-up */
async function loadGlb(url: string): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const group = new THREE.Group();
  gltf.scene.rotation.x = Math.PI / 2;
  group.add(gltf.scene);
  return group;
}

/** 收集与地标保护圈重叠的原生建筑要素 id：source 查询不受图层过滤器影响，且要素 id 稳定 */
function collectHiddenIds(map: maplibregl.Map, specs: LandmarkModel[]): number[] {
  const style = map.getStyle();
  const sourceId = Object.keys(style.sources).find((key) => style.sources[key].type === 'vector');
  if (!sourceId) return [];
  const ids: number[] = [];
  const features = map.querySourceFeatures(sourceId, { sourceLayer: 'building' });
  for (const feature of features) {
    if (typeof feature.id !== 'number') continue;
    const rings = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : [];
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        for (const spec of specs) {
          const dLat = (lat - spec.lngLat[1]) * 110900;
          const dLng = (lng - spec.lngLat[0]) * 111320 * Math.cos((spec.lngLat[1] * Math.PI) / 180);
          if (Math.hypot(dLng, dLat) <= zoneRadiusFor(spec) && !ids.includes(feature.id)) {
            ids.push(feature.id);
          }
        }
      }
    }
  }
  return ids;
}

/** 把「非地标建筑要素」应用为 3D 建筑图层的过滤器 */
function applyFootprintFilter(map: maplibregl.Map, ids: number[]): void {
  if (!map.getLayer(BUILDING_LAYER_ID) || ids.length === 0) return;
  map.setFilter(BUILDING_LAYER_ID, ['!', ['match', ['id'], ids, true, false]]);
}

/**
 * 在地图上挂载地标 3D 模型（three.js 自定义 3D 图层）。
 * 以首个地标的墨卡托坐标为锚点建立米制局部空间（X 东、Y 北、Z 上），
 * 逐帧同步投影矩阵并读取地形高程使模型贴合山体；
 * 同时在 3D 建筑图层上排除与地标保护圈重叠的原生挤出体，避免与精细模型穿模。
 */
export function addLandmarkModels(map: maplibregl.Map, specs: LandmarkModel[]): void {
  if (specs.length === 0) return;
  const anchor = specs[0];
  const anchorMercator = maplibregl.MercatorCoordinate.fromLngLat(anchor.lngLat, 0);
  const metersPerUnit = anchorMercator.meterInMercatorCoordinateUnits();

  /** 当前隐藏的原生建筑要素 id 集合 */
  let hiddenIds: number[] = [];
  /** 上次收集时间戳：moveend 节流，避免频繁全量查询 */
  let lastCollect = 0;

  /** 收集隐藏 id 并应用过滤器 */
  function refreshFootprintFilter(): void {
    const now = Date.now();
    if (now - lastCollect < 3000) return;
    lastCollect = now;
    hiddenIds = collectHiddenIds(map, specs);
    applyFootprintFilter(map, hiddenIds);
  }

  const placed: { group: THREE.Group; spec: LandmarkModel }[] = [];
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;

  const layer: maplibregl.CustomLayerInterface = {
    id: LANDMARK_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    onAdd(map, gl) {
      // 底图切换（setStyle）会把自定义图层一并移除后再重挂：
      // 此时场景/渲染器/模型均已就绪，直接复用；重复初始化会泄漏 renderer 并堆积事件监听
      if (renderer && scene && camera) return;
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 1.05));
      const sun = new THREE.DirectionalLight(0xffffff, 1.9);
      sun.position.set(-600, -350, 900);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      refreshFootprintFilter();
      for (const spec of specs) {
        const group = new THREE.Group();
        group.position.set(
          (spec.lngLat[0] - anchor.lngLat[0]) * Math.cos(((spec.lngLat[1] + anchor.lngLat[1]) / 2) * (Math.PI / 180)) * 111320,
          (spec.lngLat[1] - anchor.lngLat[1]) * 111320,
          0
        );
        group.rotation.z = ((spec.rotation ?? 0) * Math.PI) / 180;
        if (spec.scale) group.scale.setScalar(spec.scale);
        scene.add(group);
        if (spec.kind === 'glb' && spec.url) {
          loadGlb(spec.url)
            .then((model) => {
              group.add(model);
              map.triggerRepaint();
            })
            .catch((error) => console.error('[panoscape] 地标 GLB 加载失败:', error));
        } else if (spec.kind !== 'glb') {
          group.add(buildModel(spec.kind));
        }
        placed.push({ group, spec });
      }
      // 底图切换重建建筑图层后，下一帧按已收集的 id 重贴过滤器
      map.on('style.load', () => {
        requestAnimationFrame(() => applyFootprintFilter(map, hiddenIds));
      });
      // 视角停止变化后重新收集（新载入瓦片中可能有保护圈内建筑）
      map.on('moveend', () => refreshFootprintFilter());
    },
    render(_gl, args) {
      if (!renderer || !scene || !camera) return;
      // defaultProjectionData.mainMatrix：墨卡托归一化空间（0..1）→ 裁剪空间，
      // 乘以锚点平移/米制缩放局部矩阵后即得到模型空间的完整投影
      const world = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const local = new THREE.Matrix4()
        .makeTranslation(anchorMercator.x, anchorMercator.y, anchorMercator.z)
        .scale(new THREE.Vector3(metersPerUnit, -metersPerUnit, metersPerUnit));
      camera.projectionMatrix = world.multiply(local);
      // 逐帧读取地形高程，使模型贴合山体（DEM 精化后自动对齐）
      for (const { group, spec } of placed) {
        if (!map.getTerrain()) continue;
        const elevation = map.queryTerrainElevation(spec.lngLat);
        if (elevation != null && Number.isFinite(elevation)) group.position.z = elevation;
      }
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  };
  /** 幂等挂载地标图层：图层已存在时跳过，避免重复 addLayer 抛错 */
  function attachLayer(): void {
    if (!map.getLayer(LANDMARK_LAYER_ID)) map.addLayer(layer);
    // 卫星影像底图上不渲染白模（与建筑挤出图层「无矢量源即不挂」的行为一致）：
    // 样式含 vector 源即为标准图，否则按纯影像处理
    const hasVectorBase = Object.values(map.getStyle().sources ?? {}).some((s) => s.type === 'vector');
    map.setLayoutProperty(LANDMARK_LAYER_ID, 'visibility', hasVectorBase ? 'visible' : 'none');
  }

  // setStyle 会移除包括本图层在内的所有自定义图层：
  // 监听 style.load 在新样式上自动重挂（renderer/scene 复用，GLB 无需重载）
  map.on('style.load', attachLayer);

  // 样式未就绪时 addLayer 会抛错，统一推迟到 load 事件后再挂载自定义图层
  if (map.isStyleLoaded()) {
    attachLayer();
  } else {
    map.once('load', attachLayer);
  }
}
