import fs from 'node:fs';
import path from 'node:path';
import { BIN_DIR } from './env.js';

/**
 * NIGHTLINE · Railway Edition — Iranian routing rules (applied on the server)
 *
 * The rules follow the layout of the "Iran v2ray rules" project by Chocolate4U
 * (https://github.com/Chocolate4U/Iran-v2ray-rules) and its sing-box / Clash
 * siblings. Iranian domains and IPs go out directly, ads and security lists are
 * blocked, everything else is tunnelled through the panel's inbounds.
 *
 * Two delivery styles:
 *   • xray / v2ray clients ask for geosite:/geoip: files → we ship the rule
 *     block plus download links for the .dat files.
 *   • sing-box and Mihomo can pull remote rule-sets by URL → nothing to install.
 */

export const ROUTING_SOURCE = {
  name: 'Iran v2ray rules',
  author: 'Chocolate4U',
  xray: 'https://github.com/Chocolate4U/Iran-v2ray-rules',
  singbox: 'https://github.com/Chocolate4U/Iran-sing-box-rules',
  clash: 'https://github.com/Chocolate4U/Iran-clash-rules',
  license: 'GPL-3.0',
};

const V2RAY_RAW = 'https://raw.githubusercontent.com/Chocolate4U/Iran-v2ray-rules/release';
const V2RAY_CDN = 'https://cdn.jsdelivr.net/gh/Chocolate4U/Iran-v2ray-rules@release';
const SRS_RAW = 'https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set';
const SRS_CDN = 'https://cdn.jsdelivr.net/gh/Chocolate4U/Iran-sing-box-rules@rule-set';
const CLASH_RAW = 'https://raw.githubusercontent.com/Chocolate4U/Iran-clash-rules/release';
const CLASH_CDN = 'https://cdn.jsdelivr.net/gh/Chocolate4U/Iran-clash-rules@release';

/** .dat files an xray/v2ray client needs beside its binary. */
export const GEO_FILES = [
  { name: 'geosite.dat', label: 'دامنه‌ها · geosite', labelEn: 'domains · geosite', primary: true },
  { name: 'geoip.dat', label: 'آی‌پی‌ها · geoip', labelEn: 'addresses · geoip', primary: true },
  { name: 'security.dat', label: 'لیست امنیتی · security', labelEn: 'security list', primary: false },
  { name: 'security-ip.dat', label: 'امنیتی · IP', labelEn: 'security addresses', primary: false },
  { name: 'geosite-lite.dat', label: 'نسخهٔ سبک · geosite', labelEn: 'lite geosite', primary: false },
  { name: 'geoip-lite.dat', label: 'نسخهٔ سبک · geoip', labelEn: 'lite geoip', primary: false },
].map((f) => ({
  ...f,
  url: `${V2RAY_RAW}/${f.name}`,
  cdn: `${V2RAY_CDN}/${f.name}`,
}));

/** DNS presets. `auto` keeps DoH (encrypted, unfiltered); the rest are Iranian resolvers. */
export const DNS_PRESETS = {
  auto: {
    label: 'خودکار · DoH',
    labelEn: 'automatic · DoH',
    note: 'همه‌چیز روی DNS رمزنگاری‌شده حل می‌شود؛ دامنه‌های ایرانی هم از تونل می‌گذرند.',
    noteEn: 'Everything resolves over encrypted DoH; Iranian domains also go through the tunnel.',
    doh: true,
    ips: [],
  },
  split: {
    label: 'تفکیک‌شده · DoH + DNS ایران',
    labelEn: 'split · DoH + Iran DNS',
    note: 'دامنه‌های ایرانی با DNS داخلی و بدون تونل، بقیه با DoH.',
    noteEn: 'Iranian domains use a local resolver; everything else uses DoH.',
    doh: true,
    ips: ['178.22.122.100', '185.51.200.2'],
  },
  shecan: {
    label: 'شکن',
    labelEn: 'Shecan',
    note: 'DNS شکن برای دامنه‌های ایرانی؛ سازگار با شبکهٔ داخلی.',
    noteEn: 'Shecan resolver for Iranian domains.',
    doh: false,
    ips: ['178.22.122.100', '185.51.200.2'],
  },
  radar: {
    label: 'رادار · ۴۰۳',
    labelEn: 'Radar · 403',
    note: 'DNS رادار (۴۰۳) برای دامنه‌های ایرانی.',
    noteEn: 'Radar (403.online) resolver for Iranian domains.',
    doh: false,
    ips: ['10.202.10.10', '10.202.10.11'],
  },
  electro: {
    label: 'الکترو',
    labelEn: 'Electro',
    note: 'DNS الکترو برای دامنه‌های ایرانی.',
    noteEn: 'Electro resolver for Iranian domains.',
    doh: false,
    ips: ['78.157.42.100', '78.157.42.101'],
  },
  off: {
    label: 'خاموش · DNS پیش‌فرض دستگاه',
    labelEn: 'off · system DNS',
    note: 'DNS را کلاینت خودش انتخاب می‌کند؛ ساده‌ترین حالت.',
    noteEn: 'The client picks its own DNS; the simplest option.',
    doh: false,
    ips: [],
  },
};

/* ── rule data that ships inside the image ───────────────────────────── */

/**
 * The Docker build downloads the Iranian geo files and sing-box rule-sets next
 * to the cores and writes a marker. Without the marker we fall back to the
 * names that stock Xray data knows, so a config never fails to load.
 */
export function rulesAssets() {
  const marker = path.join(BIN_DIR, '.iran-rules.json');
  let iran = false;
  try {
    iran = Boolean(JSON.parse(fs.readFileSync(marker, 'utf8')).iran);
  } catch {
    iran = false;
  }
  const srsDir = path.join(BIN_DIR, 'srs');
  const srs = (name) => path.join(srsDir, `${name}.srs`);
  const hasSrs = iran && fs.existsSync(srs('geosite-category-ir'));
  return { dir: BIN_DIR, srsDir, iran, srs, hasSrs };
}

/**
 * Rules the cores enforce ON THE SERVER (this Railway container):
 * ads / malware / phishing / miners are dropped, QUIC and BitTorrent can be
 * dropped, private ranges never leave the box. No client-side setup needed.
 */
export function serverXrayRules(settings, assets = rulesAssets()) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  const rules = [];
  if (!s.enabled) return rules;
  if (s.blockAds) {
    rules.push({
      type: 'field',
      outboundTag: 'block',
      domain: assets.iran ? ['geosite:category-ads-all', 'geosite:ads'] : ['geosite:category-ads-all'],
    });
  }
  if (s.blockSecurity && assets.iran) {
    rules.push({
      type: 'field',
      outboundTag: 'block',
      domain: ['geosite:malware', 'geosite:phishing', 'geosite:cryptominers'],
    });
    rules.push({ type: 'field', outboundTag: 'block', ip: ['geoip:malware', 'geoip:phishing'] });
  }
  if (s.blockBittorrent) {
    // stops the service being used as a torrent exit node
    rules.push({ type: 'field', protocol: ['bittorrent'], outboundTag: 'block' });
  }
  if (s.blockQuic) {
    rules.push({ type: 'field', network: 'udp', port: '443', outboundTag: 'block' });
  }
  if (s.iranDirect && assets.iran) {
    // explicit: Iranian destinations leave the server directly, never through
    // an upstream chain (and they are never sent back into an inbound).
    rules.push({ type: 'field', outboundTag: 'direct', domain: ['geosite:category-ir'] });
    rules.push({ type: 'field', outboundTag: 'direct', ip: ['geoip:ir'] });
  }
  return rules;
}

export function serverSingboxRules(settings, assets = rulesAssets()) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  if (!s.enabled) return { ruleSets: [], rules: [] };
  const ruleSets = [];
  const rules = [];
  const addSet = (tag, file) => {
    if (assets.hasSrs) ruleSets.push({ type: 'local', tag, format: 'binary', path: assets.srs(file) });
    else ruleSets.push({ type: 'remote', tag, format: 'binary', url: `${SRS_RAW}/${file}.srs` });
  };
  if (s.blockAds) {
    addSet('geosite-ads', 'geosite-category-ads-all');
    rules.push({ rule_set: 'geosite-ads', action: 'reject' });
  }
  if (s.blockSecurity) {
    addSet('geosite-malware', 'geosite-malware');
    addSet('geosite-phishing', 'geosite-phishing');
    addSet('geoip-malware', 'geoip-malware');
    rules.push({ rule_set: ['geosite-malware', 'geosite-phishing'], action: 'reject' });
    rules.push({ rule_set: 'geoip-malware', action: 'reject' });
  }
  if (s.blockQuic) rules.push({ protocol: 'quic', action: 'reject' });
  if (s.iranDirect) {
    addSet('geosite-ir', 'geosite-category-ir');
    addSet('geoip-ir', 'geoip-ir');
    rules.push({ rule_set: ['geosite-ir', 'geoip-ir'], outbound: 'direct' });
  }
  return { ruleSets, rules };
}

export const ROUTING_DEFAULTS = {
  enabled: true,
  // `iranDat` says "the Iranian geosite/geoip files are installed beside the
  // client". Stock v2fly data only knows a few of the names below, and Xray
  // refuses to start on an unknown list — so with this off we emit only the
  // subset that exists in both data sets.
  iranDat: true,
  iranDirect: true,
  blockAds: true,
  blockSecurity: true,
  blockQuic: false,
  blockBittorrent: true,
  directPrivate: true,
  // Client-side rules are optional: the panel enforces everything on the server.
  clientRules: false,
  dns: 'split',
};

const PRIVATE_CIDRS = [
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8',
  '169.254.0.0/16', '100.64.0.0/10', '::1/128', 'fc00::/7', 'fe80::/10',
];

/** Merge whatever is stored with the defaults, and drop unknown DNS names. */
export function routingSettings(doc) {
  const stored = (doc && doc.settings && doc.settings.routing) || {};
  const out = { ...ROUTING_DEFAULTS };
  for (const key of Object.keys(ROUTING_DEFAULTS)) {
    if (stored[key] === undefined) continue;
    if (key === 'dns') {
      if (DNS_PRESETS[stored.dns]) out.dns = stored.dns;
    } else {
      out[key] = Boolean(stored[key]);
    }
  }
  return out;
}

export function dnsPreset(name) {
  return DNS_PRESETS[name] || DNS_PRESETS[ROUTING_DEFAULTS.dns];
}

/* ── Xray / v2ray ────────────────────────────────────────────────────── */

/** Rules as the upstream project documents them, assembled from the toggles. */
export function xrayRules(settings) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  const rules = [];
  if (!s.enabled) {
    rules.push({ type: 'field', ip: PRIVATE_CIDRS, outboundTag: 'direct' });
    return rules;
  }
  const iranDomains = s.iranDat ? ['geosite:ir', 'geosite:category-ir'] : ['geosite:category-ir'];
  if (s.blockAds) {
    rules.push({
      type: 'field',
      outboundTag: 'block',
      domain: s.iranDat ? ['geosite:category-ads-all', 'geosite:ads'] : ['geosite:category-ads-all'],
    });
  }
  if (s.blockSecurity && s.iranDat) {
    rules.push({
      type: 'field',
      outboundTag: 'block',
      domain: ['geosite:malware', 'geosite:phishing', 'geosite:cryptominers'],
    });
    rules.push({ type: 'field', outboundTag: 'block', ip: ['geoip:malware', 'geoip:phishing'] });
  }
  if (s.blockQuic) {
    // QUIC over UDP/443 is what Iranian DPI throttles hardest.
    rules.push({ type: 'field', network: 'udp', port: '443', outboundTag: 'block' });
  }
  if (s.iranDirect) {
    rules.push({ type: 'field', outboundTag: 'direct', domain: iranDomains });
    rules.push({ type: 'field', outboundTag: 'direct', ip: ['geoip:ir'] });
  }
  if (s.directPrivate) {
    rules.push({ type: 'field', ip: PRIVATE_CIDRS, outboundTag: 'direct' });
  }
  return rules;
}

export function xrayDns(settings) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  const preset = dnsPreset(s.dns);
  const servers = [];
  if (preset.ips.length) {
    servers.push({
      address: preset.ips[0],
      domains: s.iranDat ? ['geosite:ir', 'geosite:category-ir'] : ['geosite:category-ir'],
      skipFallback: true,
    });
  }
  if (preset.doh) {
    servers.push('https+local://1.1.1.1/dns-query', 'https+local://8.8.8.8/dns-query');
  }
  if (!preset.doh && !preset.ips.length) {
    servers.push('https+local://1.1.1.1/dns-query', 'https+local://8.8.8.8/dns-query');
  }
  servers.push('localhost');
  return { servers, queryStrategy: 'UseIPv4' };
}

/* ── sing-box ────────────────────────────────────────────────────────── */

const SRS = (name) => ({ raw: `${SRS_RAW}/${name}.srs`, cdn: `${SRS_CDN}/${name}.srs` });

export function singboxRuleSets(settings) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  const sets = [];
  const add = (tag, file) => sets.push({ type: 'remote', tag, format: 'binary', url: SRS(file).raw });
  if (!s.enabled) return sets;
  if (s.iranDirect) {
    add('geosite-ir', 'geosite-category-ir');
    add('geoip-ir', 'geoip-ir');
  }
  if (s.blockAds) add('geosite-ads', 'geosite-category-ads-all');
  if (s.blockSecurity) {
    add('geosite-security', 'geosite-malware');
    add('geosite-phishing', 'geosite-phishing');
    add('geoip-security', 'geoip-malware');
  }
  return sets;
}

/** Extra route rules (the caller appends sniff / dns / clash-mode rules). */
export function singboxRules(settings) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  const rules = [];
  if (!s.enabled) return rules;
  if (s.blockAds) rules.push({ rule_set: 'geosite-ads', action: 'reject' });
  if (s.blockSecurity) {
    rules.push({ rule_set: ['geosite-security', 'geosite-phishing'], action: 'reject' });
    rules.push({ rule_set: 'geoip-security', action: 'reject' });
  }
  if (s.blockQuic) rules.push({ protocol: 'quic', action: 'reject' });
  if (s.iranDirect) rules.push({ rule_set: ['geosite-ir', 'geoip-ir'], outbound: 'direct' });
  return rules;
}

export function singboxDns(settings) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  const preset = dnsPreset(s.dns);
  const servers = [
    { type: 'https', tag: 'cloudflare', server: '1.1.1.1' },
    { type: 'https', tag: 'google', server: '8.8.8.8' },
    { type: 'local', tag: 'local' },
  ];
  const rules = [];
  if (preset.ips.length) {
    servers.unshift({ type: 'udp', tag: 'iran', server: preset.ips[0] });
    rules.push({ domain_suffix: ['.ir'], server: 'iran' });
    if (s.iranDirect) rules.push({ rule_set: 'geosite-ir', server: 'iran' });
  } else {
    rules.push({ domain_suffix: ['.ir'], server: 'local' });
  }
  return { servers, rules, final: 'cloudflare' };
}

/* ── Clash / Mihomo ──────────────────────────────────────────────────── */

export function clashProviders(settings) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  const out = {};
  const add = (key, file) => {
    out[key] = { type: 'http', behavior: 'domain', format: 'mrs', url: `${CLASH_RAW}/${file}.mrs`, path: `./rules/${file}.mrs`, interval: 86400 };
  };
  if (!s.enabled) return out;
  if (s.iranDirect) add('ir', 'ir');
  if (s.blockAds) add('ads', 'category-ads-all');
  if (s.blockSecurity) {
    add('malware', 'malware');
    add('phishing', 'phishing');
  }
  return out;
}

/** Rule lines, in evaluation order (first match wins). */
export function clashRules(settings) {
  const s = { ...ROUTING_DEFAULTS, ...(settings || {}) };
  const lines = [];
  if (s.blockAds) lines.push('RULE-SET,ads,REJECT');
  if (s.blockSecurity) {
    lines.push('RULE-SET,malware,REJECT', 'RULE-SET,phishing,REJECT');
  }
  if (s.directPrivate) {
    lines.push(
      'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
      'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
    );
  }
  if (s.iranDirect) lines.push('RULE-SET,ir,DIRECT');
  return lines;
}

/* ── panel-facing summary + previews ─────────────────────────────────── */

export function routingSummary(doc) {
  const s = routingSettings(doc);
  const preset = dnsPreset(s.dns);
  return {
    settings: s,
    defaults: ROUTING_DEFAULTS,
    assets: rulesAssets(),
    dns: { key: s.dns, ...preset },
    dnsPresets: Object.entries(DNS_PRESETS).map(([key, v]) => ({ key, ...v })),
    source: ROUTING_SOURCE,
    geoFiles: GEO_FILES,
    counts: {
      serverRules: serverXrayRules(s).length,
      xrayRules: xrayRules(s).length,
      singboxRuleSets: singboxRuleSets(s).length,
      clashRules: clashRules(s).length,
    },
  };
}

export function previewRouting(doc) {
  const s = routingSettings(doc);
  const assets = rulesAssets();
  return {
    server: JSON.stringify({
      xray: { domainStrategy: 'IPIfNonMatch', rules: serverXrayRules(s, assets) },
      singbox: (() => { const r = serverSingboxRules(s, assets); return { rule_set: r.ruleSets.map((x) => ({ ...x, path: x.path ? x.path.replace(/^.*\/srs\//, 'srs/') : undefined })), rules: r.rules }; })(),
    }, null, 2),
    xray: JSON.stringify({ dns: xrayDns(s), routing: { domainStrategy: s.enabled ? 'IPIfNonMatch' : 'AsIs', rules: xrayRules(s) } }, null, 2),
    singbox: JSON.stringify({ dns: singboxDns(s), route: { rule_set: singboxRuleSets(s), rules: singboxRules(s) } }, null, 2),
    clash: [
      'rule-providers:',
      ...Object.entries(clashProviders(s)).flatMap(([key, v]) => [
        `  ${key}:`,
        `    type: ${v.type}`,
        `    behavior: ${v.behavior}`,
        `    format: ${v.format}`,
        `    url: "${v.url}"`,
        `    path: ${v.path}`,
        `    interval: ${v.interval}`,
      ]),
      'rules:',
      ...clashRules(s).map((line) => `  - ${line}`),
      '  - MATCH,PROXY',
    ].join('\n'),
  };
}
