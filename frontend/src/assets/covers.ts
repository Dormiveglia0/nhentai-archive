type CoverPalette = {
  bg: string;
  mid: string;
  ink: string;
  light: string;
  accent: string;
};

const palettes: CoverPalette[] = [
  { bg: '#4d3b34', mid: '#1d2022', ink: '#171312', light: '#f4d1b9', accent: '#c78d78' },
  { bg: '#23384a', mid: '#7fa3b7', ink: '#1d2631', light: '#e6f0f6', accent: '#b7d4e4' },
  { bg: '#335d76', mid: '#bad4e0', ink: '#1f3342', light: '#f8efe6', accent: '#92c3d5' },
  { bg: '#2b3440', mid: '#a84638', ink: '#1a1d24', light: '#f1d5c8', accent: '#d8a395' },
  { bg: '#172336', mid: '#8ba8c4', ink: '#111826', light: '#f4d8c5', accent: '#ceddec' },
  { bg: '#d6bea4', mid: '#8d6757', ink: '#432c27', light: '#fff1e6', accent: '#e4b4a0' },
  { bg: '#24231f', mid: '#6e675b', ink: '#161513', light: '#ded0bd', accent: '#a89272' },
  { bg: '#806558', mid: '#cfa996', ink: '#2b2422', light: '#f7e4d7', accent: '#e8bdab' }
];

const titles = ['雨后的教室', '境界线上的我们', '潮汐的回声', '雪融之时', '星夜', '春日未央', '秘密花园', '放課後のふたり'];

export const covers = titles.map((title, index) => cover(title, palettes[index], index));

export const readerPages = [mangaPage('after-rain'), mangaPage('quiet-room')];

function cover(title: string, palette: CoverPalette, variant: number) {
  const moon = variant % 3 === 1;
  const sakura = variant % 3 === 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 500">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.bg}"/><stop offset=".58" stop-color="${palette.mid}"/><stop offset="1" stop-color="${palette.light}"/></linearGradient>
      <radialGradient id="glow" cx=".72" cy=".22" r=".72"><stop stop-color="${palette.light}" stop-opacity=".78"/><stop offset=".42" stop-color="${palette.accent}" stop-opacity=".18"/><stop offset="1" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="4"/><feColorMatrix type="saturate" values=".18"/><feBlend mode="soft-light" in2="SourceGraphic"/></filter>
      <clipPath id="frame"><rect x="18" y="18" width="324" height="464" rx="14"/></clipPath>
    </defs>
    <rect width="360" height="500" fill="url(#bg)"/>
    <g clip-path="url(#frame)">
      <rect x="18" y="18" width="324" height="464" fill="url(#bg)"/>
      <rect width="360" height="500" fill="url(#glow)"/>
      <g opacity=".35" stroke="${palette.light}" stroke-width="2" fill="none">
        <path d="M18 342c72-24 141-29 207-14 44 10 81 6 117-13"/>
        <path d="M42 98h276M42 132h276M42 166h276"/>
        <path d="M76 78v236M133 72v250M222 64v258M292 82v230"/>
      </g>
      ${moon ? `<circle cx="270" cy="80" r="44" fill="${palette.light}" opacity=".58"/><path d="M244 93c36 18 64 16 86-8" stroke="${palette.bg}" stroke-width="3" opacity=".35"/>` : ''}
      ${sakura ? blossomLayer(palette) : rainLayer(palette)}
      <g transform="translate(24 52)">
        <path d="M151 88c45 0 80 39 80 94v166H64V182c0-55 39-94 87-94z" fill="${palette.ink}" opacity=".6"/>
        <path d="M75 189c12-69 44-112 93-129 52 23 76 68 72 136-31 21-61 29-91 24-27-5-51-15-74-31z" fill="${palette.ink}" opacity=".84"/>
        <path d="M105 188c3 53 25 82 65 86 42-8 61-37 58-87-10-32-30-52-60-58-34 4-55 24-63 59z" fill="${palette.light}" opacity=".74"/>
        <path d="M114 154c25-34 62-45 111-33 17 34 19 68 6 103-15-42-42-67-81-74-18 4-30 19-36 45-13-12-13-26 0-41z" fill="${palette.ink}" opacity=".88"/>
        <g stroke="${palette.ink}" stroke-width="3" stroke-linecap="round" opacity=".55">
          <path d="M137 196c14 5 27 5 40 0M193 196c13 5 26 5 39 0"/>
          <path d="M174 232c15 8 31 8 48 0"/>
        </g>
        <path d="M83 325c26-55 70-84 132-86 49 6 82 35 99 86v73H83z" fill="${palette.light}" opacity=".64"/>
        <path d="M83 327c58 28 135 28 231 0v74H83z" fill="${palette.ink}" opacity=".28"/>
      </g>
      <g opacity=".52" stroke="${palette.light}" stroke-width="3" fill="none">
        <path d="M38 438c54-12 111-17 171-14s101-2 123-13"/>
        <path d="M41 456c44-8 92-8 144 0"/>
      </g>
    </g>
    <rect x="18" y="18" width="324" height="464" rx="14" fill="none" stroke="${palette.light}" stroke-width="2" opacity=".52"/>
    <rect x="30" y="386" width="300" height="72" fill="${palette.ink}" opacity=".26"/>
    <text x="42" y="430" fill="#fffaf1" font-family="serif" font-size="26" font-weight="700">${escapeText(title)}</text>
    <rect width="360" height="500" filter="url(#grain)" opacity=".18"/>
  </svg>`;
  return dataURI(svg);
}

function rainLayer(palette: CoverPalette) {
  return `<g stroke="${palette.light}" stroke-width="2" opacity=".45">
    <path d="M42 35l-20 44M106 22 84 70M317 40l-18 42M278 158l-16 39M58 228l-20 46M314 244l-19 44"/>
    <path d="M37 266c66-14 130-13 192 4 38 10 73 10 105 0" fill="none"/>
  </g>`;
}

function blossomLayer(palette: CoverPalette) {
  return `<g fill="${palette.light}" opacity=".55">
    ${Array.from({ length: 22 }, (_, index) => {
      const x = 24 + (index * 47) % 316;
      const y = 34 + (index * 71) % 380;
      return `<path d="M${x} ${y}c8-9 18-5 15 7-8 9-18 5-15-7z"/>`;
    }).join('')}
  </g>`;
}

function mangaPage(kind: string) {
  const classroom = kind === 'after-rain';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 1040">
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f1e8"/><stop offset="1" stop-color="#d3cabd"/></linearGradient>
      <filter id="tone"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3"/><feColorMatrix type="saturate" values="0"/><feBlend mode="multiply" in2="SourceGraphic"/></filter>
    </defs>
    <rect width="760" height="1040" fill="url(#paper)"/>
    <g stroke="#312d29" stroke-width="5" fill="#ebe4da">
      <rect x="40" y="34" width="680" height="292"/>
      <rect x="40" y="354" width="680" height="302"/>
      <rect x="40" y="686" width="322" height="312"/>
      <rect x="398" y="686" width="322" height="312"/>
    </g>
    <g stroke="#4a4640" fill="none" stroke-width="4" opacity=".62">
      <path d="M78 90h602M78 140h602M78 190h602M78 240h602"/>
      <path d="M126 70v238M234 70v238M342 70v238M450 70v238M558 70v238M666 70v238"/>
      <path d="M78 452h600M78 500h600M78 548h600"/>
      <path d="M190 384v240M302 384v240M414 384v240M526 384v240"/>
    </g>
    <g opacity=".78">
      <path d="M168 486c18-76 61-122 128-139 76 24 115 78 116 162v137H151z" fill="#2e2b28"/>
      <path d="M210 504c5 66 36 102 92 106 57-12 83-49 78-111-15-43-45-68-90-74-48 7-75 33-80 79z" fill="#d7d0c8"/>
      <path d="M218 456c43-57 97-76 162-56 32 51 37 103 15 158-25-61-64-97-117-108-31 5-50 28-60 68-18-17-18-38 0-62z" fill="#26231f"/>
      <path d="M250 510c22 9 43 9 63 0M336 510c19 9 39 9 60 0M300 574c28 13 58 13 90 0" stroke="#2f2a26" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M123 646c41-77 102-117 184-120 72 7 123 47 154 120z" fill="#bbb3aa"/>
    </g>
    <g opacity=".72">
      <path d="M93 853c12-70 50-115 114-132 66 20 99 66 100 138v122H83z" fill="#38342f"/>
      <path d="M456 854c14-72 51-118 111-138 72 20 108 69 110 146v119H448z" fill="#39342f"/>
      <path d="M120 864c2 50 25 78 69 84 48-8 71-38 68-90-12-34-36-55-72-62-38 7-60 30-65 68zM490 866c3 50 27 78 73 84 47-9 69-39 66-92-12-35-37-56-74-63-39 8-60 31-65 71z" fill="#d8d2c9"/>
    </g>
    <g fill="#fffaf1" stroke="#2b2824" stroke-width="3">
      <rect x="112" y="168" width="92" height="132" rx="4"/>
      <rect x="596" y="78" width="86" height="166" rx="4"/>
      <ellipse cx="538" cy="546" rx="46" ry="76"/>
      <ellipse cx="330" cy="845" rx="40" ry="70"/>
      <ellipse cx="650" cy="824" rx="40" ry="70"/>
    </g>
    <g font-family="serif" font-weight="700" fill="#2a2723" font-size="28">
      <text x="151" y="214" writing-mode="tb">${classroom ? '雨停了。' : '安静一点。'}</text>
      <text x="634" y="118" writing-mode="tb">${classroom ? '天空像洗过一样。' : '灯还亮着。'}</text>
      <text x="524" y="498" writing-mode="tb">${classroom ? '你在看什么？' : '还没有结束。'}</text>
      <text x="318" y="802" writing-mode="tb">只是看看。</text>
      <text x="638" y="782" writing-mode="tb">骗人。</text>
    </g>
    <rect width="760" height="1040" filter="url(#tone)" opacity=".12"/>
  </svg>`;
  return dataURI(svg);
}

function dataURI(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeText(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
