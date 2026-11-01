// Quiet, consistent line icons. Values keep existing saved habit preferences compatible.
const paths={
 '💧':'<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11Z"/>',
 '🌅':'<path d="M3 18h18M4 14h16M7 14a5 5 0 0 1 10 0M12 3v3M4 7l2 2m14-2-2 2"/>',
 '🎵':'<path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
 '🧘':'<circle cx="12" cy="5" r="2"/><path d="m8 10 4-2 4 2 3 4M5 14l3-4m4-2v7m-5 5 5-5 5 5M4 20h16"/>',
 '🌬️':'<path d="M3 8h11c4 0 4-5 1-5M3 12h15c4 0 4 5 1 5M3 16h7c4 0 4 5 1 5"/>',
 '📵':'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 18h4M3 3l18 18"/>',
 '🪥':'<path d="m5 21 8-11M12 9l3-4 5 3-3 5-5-4ZM15 5l2-3m0 4 2-3m0 4 2-3"/>',
 '🧴':'<rect x="6" y="8" width="12" height="14" rx="3"/><path d="M10 8V4h4v4M12 4V2h6M9 14h6"/>',
 '🛏️':'<path d="M3 20V8m18 12V8M3 16h18M6 10V6h12v4M3 11h18v5H3Z"/>',
 '🧹':'<path d="m16 2-6 12m-3-1 7 4-4 5-7-4 4-5Zm0 3-2 3m5-1-2 3"/>',
 '🍳':'<circle cx="10" cy="13" r="7"/><circle cx="10" cy="13" r="3"/><path d="m16 9 5-6"/>',
 '💊':'<path d="m8 4-5 8a6 6 0 0 0 10 6l7-9a6 6 0 0 0-10-6L8 4Zm-2 6 10 6"/>',
 '⚖️':'<path d="M12 3v18M7 21h10M4 6h16M6 6l-4 9h8L6 6Zm12 0-4 9h8l-4-9Z"/>',
 '🥤':'<path d="M6 7h12l-2 15H8L6 7ZM4 7h16M12 7l2-5h5M9 11h6"/>',
 '📖':'<path d="M12 6C8 3 4 4 2 5v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-1-6-2-10 1Zm0 0v14M5 8l4 1m6 0 4-1"/>',
 '🏋️':'<path d="M8 12h8M2 10v4m20-4v4M5 7v10m14-10v10M8 5v14m8-14v14"/>',
 '🚶':'<circle cx="14" cy="4" r="2"/><path d="m11 8 4 1 2 4 4 1M11 8l-4 5-4 1m9-5-2 7 5 5m-5-5-4 6"/>',
 '⏰':'<circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M3 4l3-2m12 0 3 2M6 20l-2 2m14-2 2 2"/>',
 '🌙':'<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
 '🚰':'<path d="M3 11h12v5h5v-6c0-3-3-4-6-4H9V3m-4 0h8M4 11v4M17 20s-2-2-2-3a2 2 0 0 1 4 0c0 1-2 3-2 3Z"/>',
 '🏠':'<path d="m2 11 10-8 10 8M5 9v12h14V9M9 21v-7h6v7"/>',
 '🚿':'<path d="M5 21V7a4 4 0 0 1 8 0M10 9h8l-1-4h-6l-1 4Zm1 4v1m4-1v1m4-1v1m-8 4v1m4-1v1m4-1v1"/>',
 '🥗':'<path d="M3 12h18a9 9 0 0 1-18 0Zm4-2c-3-5 1-8 5-4 4-5 8-1 5 4M12 6v4M7 22h10"/>',
 '💆':'<circle cx="12" cy="9" r="5"/><path d="M4 22a8 8 0 0 1 16 0M3 4l4 3M21 4l-4 3M9 10h.1m6 0h.1"/>',
 '💬':'<path d="M21 11a9 8 0 0 1-9 8H7l-5 3 2-6a8 8 0 0 1-1-5 9 8 0 0 1 18 0ZM7 10h10M7 14h7"/>'
};
export function habitEmoji(value){return `<svg class="habit-line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[value]||paths[value?.replace(/\u200d[♂♀]\ufe0f?/g,'')]||'<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>'}</svg>`;}
export const flameIcon='<svg class="flame-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3c2 5 7 7 7 12a7 7 0 0 1-14 0c0-3 2-6 4-8 0 4 2 5 2 5s3-4 1-9Z"/></svg>';
