#!/usr/bin/env node
// «Показ»: забирает статику из github.com/ztim2008/responsive-showcase и кладёт в public/pokaz/
// с правками под хаб (canonical, иконка, Метрика, ссылка на Konversus в шапке).
// Запуск: npm run pokaz:sync (затем npm run build). Правки руками в public/pokaz/ затрутся.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RAW = "https://raw.githubusercontent.com/ztim2008/responsive-showcase/main";
const OUT = path.resolve(import.meta.dirname, "../public/pokaz");
const URL_SELF = "https://leads.konversus.ru/pokaz";
const YM_ID = 113690601;

async function fetchText(file) {
  const res = await fetch(`${RAW}/${file}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.text();
}

function replaceOnce(html, from, to, label) {
  if (!html.includes(from)) throw new Error(`Не найден якорь «${label}» — разметка upstream изменилась, обнови scripts/pokaz-sync.mjs`);
  return html.replace(from, to);
}

const HEAD_INJECT = `
  <style>
    .kv-hub { display:flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; letter-spacing:-.02em }
    .kv-hub:hover { color:var(--ink) }
    .kv-mark { width:25px; height:25px; display:grid; place-items:center; border-radius:4px; background:linear-gradient(135deg,#22c55e,#3b82f6); color:#fff; font-size:13px; font-weight:800 }
    .kv-sep { color:var(--line); font-weight:400 }
    @media (max-width:560px) { .kv-name { display:none } }
  </style>
  <script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r)return}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}","ym");ym(${YM_ID},"init",{webvisor:true,clickmap:true,trackLinks:true,accurateTrackBounce:true});</script>
</head>`;

const BRAND_FROM = `<div class="brand"><span class="brand-mark">P</span> показ</div>`;
const BRAND_TO = `<div class="brand"><a class="kv-hub" href="/" title="Konversus — все сервисы"><span class="kv-mark">K</span><span class="kv-name">Konversus</span></a><span class="kv-sep">/</span><span class="brand-mark">P</span> показ</div>`;

let html = await fetchText("index.html");
html = html.replaceAll("https://ztim2008.github.io/responsive-showcase/", URL_SELF);
html = replaceOnce(html, `href="favicon.svg"`, `href="/pokaz/favicon.svg"`, "favicon");
html = replaceOnce(html, "</head>", HEAD_INJECT.trimStart(), "</head>");
html = replaceOnce(html, BRAND_FROM, BRAND_TO, "brand в шапке");

const favicon = await fetchText("favicon.svg");

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "index.html"), html);
await writeFile(path.join(OUT, "favicon.svg"), favicon);
console.log(`pokaz: ${OUT}/index.html (${html.length} байт) + favicon.svg`);
