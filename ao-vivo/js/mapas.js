// OSCARPES AO VIVO — mapas.js
// MAPAS EM CAMADAS: os mapas da mesma fazenda viram UMA janela com abas (nutriente, profundidade,
// ano), pedidos ao servidor sob demanda e guardados.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './desenhos.js?v=20261010213811';
import { DEMO, ROTA_VOZ, diag, esc } from './base.js?v=20261010213811';
import { token } from './servidor.js?v=20261010213811';
import { ajustarMapasAnos, dossie, focado, htmlDoBloco, paineisVivos } from './telas.js?v=20261010213811';
import { normTela } from './comandos.js?v=20261010213811';
import { Zoom, abrirVisorDaJanela } from './visor.js?v=20261010213811';
import { mapaDemoQuadrado } from './demo.js?v=20261010213811';

// ---------------------------------------------------------------------------
// MAPAS EM CAMADAS E O VISOR EM TELA CHEIA (02/out/2026, noite)
// ---------------------------------------------------------------------------
// João: "o mapa não abriu legal, mostrou só uma ponta do mapa, não consegui
// clicar e navegar como se fosse uma página normal, ele tem que ficar moderno,
// mas quando eu quiser olhar tem que ficar usual". Os 5 mapas da mesma fazenda
// (P, K, pH, MO…) viram UMA janela com abas; "TELA CHEIA" abre o visor: a
// imagem inteira na tela, roda/pinça para aproximar, arrastar, abas das
// camadas, ←/→ troca, BAIXAR PNG, Esc fecha.
let mapasRecebidos = [];            // { alvo, nome, src } — o modo fazenda mostra na Fertilidade
/** "Mapa de P res 0-20 · Fazenda Pato Branco I" → { nome: 'P res 0-20', alvo: 'Fazenda Pato Branco I' } */
function partesDaLegenda(legenda) {
  // "Mapa de P res 0-20 · Fazenda X · 2025" (o ano vem quando o servidor sabe qual é — 03/out/2026)
  const m = /^\s*mapa de (.+?)\s+·\s+(.+?)(?:\s+·\s+(20\d\d))?\s*$/i.exec(String(legenda || ''));
  if (!m) return { nome: String(legenda || 'Mapa').trim(), alvo: '', param: String(legenda || 'Mapa').trim(), prof: null, ano: null };
  const nome = m[1].trim(), pm = /^(.*?)\s+(\d+\s*-\s*\d+)\s*(cm)?$/i.exec(nome);
  return { nome, alvo: m[2].trim(), param: pm ? pm[1].trim() : nome, prof: pm ? pm[2].replace(/\s/g, '') : null, ano: m[3] ? Number(m[3]) : null };
}
// <montarCamadas> (função pura — o portão roda ela)
/** Itens [{param, prof, ano, src}] de UMA fazenda → o que a janela mostra:
 *  - o MESMO nutriente em 2+ anos → modo "anos" (lado a lado, mesma escala);
 *  - senão, uma aba por nutriente; em cada uma a 0-20 GRANDE e as outras camadas pequenas ao lado
 *    (João, 03/out: "a prioridade é sempre de 0 a 20 … deixa as de 0 a 10 e de 20 a 40 menores do lado"). */
function montarCamadas(itens) {
  const params = [...new Set(itens.map((x) => x.param))], anos = [...new Set(itens.map((x) => x.ano).filter((a) => a != null))].sort();
  if (params.length === 1 && anos.length >= 2) {
    return { modo: 'anos', param: params[0], prof: itens[0].prof, anos: anos.map((ano) => itens.find((x) => x.ano === ano)) };
  }
  const ordemProf = (p) => (p === '0-20' ? -1 : p == null ? 0 : Number(String(p).split('-')[0]) * 100 + Number(String(p).split('-')[1] || 0));
  return { modo: 'nutrientes', camadas: params.map((param) => {
    const deste = itens.filter((x) => x.param === param).sort((a, b) => ordemProf(a.prof) - ordemProf(b.prof));
    const principal = deste[0];
    return { nome: param, prof: principal.prof, ano: principal.ano, src: principal.src, outras: deste.slice(1).map((x) => ({ prof: x.prof, ano: x.ano, src: x.src })) };
  }) };
}
// </montarCamadas>
/** As imagens da fala: os mapas da mesma fazenda viram UMA janela (o explorador de camadas, ou os anos lado a lado). */
function agruparMapas(telas) {
  const grupos = new Map(), outras = [];
  for (const t of telas) {
    if (t.ferramenta !== 'imagem') { outras.push(t); continue; }
    const b64 = String((t.resultado || {}).base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (!b64) continue;
    const mime = /^image\/(png|jpeg|webp)$/.test((t.resultado || {}).mime || '') ? t.resultado.mime : 'image/png';
    const pt = partesDaLegenda((t.resultado || {}).legenda);
    const chave = pt.alvo ? normTela(pt.alvo) : '§' + grupos.size;
    if (!grupos.has(chave)) grupos.set(chave, { alvo: pt.alvo, itens: [] });
    grupos.get(chave).itens.push({ param: pt.param, prof: pt.prof, ano: pt.ano, nome: pt.nome, src: `data:${mime};base64,${b64}`, mapa: (t.resultado || {}).mapa || null });
  }
  const corpos = [...grupos.values()].map((g) => {
    if (g.alvo) for (const c of g.itens) { mapasRecebidos = mapasRecebidos.filter((x) => !(normTela(x.alvo) === normTela(g.alvo) && x.param === c.param && x.prof === c.prof && x.ano === c.ano)); mapasRecebidos.push({ alvo: g.alvo, ...c }); }
    mapasRecebidos = mapasRecebidos.slice(-24);
    return corpoDeCamadas(g.alvo, g.itens);
  });
  return { corpos, outras };
}

// ---------------------------------------------------------------------------
// O EXPLORADOR DE CAMADAS (03/out/2026) — João: "em cima dos mapas você colocou os botões de P, K,
// pH e MO, porém tinha espaço para colocar TODOS, e também as profundidades" e "não vi os mapas
// menores dessas profundidades". TODOS os atributos que a fazenda tem (agrupados), as camadas
// (0-20 primeiro) e os anos (o de só grade dito). A camada que ainda não veio é DESENHADA NA HORA
// (rota direta da tela → enviar_mapa_fertilidade, sem o agente) e fica guardada. As outras duas
// profundidades aparecem SEMPRE pequenas ao lado (desenhadas sem pedir); clique troca.
// A causa do "não vi os menores": desde 03/out o servidor desenha só a 0-20 (prioridade do João),
// e a tela só mostrava camada pequena que o servidor tivesse mandado — nunca vinha nenhuma.
// ---------------------------------------------------------------------------
const GRUPOS_ATRIBUTO = [
  ['Macro', ['P res', 'P mehl', 'P meh', 'P', 'K', 'K mg', 'Ca', 'Mg', 'S']],
  ['Acidez', ['pH CaCl2', 'pH Agua', 'pH', 'Al', 'H/Al', 'm%', 'V%', 'SB', 'CTC', 't', 'Al%', 'H/Al%', 'H%']],
  ['Orgânica', ['MOS', 'MO']],
  ['Micro', ['B', 'Cu', 'Fe', 'Mn', 'Zn']],
  ['Relações', ['Ca/Mg', 'Ca/K', 'Mg/K', 'Ca+Mg/K', 'Ca+Mg', 'Ca%', 'Mg%', 'K%']],
  ['Física', ['Argila', 'Silte', 'Areia total', 'Areia']],
];
// <gruposDeAtributos> (função pura — o portão roda ela)
/** Os atributos que existem, nos grupos da casa (o que não está em grupo nenhum vai para "Outros"). */
function gruposDeAtributos(parametros) {
  const resto = new Set(parametros), out = [];
  for (const [nome, lista] of GRUPOS_ATRIBUTO) { const tem = lista.filter((p) => resto.has(p)); tem.forEach((p) => resto.delete(p)); if (tem.length) out.push([nome, tem]); }
  if (resto.size) out.push(['Outros', [...resto].sort()]);
  return out;
}
// </gruposDeAtributos>
const ordemProf = (p) => (p === '0-20' ? -1 : p == null ? 0 : Number(String(p).split('-')[0]) * 100 + Number(String(p).split('-')[1] || 0));
const chaveCamada = (param, prof, ano) => `${param}|${prof || ''}|${ano || ''}`;
function corpoDeCamadas(alvo, itens) {
  const m = montarCamadas(itens);
  if (m.modo === 'anos') {
    return { rotulo: `${m.param}${m.prof ? ' · ' + m.prof + ' cm' : ''} · ${m.anos.length} anos, mesma escala`, titulo: alvo || m.param, sub: m.anos.map((x) => x.ano).join(' · '), ferramenta: 'imagem',
      blocos: [{ tipo: 'mapas-anos', param: m.param, prof: m.prof, itens: m.anos }] };
  }
  // o que existe: o que o servidor disse (disponiveis) somado ao que chegou
  const ext = itens.map((x) => x.mapa).filter(Boolean);
  const parametros = [...new Set([...ext.flatMap((e) => (e.disponiveis || {}).parametros || []), ...itens.map((x) => x.param)])];
  const profundidades = [...new Set([...ext.flatMap((e) => (e.disponiveis || {}).profundidades || []), ...itens.map((x) => x.prof).filter(Boolean), ...(DEMO ? ['0-20', '0-10', '20-40'] : [])])].sort((a, b) => ordemProf(a) - ordemProf(b));
  const anos = [];
  for (const e of ext) for (const a of ((e.disponiveis || {}).anos || [])) if (!anos.some((x) => String(x.ano) === String(a.ano))) anos.push({ ano: Number(a.ano), fonte: a.fonte });
  for (const x of itens) if (x.ano && !anos.some((a) => a.ano === x.ano)) anos.push({ ano: x.ano, fonte: (x.mapa || {}).fonte || 'talhões' });
  anos.sort((a, b) => a.ano - b.ano);
  const cache = {};
  for (const x of itens) cache[chaveCamada(x.param, x.prof, x.ano)] = { src: x.src, fonte: (x.mapa || {}).fonte || null };
  const p0 = m.camadas[0];
  const ctx = { alvo, fazenda: (ext[0] || {}).fazenda || String(alvo || '').replace(/^fazenda\s+/i, '').replace(/\s+·\s+talh.*$/i, ''), talhao: (ext[0] || {}).talhao || null };
  return { rotulo: 'Mapas de fertilidade', titulo: alvo || p0.nome, sub: '', ferramenta: 'imagem',
    blocos: [{ tipo: 'camadas', ctx, disp: { parametros, profundidades, anos }, sel: { param: p0.nome, prof: p0.prof, ano: p0.ano }, cache, pend: {} }] };
}
/** Pede UMA camada ao servidor (rota direta) — ou desenha a de mentira no ?demo. */
async function pedirMapa(ctx, param, prof, ano) {
  if (DEMO) { await new Promise((ok) => setTimeout(ok, 650)); return { src: 'data:image/png;base64,' + mapaDemoQuadrado(`${param} ${prof || ''}${ano ? ' · ' + ano : ''}`, (param.length * 7 + (prof || '').length * 3 + (ano || 0)) % 9), fonte: ano === 2026 ? 'amostragem em grade' : 'talhões',
    disp: { parametros: ['P res', 'K', 'Ca', 'Mg', 'S', 'pH CaCl2', 'Al', 'H/Al', 'm%', 'V%', 'CTC', 'SB', 'MOS', 'B', 'Cu', 'Fe', 'Mn', 'Zn', 'Ca/Mg', 'Ca/K', 'Mg/K', 'Argila'], profundidades: ['0-20', '0-10', '20-40'], anos: [{ ano: 2024, fonte: 'talhões' }, { ano: 2025, fonte: 'talhões' }, { ano: 2026, fonte: 'amostragem em grade' }] } }; }
  const t = await token(); if (!t) return { erro: 'Entre no app' };
  try {
    const r = await fetch(ROTA_VOZ, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
      body: JSON.stringify({ direto: { ferramenta: 'enviar_mapa_fertilidade', argumentos: { fazenda: ctx.fazenda, ...(ctx.talhao ? { talhao: ctx.talhao } : {}), ...(dossie && dossie.cliente ? { cliente: dossie.cliente } : {}), parametro: param, ...(prof ? { profundidade: prof } : {}), ...(ano ? { ano: String(ano) } : {}) } } }) });
    const c = await r.json().catch(() => ({}));
    const img = (c.telas || []).find((x) => x.ferramenta === 'imagem');
    if (img && img.resultado && img.resultado.base64) { const mp = img.resultado.mapa || {}; return { src: `data:${img.resultado.mime || 'image/png'};base64,${img.resultado.base64}`, fonte: mp.fonte || null, ano: mp.ano || null, disp: mp.disponiveis || null }; }
    return { erro: (c.resultado && c.resultado.erro) || c.erro || 'Não consegui desenhar esta camada.' };
  } catch (e) { return { erro: 'Sem conexão.' }; }
}
/** Garante que a camada (e depois as outras duas profundidades) esteja guardada; redesenha quando chega. */
function garantirCamada(el, b, param, prof, ano) {
  const k = chaveCamada(param, prof, ano);
  if (b.cache[k] || b.pend[k]) return b.pend[k] || Promise.resolve(b.cache[k]);
  b.pend[k] = pedirMapa(b.ctx, param, prof, ano).then((r) => {
    b.cache[k] = r; delete b.pend[k];
    // o servidor diz o que mais existe (todos os atributos, camadas e anos) — os botões crescem
    if (r && r.disp) {
      for (const p2 of r.disp.parametros || []) if (!b.disp.parametros.includes(p2)) b.disp.parametros.push(p2);
      for (const p2 of r.disp.profundidades || []) if (!b.disp.profundidades.includes(p2)) b.disp.profundidades.push(p2);
      b.disp.profundidades.sort((x, y) => ordemProf(x) - ordemProf(y));
      for (const a of r.disp.anos || []) if (!b.disp.anos.some((x) => String(x.ano) === String(a.ano))) b.disp.anos.push({ ano: Number(a.ano), fonte: a.fonte });
      b.disp.anos.sort((x, y) => x.ano - y.ano);
    } if (paineisVivos.includes(el)) redesenharMapas(el); diag('camada pronta ' + param + ' ' + prof); return r; });
  return b.pend[k];
}
function outrasProfundidades(b) { return b.disp.profundidades.filter((p) => p !== b.sel.prof).sort((a, c) => ordemProf(a) - ordemProf(c)).slice(0, 3); }
/** A principal primeiro; as pequenas depois (uma por vez, para não encher o desenhista). */
async function carregarCamadas(el, b) {
  await garantirCamada(el, b, b.sel.param, b.sel.prof, b.sel.ano);
  for (const p of outrasProfundidades(b)) await garantirCamada(el, b, b.sel.param, p, b.sel.ano);
}
function htmlExplorador(b) {
  const s = b.sel, k = chaveCamada(s.param, s.prof, s.ano), c = b.cache[k];
  const chip = (txt, attr, on, extra = '') => `<button ${attr} class="${on ? 'on' : ''}${extra}">${esc(txt)}</button>`;
  const grupos = gruposDeAtributos(b.disp.parametros).map(([g, ps]) => `<span class="grupo-rot">${esc(g)}</span>${ps.map((p) => chip(p, `data-param="${esc(p)}"`, p === s.param, Object.keys(b.cache).some((x) => x.startsWith(p + '|')) ? ' carregado' : '')).join('')}`).join('');
  const profs = b.disp.profundidades.map((p) => chip(p + ' cm', `data-prof="${esc(p)}"`, p === s.prof)).join('');
  const anos = b.disp.anos.length > 1 ? `<span class="grupo-rot">Ano</span>${b.disp.anos.map((a) => chip(`${a.ano}${a.fonte && a.fonte !== 'talhões' ? ' · grade' : ''}`, `data-ano="${a.ano}"`, Number(a.ano) === Number(s.ano))).join('')}` : '';
  const rot = (p, a, f) => `${p ? p + ' cm' : ''}${a ? ' · ' + a : ''}${f && f !== 'talhões' ? ' · amostragem em grade' : ''}`;
  const principal = c && c.src ? `<img alt="${esc(s.param)}" src="${c.src}">` : c && c.erro ? `<div class="sem-camada">${esc(c.erro)}</div>` : '<div class="carregando-mapa"></div>';
  const pequenas = outrasProfundidades(b).map((p) => { const o = b.cache[chaveCamada(s.param, p, s.ano)];
    return `<button class="outra-prof" data-outra="${esc(p)}" title="Trocar para ${esc(p)} cm">${o && o.src ? `<img alt="" src="${o.src}">` : o && o.erro ? '<div class="sem-camada">—</div>' : '<div class="carregando-mapa"></div>'}<span>${esc(rot(p, s.ano))}</span></button>`; }).join('');
  return `<div class="chips-mapas">${grupos}</div><div class="chips-mapas linha2"><span class="grupo-rot">Camada</span>${profs}${anos}</div>` +
    `<div class="mapa-e-camadas"><figure class="moldura"><div class="quadro">${principal}</div><figcaption>${esc(s.param)} · ${esc(rot(s.prof, s.ano, c && c.fonte))}</figcaption><button class="tela-cheia" title="Abrir em tela cheia">⤢ TELA CHEIA</button></figure>` +
    (pequenas ? `<div class="outras-prof">${pequenas}</div>` : '') + '</div>';
}
/** Redesenha o corpo da janela de mapas e religa os botões (atributo, camada, ano, camada pequena, tela cheia, zoom). */
function religarMapas(el) {
  const b = (el._parte.blocos || []).find((x) => x.tipo === 'camadas');
  if (b) {
    el.querySelectorAll('[data-param]').forEach((x) => { x.onclick = (e) => { e.stopPropagation(); escolherCamada(el, { param: x.dataset.param }); }; });
    el.querySelectorAll('[data-prof]').forEach((x) => { x.onclick = (e) => { e.stopPropagation(); escolherCamada(el, { prof: x.dataset.prof }); }; });
    el.querySelectorAll('[data-ano]').forEach((x) => { x.onclick = (e) => { e.stopPropagation(); escolherCamada(el, { ano: Number(x.dataset.ano) }); }; });
    el.querySelectorAll('.outra-prof').forEach((x) => { x.onclick = (e) => { e.stopPropagation(); escolherCamada(el, { prof: x.dataset.outra }); }; });
    if (!el._carregando) { el._carregando = true; carregarCamadas(el, b).finally(() => { el._carregando = false; }); }
  }
  el.querySelectorAll('.ano-mapa').forEach((x) => { x.onclick = (e) => { e.stopPropagation(); abrirVisorDaJanela(el, +x.dataset.ano); }; });
  // 05/out/2026: a galeria de fotos abre a 1ª foto grande sozinha (é o que a pessoa pediu para VER)
  if (el.querySelector('.mapas-anos.fotos') && !el._fotosAbertas) { el._fotosAbertas = true; setTimeout(() => { if (el.isConnected) abrirVisorDaJanela(el, 0); }, 900); }
  el.querySelectorAll('.tela-cheia').forEach((x) => { x.onclick = (e) => { e.stopPropagation(); abrirVisorDaJanela(el); }; });
  el.querySelectorAll('.quadro').forEach(Zoom.ligar);
  requestAnimationFrame(() => ajustarMapasAnos(el));
}
function redesenharMapas(el) {
  el.querySelector('.corpo').innerHTML = el._parte.blocos.map((b) => htmlDoBloco(b, el === focado)).join('');
  religarMapas(el);
}
function escolherCamada(el, mudar) {
  const b = (el._parte.blocos || []).find((x) => x.tipo === 'camadas'); if (!b) return;
  Object.assign(b.sel, mudar);
  if (!b.sel.prof && b.disp.profundidades.length) b.sel.prof = b.disp.profundidades[0];
  redesenharMapas(el); diag('camada ' + b.sel.param + ' ' + b.sel.prof + ' ' + (b.sel.ano || ''));
}
function trocarCamada(el, i) { const b = (el._parte.blocos || []).find((x) => x.tipo === 'camadas'); if (b && b.disp.parametros[i]) escolherCamada(el, { param: b.disp.parametros[i] }); }
function trocarProfundidade(el, prof) { escolherCamada(el, { prof }); }
/** "mostra a de 20 a 40" → a janela de mapas troca a camada grande. */
function trocarProfundidadePorVoz(frase) {
  const m = /\b(\d{1,2})\s*(?:a|-|ate)\s*(\d{2})\b/.exec(normTela(frase)); if (!m) return false;
  const prof = `${Number(m[1])}-${Number(m[2])}`;
  const el = (focado && focado.dataset.tipo === 'imagem' ? focado : paineisVivos.find((x) => x.dataset.tipo === 'imagem')); if (!el) return false;
  const b = (el._parte.blocos || []).find((x) => x.tipo === 'camadas'); if (!b || !b.disp.profundidades.includes(prof)) return false;
  escolherCamada(el, { prof }); return true;
}

export {
  mapasRecebidos, agruparMapas, chaveCamada, corpoDeCamadas, htmlExplorador, religarMapas,
  trocarProfundidadePorVoz,
};
