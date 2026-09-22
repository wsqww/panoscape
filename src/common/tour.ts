import * as maplibregl from 'maplibre-gl';
import type { BaseLayerMode } from './scene';
import { createScene, switchBaseLayer } from './scene';
import { addLandmarkModels } from './landmarks';
import { addTrails } from './trail';
import { closePanoOverlay, isPanoOverlayOpen, openPanoOverlay } from './pano';
import { BAIDU_MAP_AK } from './config';
import type { FlightCamera } from './flight';
import { bearingBetween, distanceMeters, flyPathFlight } from './flight';
import type { Attraction, ScenicAreaMeta } from './types';
import './base.css';
import './tour.css';

/** 景点飞行视角缺省值：未单独配置 zoom/pitch 的景点统一使用 */
const DEFAULT_VIEW = { zoom: 16.4, pitch: 62 } as const;

/** 景点距景区中心小于该距离（米）时不再自动计算朝向，直接沿用全景视角，避免原地打转 */
const MIN_LOOK_DISTANCE_METERS = 400;

/** 地图缩放超过该级别后自动展开全部标记名称 */
const LABEL_MIN_ZOOM = 13.5;

/** 原生 flyTo 飞行动画时长（毫秒）：平缓景区（无高差钳制风险）直接使用 */
const FLY_DURATION_MS = 3800;

/** 手动路径飞行动画时长（毫秒）：3200ms 基础 + 每米 0.55ms，落在 [3200, 10000] 区间 */
const FLIGHT_DURATION = { min: 3200, max: 10000, base: 3200, perMeter: 0.55 } as const;

/** 底图切换控件：单 icon 按钮点击切换，外观与缩放按钮一致（参考高德地图「卫星」按钮） */
class BaseLayerSwitchControl implements maplibregl.IControl {
  /** 两种视角下的悬停提示 */
  private static readonly TITLES = {
    standard: '切换到卫星影像',
    satellite: '切换到标准地图',
  } as const;

  /** 卫星小图标（卫星本体 + 两侧太阳能板 + 地面信号弧线） */
  private static readonly ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4 6-6-4-4Z"/><path d="m16 8 3-3"/><path d="M9 21a6 6 0 0 0-6-6"/></svg>';

  private map: maplibregl.Map | null = null;
  private mode: BaseLayerMode = 'standard';
  private button: HTMLButtonElement | null = null;

  /** 构造时可指定初始底图模式（景区 meta 配置 satellite 时控件以高亮态出现） */
  constructor(initialMode: BaseLayerMode = 'standard') {
    this.mode = initialMode;
  }

  /** 控件挂载：构建 icon 按钮并绑定切换事件 */
  onAdd(map: maplibregl.Map): HTMLElement {
    this.map = map;
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group psc-layer-switch';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'psc-layer-btn';
    const title = BaseLayerSwitchControl.TITLES[this.mode];
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = BaseLayerSwitchControl.ICON;
    button.classList.toggle('active', this.mode === 'satellite');
    button.addEventListener('click', () => this.toggle());
    container.appendChild(button);
    this.button = button;
    return container;
  }

  /** 点击切换底图并同步高亮与悬停提示 */
  private toggle(): void {
    if (!this.map || !this.button) return;
    this.mode = this.mode === 'standard' ? 'satellite' : 'standard';
    switchBaseLayer(this.map, this.mode, { buildings: true, terrain: true });
    // 卫星模式下高亮按钮，提示当前处于影像底图
    this.button.classList.toggle('active', this.mode === 'satellite');
    const title = BaseLayerSwitchControl.TITLES[this.mode];
    this.button.title = title;
    this.button.setAttribute('aria-label', title);
  }

  /** 控件卸载 */
  onRemove(): void {
    this.button = null;
    this.map = null;
  }
}

/** 组装某景点的飞行相机参数：view 缺省字段回退默认值，bearing 缺省时朝向景区中心 */
function cameraForAttraction(meta: ScenicAreaMeta, attraction: Attraction): {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
} {
  const zoom = attraction.view?.zoom ?? DEFAULT_VIEW.zoom;
  const pitch = attraction.view?.pitch ?? DEFAULT_VIEW.pitch;
  let bearing = attraction.view?.bearing;
  if (bearing === undefined) {
    const distance = distanceMeters(attraction.lngLat, meta.center);
    bearing = distance >= MIN_LOOK_DISTANCE_METERS
      ? bearingBetween(attraction.lngLat, meta.center)
      : meta.overview.bearing;
  }
  return { center: attraction.lngLat, zoom, pitch, bearing };
}

/**
 * 挂载通用游览界面：创建 3D 场景、生成景点标记与侧栏导览、绑定飞行与卡片交互。
 * 参数 root：页面根容器（会被填充为整个游览界面）；
 * 参数 meta：景区元数据（含景点清单与全景视角）；
 * 副作用：向 root 写入 DOM，创建地图实例并注册全局键盘事件。
 */
export function mountTour(root: HTMLElement, meta: ScenicAreaMeta): void {
  root.classList.add('psc-tour');
  root.innerHTML = `
    <div class="psc-map"></div>
    <header class="psc-topbar">
      <a class="psc-back" href="../../index.html">← 选择景区</a>
      <div class="psc-title">
        <span class="psc-title-name">${meta.name}</span>
        <span class="psc-title-sub">${meta.subtitle}</span>
      </div>
      <button type="button" class="psc-sidebar-toggle">景点 ☰</button>
    </header>
    <aside class="psc-sidebar">
      <div class="psc-sidebar-head">
        <h2>景点导览</h2>
        <p>共 ${meta.attractions.length} 处 · 点击飞行</p>
      </div>
      <div class="psc-sidebar-list"></div>
    </aside>
    <section class="psc-card" aria-live="polite">
      <button type="button" class="psc-card-close" aria-label="关闭介绍">✕</button>
      <img class="psc-card-photo" hidden alt="" />
      <span class="psc-card-group"></span>
      <h2 class="psc-card-name"></h2>
      <p class="psc-card-summary"></p>
      <button type="button" class="psc-card-pano">360° 全景</button>
      <div class="psc-card-tip" hidden></div>
    </section>
    <div class="psc-bottom">
      <div class="psc-bottom-actions">
        <button type="button" class="psc-overview">回到全景</button>
        ${BAIDU_MAP_AK ? '' : '<button type="button" class="psc-pano-entry" hidden>360° 全景</button>'}
      </div>
      <span class="psc-hint">滚轮缩放 · 左键拖动平移 · 右键或 Ctrl＋左键拖动旋转俯仰</span>
    </div>
    <div class="psc-loader">
      <div class="psc-loader-cn">境游</div>
      <div class="psc-loader-en">PANOSCAPE</div>
      <div class="psc-loader-ring"></div>
    </div>
    <div class="psc-lightbox" aria-modal="true" role="dialog">
      <button type="button" class="psc-lightbox-close" aria-label="关闭大图">✕</button>
      <img class="psc-lightbox-img" alt="" />
      <div class="psc-lightbox-caption"></div>
    </div>
  `;

  const mapHost = root.querySelector<HTMLDivElement>('.psc-map')!;
  const cardEl = root.querySelector<HTMLElement>('.psc-card')!;
  const cardPhotoEl = root.querySelector<HTMLImageElement>('.psc-card-photo')!;
  const cardGroupEl = root.querySelector<HTMLElement>('.psc-card-group')!;
  const cardNameEl = root.querySelector<HTMLElement>('.psc-card-name')!;
  const cardSummaryEl = root.querySelector<HTMLElement>('.psc-card-summary')!;
  const panoBtnEl = root.querySelector<HTMLButtonElement>('.psc-card-pano')!;
  const cardTipEl = root.querySelector<HTMLElement>('.psc-card-tip')!;
  const listEl = root.querySelector<HTMLDivElement>('.psc-sidebar-list')!;
  const sidebarEl = root.querySelector<HTMLElement>('.psc-sidebar')!;
  const loaderEl = root.querySelector<HTMLElement>('.psc-loader')!;
  const lightboxEl = root.querySelector<HTMLElement>('.psc-lightbox')!;
  const lightboxImg = root.querySelector<HTMLImageElement>('.psc-lightbox-img')!;
  const lightboxCaption = root.querySelector<HTMLElement>('.psc-lightbox-caption')!;

  /* 景点全景按钮仅在百度模式下展示；AK 留空时改由底部景区级入口提供 720 云漫游 */
  panoBtnEl.hidden = !BAIDU_MAP_AK;
  /* 景区级 720 云入口：配置了 pano720 时点亮底部「360° 全景」按钮 */
  const panoEntryEl = root.querySelector<HTMLButtonElement>('.psc-pano-entry');
  const pano720Ready =
    typeof meta.pano720 === 'string' ? meta.pano720.length > 0 : (meta.pano720?.length ?? 0) > 0;
  if (panoEntryEl && pano720Ready) {
    panoEntryEl.hidden = false;
    panoEntryEl.addEventListener('click', () => {
      openPanoOverlay({ name: meta.name, lngLat: meta.center }, { pano720: meta.pano720 });
    });
  }

  const map = createScene({
    container: mapHost,
    center: meta.center,
    zoom: meta.overview.zoom,
    pitch: meta.overview.pitch,
    bearing: meta.overview.bearing,
    minZoom: meta.minZoom,
    baseLayer: meta.baseLayer,
  });

  /* 飞行引擎常驻监听用户交互（拖动/缩放/触摸）：飞行途中用户一动手立即中止动画，
     把相机完整交还给用户（flightSeq 序号并发保护见 flyToAttraction） */
  let interacted = false;
  const markInteracted = (): void => { interacted = true; };
  map.on('mousedown', markInteracted);
  map.on('wheel', markInteracted);
  map.on('touchstart', markInteracted);
  map.on('dragstart', markInteracted);

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.FullscreenControl(), 'top-right');
  map.addControl(new BaseLayerSwitchControl(meta.baseLayer ?? 'standard'), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');
  if (meta.landmarks?.length) {
    try {
      addLandmarkModels(map, meta.landmarks);
    } catch (error) {
      // 地标挂载失败不应阻断整个游览页（地图与景点交互保持可用）
      console.error('[panoscape] 地标模型挂载失败:', error);
    }
  }
  if (meta.trails?.length) {
    try {
      addTrails(map, meta.trails);
    } catch (error) {
      // 路线挂载失败不应阻断整个游览页（地图与景点交互保持可用）
      console.error('[panoscape] 徒步路线挂载失败:', error);
    }
  }

  /** 景点 id → 地图标记元素，用于选中态同步 */
  const markers = new Map<string, HTMLElement>();

  /* 侧栏按分组渲染：保持 attractions 中分组首次出现的顺序 */
  const groups: { name: string; items: { attraction: Attraction; index: number }[] }[] = [];
  meta.attractions.forEach((attraction, index) => {
    let group = groups.find((g) => g.name === attraction.group);
    if (!group) {
      group = { name: attraction.group, items: [] };
      groups.push(group);
    }
    group.items.push({ attraction, index });
  });
  listEl.innerHTML = groups
    .map(
      (group) => `
      <div class="psc-group-title">${group.name}</div>
      ${group.items
        .map(
          ({ attraction, index }) => `
          <button type="button" class="psc-item" data-id="${attraction.id}">
            <span class="psc-item-num">${String(index + 1).padStart(2, '0')}</span>
            <span>${attraction.name}</span>
          </button>`
        )
        .join('')}`
    )
    .join('');

  /* 高程数据按需异步加载：就绪前地形按平面渲染，此时起飞会看到地形在飞行途中隆起，
     观感突兀。就绪信号 = 首次 idle（地图完全静默，含高程瓦片全部加载完毕）+ 800ms 缓冲；
     就绪前禁用景点交互（侧栏与标记变暗）。8 秒兜底强制放开——地形加载失败时
     scene.ts 已降级为平面，无地形可等 */
  root.classList.add('psc-notready');
  map.once('idle', () => {
    window.setTimeout(() => root.classList.remove('psc-notready'), 800);
  });
  window.setTimeout(() => root.classList.remove('psc-notready'), 8000);

  /** 隐藏景点卡片 */
  function hideCard(): void {
    cardEl.classList.remove('visible');
  }

  /** 填充并显示景点介绍卡片 */
  function showCard(attraction: Attraction): void {
    if (attraction.photo) {
      cardPhotoEl.src = attraction.photo;
      cardPhotoEl.alt = `${attraction.name} 实景图`;
      cardPhotoEl.hidden = false;
    } else {
      cardPhotoEl.hidden = true;
    }
    cardGroupEl.textContent = attraction.group;
    cardNameEl.textContent = attraction.name;
    cardSummaryEl.textContent = attraction.summary;
    cardPhotoEl.onclick = (): void => {
      if (attraction.photo) openLightbox(attraction);
    };
    /* 进入该景点的 360° 实景全景（仅百度模式展示按钮）：以当前地图朝向作为初始视角 */
    panoBtnEl.onclick = (): void => {
      openPanoOverlay(attraction, { heading: map.getBearing() });
    };
    if (attraction.tip) {
      cardTipEl.textContent = `贴士 · ${attraction.tip}`;
      cardTipEl.hidden = false;
    } else {
      cardTipEl.hidden = true;
    }
    cardEl.classList.add('visible');
  }

  /* 飞行序号：连续快速切换景点时，仅让最后一次飞行继续写相机 */
  let flightSeq = 0;

  /**
   * 平滑飞行到景点视角：高差大的景区（meta.manualFlight）走手动路径飞行引擎——
   * 直线航迹 + 显式平滑海拔 + 注视目的地朝向，规避地形钳制导致的落地偏移与颠簸；
   * 平缓景区直接用原生 flyTo（地图自带的丝滑缓动，无高差场景无钳制风险）。
   */
  function flyToAttraction(attraction: Attraction): void {
    const camera = cameraForAttraction(meta, attraction);
    const seq = ++flightSeq;
    interacted = false;
    if (meta.manualFlight) {
      const c = map.getCenter();
      const from: FlightCamera = {
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };
      flyPathFlight({
        map,
        from,
        to: { center: attraction.lngLat, zoom: camera.zoom, pitch: camera.pitch, bearing: camera.bearing },
        durationMs: Math.min(
          FLIGHT_DURATION.max,
          Math.max(
            FLIGHT_DURATION.min,
            FLIGHT_DURATION.base + distanceMeters(from.center, attraction.lngLat) * FLIGHT_DURATION.perMeter
          )
        ),
        shouldCancel: () => seq !== flightSeq || interacted,
      });
    } else {
      map.flyTo({ ...camera, duration: FLY_DURATION_MS, curve: 1.5, essential: true });
    }
  }
  /** 移动端下选中景点后收起抽屉侧栏（桌面端无效果） */
  function closeSidebarOnMobile(): void {
    sidebarEl.classList.remove('open');
  }

  /** 选中景点：同步标记/侧栏高亮、弹出卡片并飞行；高程未就绪时忽略点击 */
  function select(attraction: Attraction): void {
    if (root.classList.contains('psc-notready')) return;
    markers.forEach((el, id) => el.classList.toggle('active', id === attraction.id));
    listEl.querySelectorAll('.psc-item').forEach((el) => {
      el.classList.toggle('active', (el as HTMLElement).dataset.id === attraction.id);
    });
    showCard(attraction);
    flyToAttraction(attraction);
    closeSidebarOnMobile();
  }

  /** 清除选中态并回到景区全景视角 */
  function backToOverview(): void {
    markers.forEach((el) => el.classList.remove('active'));
    listEl.querySelectorAll('.psc-item.active').forEach((el) => el.classList.remove('active'));
    hideCard();
    map.flyTo({
      center: meta.center,
      zoom: meta.overview.zoom,
      pitch: meta.overview.pitch,
      bearing: meta.overview.bearing,
      duration: 3600,
      curve: 1.5,
      essential: true,
    });
  }

  /* 地图编号标记：圆点 + 名称胶囊，点击即选中 */
  meta.attractions.forEach((attraction, index) => {
    const el = document.createElement('div');
    el.className = 'psc-marker';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', attraction.name);
    el.innerHTML = `
      <span class="psc-marker-num">${String(index + 1).padStart(2, '0')}</span>
      <span class="psc-marker-label">${attraction.name}</span>`;
    new maplibregl.Marker({ element: el, anchor: 'left', offset: [-13, 0] })
      .setLngLat(attraction.lngLat)
      .addTo(map);
    markers.set(attraction.id, el);
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      select(attraction);
    });
  });

  /* 侧栏列表事件委托：点击任一景点项等同点击地图标记 */
  listEl.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('.psc-item');
    if (!target?.dataset.id) return;
    const attraction = meta.attractions.find((a) => a.id === target.dataset.id);
    if (attraction) select(attraction);
  });

  root.querySelector<HTMLButtonElement>('.psc-card-close')!.addEventListener('click', hideCard);
  root.querySelector<HTMLButtonElement>('.psc-overview')!.addEventListener('click', backToOverview);
  root.querySelector<HTMLButtonElement>('.psc-sidebar-toggle')!.addEventListener('click', () => {
    sidebarEl.classList.toggle('open');
  });

  /** 打开大图预览灯箱：装载景点照片与名称说明 */
  function openLightbox(attraction: Attraction): void {
    if (!attraction.photo) return;
    lightboxImg.src = attraction.photo;
    lightboxImg.alt = `${attraction.name} 实景大图`;
    lightboxCaption.textContent = `${attraction.name} · 实景照片（来源见 README「数据署名」）`;
    lightboxEl.classList.add('open');
  }

  /** 关闭大图预览灯箱 */
  function closeLightbox(): void {
    lightboxEl.classList.remove('open');
  }

  /* ESC 依次关闭：全景 → 大图灯箱 → 景点卡片；点击遮罩同样关闭灯箱 */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isPanoOverlayOpen()) {
      closePanoOverlay();
      return;
    }
    if (lightboxEl.classList.contains('open')) {
      closeLightbox();
      return;
    }
    hideCard();
  });
  lightboxEl.addEventListener('click', (event) => {
    if (event.target === lightboxEl) closeLightbox();
  });
  root.querySelector<HTMLButtonElement>('.psc-lightbox-close')!.addEventListener('click', closeLightbox);

  /* 缩放超过阈值后展开全部标记名称 */
  const updateLabels = (): void => {
    root.classList.toggle('psc-labels-on', map.getZoom() >= LABEL_MIN_ZOOM);
  };
  map.on('zoom', updateLabels);
  updateLabels();

  /* 首帧渲染完成或超时后撤掉加载遮罩 */
  let loaderGone = false;
  const dismissLoader = (): void => {
    if (loaderGone) return;
    loaderGone = true;
    loaderEl.classList.add('psc-done');
    window.setTimeout(() => loaderEl.remove(), 800);
  };
  map.once('load', dismissLoader);
  window.setTimeout(dismissLoader, 9000);
}
