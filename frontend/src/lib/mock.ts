import { covers } from '../assets/covers';

export type Work = {
  id: number;
  title: string;
  originalTitle: string;
  circle: string;
  author: string;
  source: string;
  sourceId: string;
  pages: number;
  size: string;
  language: string;
  cover: string;
  progress: number;
  metadataScore: number;
  tags: string[];
  status: 'reading' | 'queued' | 'done' | 'needs_metadata';
};

export type Gallery = Work & { imported: boolean; related: number[] };
export type Task = { id: string; type: string; title: string; target: string; phase: string; progress: number; status: 'running' | 'queued' | 'failed' | 'done'; eta: string };
export type DictionaryTerm = { id: number; source: string; zh: string; aliases: string[]; type: string; works: number; hits: number; status: 'pending' | 'configured' | 'ignored' | 'review'; confidence: number };
export type ExportJob = { id: number; workId: number; filename: string; size: string; preset: string; status: 'ready' | 'warning' | 'done' | 'failed'; warnings: string[] };
export type SettingsState = { apiConnected: boolean; privacy: boolean; blurCovers: boolean; cacheLimit: string; theme: string; dataDir: string; exportDir: string };
export type AppState = {
  works: Work[];
  galleries: Gallery[];
  tasks: Task[];
  dictionary: DictionaryTerm[];
  exports: ExportJob[];
  settings: SettingsState;
};

export const mockWorks: Work[] = [
  work(1, '雨后的教室', 'となりのねこ', 'となりのティーズ', 'COMITIA 147', covers[0], 37, 'reading', ['校园', '雨天', '青春']),
  work(2, '境界线上的我们', 'アトリエ境界線', 'アトリエ境界線', 'COMIC1☆23', covers[1], 60, 'needs_metadata', ['奇幻', '冒险']),
  work(3, '潮汐的回声', 'Blue Reverie', 'Blue Reverie', 'BOOTH', covers[2], 0, 'done', ['原创', '治愈']),
  work(4, '雪融之时', 'Snowmelt', 'ハニミット工房', 'BOOTH', covers[3], 69, 'reading', ['雪', '静谧']),
  work(5, '星夜', 'Astral', '海荷茶', 'COMITIA 146', covers[4], 0, 'queued', ['科幻']),
  work(6, '春日未央', 'はるの方', '春日制作室', 'BOOTH', covers[5], 100, 'done', ['全年龄', '温馨']),
  work(7, '秘密花园', 'Secret Garden', '黒猫工房', 'COMITIA 148', covers[6], 20, 'needs_metadata', ['悬疑', '心理']),
  work(8, '放課後のふたり', '放課後のふたり', '花かすみティーズ', 'nhentai', covers[7], 0, 'queued', ['百合', '校园', '日语'])
];

export const mockState: AppState = {
  works: mockWorks,
  galleries: mockWorks.map((item, index) => ({ ...item, imported: index % 3 === 1, related: [1, 2, 3, 4].filter((id) => id !== item.id) })),
  tasks: [
    { id: '9f8a7b6c', type: '远端下载', title: '雨后的教室', target: 'COMITIA 147 · 36P · CBZ', phase: '下载中', progress: 45, status: 'running', eta: '00:01:32' },
    { id: 'local-42', type: '本地上传', title: '潮汐的回声', target: 'BOOTH · 24P', phase: '上传中', progress: 66, status: 'running', eta: '00:00:21' },
    { id: 'scan-11', type: '目录扫描', title: 'D:\\NH Archive\\Library', target: '包含 86 个文件', phase: '扫描中', progress: 58, status: 'running', eta: '00:00:47' },
    { id: 'parse-2', type: 'CBZ 解析', title: '秘密花园', target: 'BOOTH · 42P', phase: '排队中', progress: 0, status: 'queued', eta: '00:00:35' },
    { id: 'fail-7', type: 'CBZ 解析', title: '放課後のふたり', target: 'Gallery ID 1234567', phase: '文件损坏', progress: 0, status: 'failed', eta: '失败于 00:00:15' }
  ],
  dictionary: [
    { id: 1, source: 'Snowmelt', zh: '雪融', aliases: ['雪融之时', '融雪'], type: '作品名', works: 66, hits: 142, status: 'pending', confidence: 86 },
    { id: 2, source: 'Astral', zh: '星夜', aliases: [], type: '作品名', works: 48, hits: 88, status: 'configured', confidence: 92 },
    { id: 3, source: 'Blue Reverie', zh: '潮汐的回声', aliases: ['蓝色梦境'], type: '社团', works: 24, hits: 41, status: 'review', confidence: 74 },
    { id: 4, source: 'COMITIA', zh: 'COMITIA', aliases: [], type: '来源', works: 189, hits: 356, status: 'configured', confidence: 100 }
  ],
  exports: [
    { id: 1, workId: 8, filename: '放課後のふたり(となりのねこ).cbz', size: '1.36 GB', preset: '默认预设 v2', status: 'warning', warnings: ['7 个 tag 未确认', '缺少 Writer 字段'] },
    { id: 2, workId: 2, filename: '境界线上的我们.cbz', size: '892 MB', preset: '元数据完整 v1', status: 'ready', warnings: ['缺少 Series 字段'] },
    { id: 3, workId: 4, filename: '雪融之时(Snowmelt).cbz', size: '1.02 GB', preset: '默认预设 v2', status: 'ready', warnings: [] },
    { id: 4, workId: 5, filename: '星夜(Astral).cbz', size: '748 MB', preset: '轻量导出 v1', status: 'ready', warnings: ['7 个 tag 未确认'] }
  ],
  settings: {
    apiConnected: true,
    privacy: false,
    blurCovers: true,
    cacheLimit: '20 GB',
    theme: '跟随系统',
    dataDir: 'D:\\NH Archive\\Library\\Downloads',
    exportDir: 'D:\\NH Archive\\Exports'
  }
};

function work(id: number, title: string, originalTitle: string, circle: string, source: string, cover: string, progress: number, status: Work['status'], tags: string[]): Work {
  return {
    id,
    title,
    originalTitle,
    circle,
    author: circle,
    source,
    sourceId: String(123456 + id),
    pages: 20 + id * 2,
    size: `${18 + id * 2}.7 MB`,
    language: id % 3 === 0 ? '中文' : '日语',
    cover,
    progress,
    metadataScore: 62 + id * 4,
    tags,
    status
  };
}
