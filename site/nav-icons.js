// Compact outline icons for the Redeiras workspace navigation.
// Original shapes built with simple SVG primitives; no external icon font/service.
const paths={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 market:'<path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
 team:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 12h18"/><circle cx="12" cy="12" r="3"/>',
 ranking:'<path d="M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 14v4M8 21h8M9 18h6"/>',
 analytics:'<path d="M4 20V11h4v9M10 20V4h4v16M16 20v-7h4v7M3 20h18"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/>',
 vote:'<path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.2L12 17.2l-5.6 3 1.2-6.2L3 9.6l6.3-.8L12 3Z"/>',
 guide:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 4.6 2c-1.4 1.2-2.1 1.6-2.1 3M12 17h.01"/>',
 admin:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
 more:'<path d="M4 7h16M4 12h16M4 17h16"/>'
};
export function navIcon(name){
 return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.more)+'</svg>';
}
