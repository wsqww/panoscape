import type { ScenicAreaMeta } from '../common/types';
import { scenicAreas } from '../common/registry';
import { createScene } from '../common/scene';
import { addTrails } from '../common/trail';
import '../common/base.css';
import './home.css';

/** 入口页网格列数：景区卡与占位卡合计保持 3 的倍数，网格不留缺口 */
const GRID_COLUMNS = 3;

/** 占位卡数量：按已接入景区数自动补足到网格列数的整数倍 */
const UPCOMING_COUNT = (GRID_COLUMNS - (scenicAreas.length % GRID_COLUMNS)) % GRID_COLUMNS;

/** 卡片迷你预览的取景参数：关闭地形以避开低缩放级别的俯仰限制，保持透视感；
 *  缩放偏移可被景区级 meta.previewZoomDelta 覆盖（长条形路线需更小） */
const PREVIEW_ZOOM_OFFSET = -0.8;
const PREVIEW_PITCH = 50;

/** 生成单张景区卡片 HTML：已接入景区为链接卡，占位景区为虚线卡 */
function cardHtml(area: ScenicAreaMeta | null): string {
  if (!area) {
    return `
      <div class="psc-scenic-card psc-upcoming">
        <div class="psc-card-preview"><span class="psc-upcoming-ghost">规划中</span></div>
        <div class="psc-card-body">
          <div class="psc-card-head"><h2>敬请期待</h2></div>
          <p class="psc-card-desc">更多景区正在陆续接入。</p>
        </div>
      </div>`;
  }
  return `
    <a class="psc-scenic-card" href="scenic/${area.id}/index.html">
      <div class="psc-card-preview" data-preview-for="${area.id}"></div>
      <div class="psc-card-body">
        <div class="psc-card-head"><h2>${area.name}</h2><span class="psc-card-sub">${area.subtitle}</span></div>
        <p class="psc-card-desc">${area.description}</p>
        <span class="psc-card-cta">进入游览</span>
      </div>
    </a>`;
}

/**
 * 渲染入口页：品牌区、景区卡片网格与数据署名。
 * 参数 root：页面根容器（#app），内容会被整体替换；
 * 副作用：向 root 写入 DOM，并为可见卡片创建迷你 3D 地图预览。
 */
function renderHome(root: HTMLElement): void {
  root.classList.add('psc-home');
  root.innerHTML = `
    <div class="psc-home-inner">
      <header>
        <div class="psc-home-brand">
          <span class="psc-home-cn">境游</span>
          <span class="psc-home-en">PANOSCAPE</span>
        </div>
        <p class="psc-home-slogan">足不出户 · 身临千山</p>
        <h1 class="psc-home-title">选择景区，即刻入景</h1>
      </header>
      <main class="psc-home-grid">
        ${[...scenicAreas].reverse().map((area) => cardHtml(area)).join('')}
        ${Array.from({ length: UPCOMING_COUNT }, () => cardHtml(null)).join('')}
      </main>
      <footer class="psc-home-footer">
        地图数据 © OpenStreetMap 贡献者 · 底图服务 OpenFreeMap · 高程数据 © AWS Open Data · 由 MapLibre GL 渲染<br/>
        Panoscape 境游 · 个人作品集演示项目
      </footer>
    </div>
  `;
}

/** 在卡片内创建非交互的迷你 3D 地图预览（懒加载，进入视口才初始化）；底图跟随景区 baseLayer 配置 */
function mountPreview(host: HTMLElement, area: ScenicAreaMeta): void {
  const map = createScene({
    container: host,
    center: area.center,
    zoom: area.overview.zoom + (area.previewZoomDelta ?? PREVIEW_ZOOM_OFFSET),
    pitch: PREVIEW_PITCH,
    bearing: area.overview.bearing,
    interactive: false,
    buildings: true,
    terrain: false,
    minZoom: 1,
    maxPitch: 60,
    hideAttribution: true,
    baseLayer: area.baseLayer,
  });
  // 配置了徒步路线的景区，在预览中同步常显路线缩略
  if (area.trails?.length) addTrails(map, area.trails);
}

const root = document.getElementById('app');
if (root) {
  renderHome(root);
  /* 预览懒加载：卡片滚动进入视口附近时才创建地图，避免首屏一次性建立多个 WebGL 上下文 */
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const host = entry.target as HTMLElement;
        observer.unobserve(host);
        const area = scenicAreas.find((item) => item.id === host.dataset.previewFor);
        if (area) mountPreview(host, area);
      }
    },
    { rootMargin: '160px' }
  );
  root.querySelectorAll<HTMLElement>('[data-preview-for]').forEach((host) => observer.observe(host));
}
