export type View = 'dashboard' | 'library' | 'discover' | 'metadata' | 'dictionary' | 'queue' | 'exports' | 'files' | 'settings';

export const nav: { id: View; label: string }[] = [
  { id: 'dashboard', label: '工作台' },
  { id: 'library', label: '我的库' },
  { id: 'discover', label: '发现' },
  { id: 'metadata', label: '元数据' },
  { id: 'dictionary', label: '词典' },
  { id: 'queue', label: '队列' },
  { id: 'exports', label: '导出' },
  { id: 'files', label: '文件' },
  { id: 'settings', label: '设置' }
];
