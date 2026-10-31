import type { AvatarSpec, Category, ImageRef, ToolKind } from '../domain/types';

/** Static, app-authored SVG markup only. Never pass user input here. */
const Svg = ({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) => (
  <span className={className} style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
);

export const MARK_SVG =
  '<svg viewBox="0 0 100 100"><path class="mk-d" d="M2 95 L35 22 Q39 13 46 10 L50 21 L22 95 Z" fill="#0E1F3B"/><path d="M37 24 Q46 3 62 3 Q74 3 79 16 L99 95 L79 95 L63 38 Q60 27 53 27 Q46 27 42 34 Z" fill="#F59E0B"/><path d="M17 76 C31 57 53 53 74 61 C56 62 43 73 36 95 L13 95 Z" fill="#14B8A6"/><circle cx="53" cy="46" r="7.5" fill="#F59E0B"/></svg>';

export function Logo({ size = 27 }: { size?: number }) {
  return (
    <span className="logo">
      <Svg html={MARK_SVG} style={{ width: size, height: size, display: 'inline-flex' }} />
      <span>
        Ally<em>fe</em>
      </span>
    </span>
  );
}

export const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 11l8-6.5 8 6.5V20H4z"/><path d="M10 20v-5h4v5"/></svg>',
  discover: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
  projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8z"/><path d="M9 9.5h6M9 12.5h4"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><circle cx="16" cy="13.5" r="1.2" fill="currentColor"/></svg>',
  requests: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 6.5h16v11H4z"/><path d="M4 7l8 6 8-6"/></svg>',
  tools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2 2 0 0 1-3-3z"/><path d="M5 5l4 4M4 8l4-4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 16.5h12l-1.6-2.2V10a4.4 4.4 0 0 0-8.8 0v4.3z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M9 5l7 7-7 7"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  heartF: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 6 0 0 1 14 0"/></svg>',
  brief: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 19v-5M10 19v-8M15 19v-6M20 19V7"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h2M12 14h2M8 17h2"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  wifiOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.2-2.4M19 12.5a10 10 0 0 0-2.8-1.9M2 8.8a15 15 0 0 1 4.3-2.6M22 8.8A15 15 0 0 0 11 5"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
} as const;
export type IconName = keyof typeof ICONS;

export const Icon = ({ name, size, className }: { name: IconName; size?: number; className?: string }) => (
  <Svg html={ICONS[name]} className={'ic-' + name + (className ? ' ' + className : '')} style={{ width: size, height: size, display: 'inline-flex', flex: 'none' }} />
);

export const CATEGORY_STYLE: Record<Category, { bg: string; fg: string; svg: string }> = {
  'Home Renovation': { bg: '#DBEAFE', fg: '#1D4ED8', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l9 7.5h-2.5V20h-5v-5.5h-3V20h-5v-9H3z"/></svg>' },
  'Interior Design': { bg: '#FFE4E0', fg: '#EA580C', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2.2a2.5 2.5 0 0 0-2 2.3H8a2.5 2.5 0 0 0-2-2.3zM3 13.5a1.8 1.8 0 0 1 3.6 0V15h10.8v-1.5a1.8 1.8 0 0 1 3.6 0V19h-2v1.5h-2V19H7v1.5H5V19H3z"/></svg>' },
  Plumbing: { bg: '#E0F2FE', fg: '#0369A1', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/><path d="M4 4l5 5M6.5 4L4 6.5"/></svg>' },
  Electrical: { bg: '#FEF3C7', fg: '#D97706', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V17h6v-1.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5zM9 18.5h6V20a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20z"/></svg>' },
  Painting: { bg: '#EDE9FE', fg: '#6D28D9', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3.5" width="15" height="6" rx="1.5"/><path d="M18 6.5h2.5v6H11v3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="15" width="4" height="6.5" rx="1"/></svg>' },
};
export const CategoryIcon = ({ cat }: { cat: Category }) => {
  const c = CATEGORY_STYLE[cat];
  return <Svg html={c.svg} className="cat-ic" style={{ background: c.bg, color: c.fg }} />;
};

export function Avatar({ spec, size }: { spec: AvatarSpec; size: number }) {
  const hair = {
    short: '<path d="M20 25c0-8 6-12 12-12s12 4 12 12c-3-4-7-5-12-5s-9 1-12 5z" fill="#1F1A17"/>',
    long: '<path d="M18 30c-1-11 5-17 14-17s15 6 14 17c-2 6-3 10-3 14H21c0-4-1-8-3-14z" fill="#1F1A17"/>',
    wrap: '<path d="M18 26c0-9 6-15 14-15s14 6 14 15c-4-3-9-4-14-4s-10 1-14 4z" fill="#EA580C"/><circle cx="44" cy="15" r="6" fill="#EA580C"/>',
    hat: '<path d="M18 26a14 13 0 0 1 28 0z" fill="#FBBF24"/><rect x="15" y="24" width="34" height="4.5" rx="2.2" fill="#F59E0B"/><rect x="30.5" y="13" width="3" height="11" rx="1.5" fill="#F59E0B"/>',
  }[spec.hair];
  const backH = spec.hair === 'long' ? hair : '';
  const front = spec.hair === 'long' ? '' : hair;
  const html = `<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="${spec.bg}"/>${backH}<path d="M8 66c2-14 11-21 24-21s22 7 24 21z" fill="${spec.shirt}"/>${spec.vest ? '<path d="M21 47l5 19h-6l-4-16zM43 47l-5 19h6l4-16z" fill="#F59E0B"/>' : ''}<rect x="28" y="38" width="8" height="9" rx="3" fill="${spec.skin}"/><circle cx="32" cy="29" r="11.5" fill="${spec.skin}"/>${front}</svg>`;
  return <Svg html={html} className="av" style={{ width: size, height: size }} />;
}

const SCENES: Record<string, string> = {
  cabinet: '<rect width="160" height="100" fill="#EDE5D8"/><rect x="0" y="62" width="160" height="38" fill="#C9B79C"/><rect x="10" y="10" width="140" height="30" rx="2" fill="#B9875A"/><path d="M45 10v30M80 10v30M115 10v30" stroke="#8A5A33" stroke-width="2"/><rect x="0" y="56" width="160" height="7" fill="#3F3A36"/><rect x="10" y="63" width="140" height="32" fill="#B9875A"/><path d="M45 63v32M80 63v32M115 63v32" stroke="#8A5A33" stroke-width="2"/><rect x="38" y="20" width="3" height="10" rx="1.5" fill="#F3E9DA"/><rect x="73" y="20" width="3" height="10" rx="1.5" fill="#F3E9DA"/><rect x="108" y="20" width="3" height="10" rx="1.5" fill="#F3E9DA"/><rect x="38" y="72" width="3" height="10" rx="1.5" fill="#F3E9DA"/><rect x="108" y="72" width="3" height="10" rx="1.5" fill="#F3E9DA"/>',
  ceiling: '<rect width="160" height="100" fill="#D9CFC1"/><path d="M0 0h160v34L130 44H30L0 34z" fill="#F4F1EC"/><path d="M30 44h100" stroke="#E2DBD0" stroke-width="3"/><circle cx="50" cy="20" r="4" fill="#FDE68A"/><circle cx="80" cy="20" r="4" fill="#FDE68A"/><circle cx="110" cy="20" r="4" fill="#FDE68A"/><circle cx="80" cy="20" r="18" fill="#FDE68A" opacity=".25"/><rect x="20" y="62" width="60" height="22" rx="5" fill="#8C6E54"/><rect x="96" y="54" width="34" height="30" fill="#A7C4BC"/>',
  tiles: '<rect width="160" height="100" fill="#DCE7EA"/><g stroke="#B7C9CE" stroke-width="1.5"><path d="M0 20h160M0 40h160M0 60h160M0 80h160M20 0v100M40 0v100M60 0v100M80 0v100M100 0v100M120 0v100M140 0v100"/></g><rect x="96" y="44" width="50" height="40" rx="8" fill="#fff"/><rect x="104" y="50" width="34" height="22" rx="10" fill="#E6EEF0"/>',
  solar: '<rect width="160" height="100" fill="#BFDBFE"/><circle cx="135" cy="18" r="10" fill="#FDE68A"/><path d="M10 100L50 40h80l20 60z" fill="#7C2D12"/><g fill="#1E3A8A" stroke="#93C5FD" stroke-width="1"><path d="M42 58l10-14h26l-6 14z"/><path d="M76 58l6-14h26l-2 14z"/><path d="M36 76l9-14h26l-6 14z"/><path d="M73 76l6-14h26l-2 14z"/></g>',
  room: '<rect width="160" height="100" fill="#A7C4BC"/><rect x="0" y="74" width="160" height="26" fill="#C9B79C"/><rect x="26" y="50" width="78" height="28" rx="8" fill="#F59E0B"/><rect x="20" y="58" width="12" height="22" rx="5" fill="#D97706"/><rect x="98" y="58" width="12" height="22" rx="5" fill="#D97706"/><rect x="118" y="20" width="26" height="34" fill="#F8F6F1"/><rect x="122" y="24" width="18" height="26" fill="#14B8A6" opacity=".6"/><path d="M135 74c0-12 6-18 10-22-1 8 0 14-4 22z" fill="#0F766E"/>',
  wardrobe: '<rect width="160" height="100" fill="#EFE7DB"/><rect x="30" y="8" width="100" height="88" rx="3" fill="#6B4A31"/><path d="M63 8v88M97 8v88" stroke="#4B321F" stroke-width="2"/><rect x="57" y="44" width="3" height="14" rx="1.5" fill="#E8D5B5"/><rect x="66" y="44" width="3" height="14" rx="1.5" fill="#E8D5B5"/><rect x="91" y="44" width="3" height="14" rx="1.5" fill="#E8D5B5"/><rect x="100" y="44" width="3" height="14" rx="1.5" fill="#E8D5B5"/>',
};
export const SCENE_KEYS = Object.keys(SCENES);

/** Shows a built-in illustration, or a real uploaded photo (data URL). */
export function Picture({ src, className, alt = '' }: { src: ImageRef; className?: string; alt?: string }) {
  if (src.startsWith('data:image/')) return <img className={'pic ' + (className ?? '')} src={src} alt={alt} />;
  const body = SCENES[src] ?? SCENES.room;
  return <Svg className={'pic ' + (className ?? '')} html={`<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">${body}</svg>`} />;
}

export function HouseArt() {
  return (
    <Svg
      className="house-art"
      html={`<svg viewBox="0 0 220 170" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%"><defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2E52"/><stop offset="1" stop-color="#0E1F3B"/></linearGradient><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0E1F3B"/><stop offset=".35" stop-color="#0E1F3B" stop-opacity="0"/></linearGradient></defs><rect width="220" height="170" fill="url(#sk)"/><rect x="40" y="58" width="150" height="80" fill="#24324A"/><rect x="30" y="50" width="170" height="10" fill="#E8E2D6"/><rect x="60" y="20" width="110" height="32" fill="#2C3B57"/><rect x="54" y="14" width="122" height="8" fill="#E8E2D6"/><g fill="#FBBF24"><rect x="70" y="26" width="26" height="20" opacity=".9"/><rect x="104" y="26" width="26" height="20" opacity=".8"/><rect x="138" y="26" width="24" height="20" opacity=".9"/><rect x="52" y="70" width="34" height="50" opacity=".85"/><rect x="96" y="70" width="34" height="50" opacity=".95"/><rect x="140" y="70" width="38" height="50" opacity=".8"/></g><g stroke="#24324A" stroke-width="2"><path d="M69 70v50M113 70v50M159 70v50M83 26v20M117 26v20"/></g><rect x="0" y="138" width="220" height="32" fill="#16233B"/><path d="M190 138c4-26 14-40 24-46-2 18-6 34-10 46z" fill="#0F766E"/><path d="M20 138c-2-16 2-26 10-32 0 12 2 22-2 32z" fill="#14B8A6" opacity=".7"/><rect width="220" height="170" fill="url(#fade)"/></svg>`}
    />
  );
}

const TOOL_COLORS: Record<ToolKind, [string, string]> = {
  drill: ['#FEF3C7', '#B45309'],
  cutter: ['#E0F2FE', '#0369A1'],
  scaffold: ['#EDE9FE', '#6D28D9'],
  sprayer: ['#FFE4E0', '#C2410C'],
  generator: ['#DCFCE7', '#15803D'],
  mixer: ['#E8ECF3', '#0E1F3B'],
};
export const TOOL_KINDS = Object.keys(TOOL_COLORS) as ToolKind[];
export const ToolIcon = ({ kind }: { kind: ToolKind }) => (
  <span className="tool-ph" style={{ background: TOOL_COLORS[kind][0], color: TOOL_COLORS[kind][1] }}>
    <Icon name="tools" />
  </span>
);
