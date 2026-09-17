import { mountTour } from '../../common/tour';
import { westlake } from './meta';

/** 西湖游览页入口：向页面根容器挂载通用游览界面并注入西湖景区数据 */
const root = document.getElementById('app');
if (root) mountTour(root, westlake);
