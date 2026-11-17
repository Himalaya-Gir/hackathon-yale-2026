// Package A1: downloads photo candidates (NASA Image Library + Wikimedia Commons) into scripts/.cache/a1/.
// Usage: node scripts/photo-fetch.mjs nasa|commons [key ...]
// Candidates are then reviewed on contact sheets (scripts/photo-sheet.mjs) and assigned by hand in scripts/photos.ts.
import fs from 'fs';

const DIR = 'scripts/.cache/a1';
fs.mkdirSync(DIR, { recursive: true });
const META = `${DIR}/meta-${process.argv[2]}.json`;
const meta = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : {};
const UA = { 'User-Agent': 'campus-events-hackathon/1.0 (student hackathon demo)' };
const only = process.argv.slice(3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NASA = {
  nrocket: 'university students rocket team', ncubesat: 'cubesat students', nrobot: 'student robotics competition team',
  nclean: 'engineers clean room spacecraft', ncontrol: 'mission control flight controllers consoles', nscope: 'telescope observatory night stars',
  nsky: 'milky way night sky', nlaunch: 'rocket launch night streak', nposter: 'poster session students', nintern: 'interns engineers lab tour',
  npanel: 'panel discussion audience', nhack: 'space apps challenge', ndrone: 'students drone flight test', nsolar: 'solar array field',
  ntunnel: 'wind tunnel model engineer', nprint: '3D printer engineer', nvr: 'virtual reality headset engineer', nrover: 'rover students competition',
  nengine: 'engine hot fire test stand', ncareer: 'career fair students', ncode: 'students laptops coding', nplant: 'plant growth experiment researcher',
  naurora: 'aurora from space station', nearth: 'earth from orbit night city lights', nclass: 'students classroom astronaut talk', nmoon: 'moon telescope public viewing',
  nbalance: 'students high altitude balloon', nweld: 'technician welding rocket', nlab: 'researcher laboratory microscope', nstem: 'college students engineering design challenge',
};
const COMMONS = {
  concert: 'jazz concert stage live band', choir: 'a cappella choir singing students', orchestra: 'orchestra rehearsal students', improv: 'improv comedy performers stage',
  run: 'group of runners jogging park', eastrock: 'East Rock Park New Haven', sml: 'Sterling Memorial Library', yuag: 'Yale University Art Gallery interior',
  beinecke: 'Beinecke Library interior', oldcampus: 'Yale Old Campus', kroon: 'Kroon Hall Yale', peabody: 'Yale Peabody Museum', woolsey: 'Woolsey Hall',
  marsh: 'botanical garden greenhouse interior', dance: 'swing dance social dancers', salsa: 'dance class studio', pottery: 'pottery class wheel',
  painting: 'painting class studio easel', meditation: 'group meditation session', climbing: 'indoor climbing gym', cooking: 'cooking class people kitchen',
  film: 'film screening audience cinema', coffee: 'cafe people talking table', market: 'farmers market autumn', garden: 'community garden volunteers',
  treeplant: 'volunteers planting trees', tutoring: 'volunteer tutoring students', trading: 'trading floor screens', debate: 'students debate tournament',
  startup: 'startup team whiteboard office', network: 'networking reception people talking', chess: 'chess club players', openmic: 'open mic night performer',
  trivia: 'pub quiz night', potluck: 'potluck dinner friends', pizza: 'students eating pizza', bike: 'group bike ride city', soccer: 'intramural soccer evening',
  skating: 'ice skating rink people', poetry: 'poetry reading audience bookstore', gallery: 'art gallery opening visitors', medsim: 'medical students simulation training',
  robotarm: 'robotics laboratory university students robot', server: 'data center server room', turbine: 'wind turbines landscape', solarcar: 'solar car team students',
  library: 'students studying library night', hike: 'hikers autumn forest trail', sunrise: 'sunrise yoga group', taichi: 'tai chi park group', drum: 'drum circle',
  ceramics: 'printmaking workshop studio', knit: 'knitting group', theatre: 'theatre rehearsal stage students', quad: 'Yale University campus autumn',
  hillhouse: 'Hillhouse Avenue New Haven', harkness: 'Harkness Tower', greenNH: 'New Haven Green', makers: 'makerspace students soldering', workshop: 'workshop participants laptops university',
};

async function dl(url, file) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 30000) throw new Error('too small');
  fs.writeFileSync(file, buf);
}

if (process.argv[2] === 'nasa') {
  const jobs = Object.entries(NASA).filter(([k]) => !only.length || only.includes(k)).map(async ([k, q]) => {
    if (meta[k]) return;
    try {
      const d = await (await fetch(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&year_start=2014`)).json();
      const items = d.collection.items.filter((x) => x.links?.[0]?.href).slice(0, 5);
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i]; const dd = it.data[0];
        const url = it.links[0].href.replace('~thumb', '~large').replace('~small', '~large').replace('~medium', '~large');
        try { await dl(url, `${DIR}/${k}-${i}.jpg`); } catch { try { await dl(url.replace('~large', '~medium'), `${DIR}/${k}-${i}.jpg`); } catch (e) { console.log(k, i, e.message); continue; } }
        out.push({ i, nasa_id: dd.nasa_id, title: dd.title, credit: dd.photographer || dd.secondary_creator || dd.center || 'NASA', url: `https://images.nasa.gov/details/${dd.nasa_id}` });
      }
      meta[k] = out; console.log(k, out.length);
    } catch (e) { console.log(k, 'ERR', e.message); }
  });
  await Promise.all(jobs);
} else if (process.argv[2] === 'ov') {
  // Openverse (no key): CC BY / BY-SA / CC0 / public-domain photographs, mostly hosted on Flickr.
  const todo = Object.entries(COMMONS).filter(([k]) => !((only.length && !only.includes(k)) || meta[k]));
  const one = async ([k, q]) => {
    try {
      const u = 'https://api.openverse.org/v1/images/?' + new URLSearchParams({ q, license: 'by,by-sa,cc0,pdm', aspect_ratio: 'wide', page_size: '12' });
      const d = await (await fetch(u, { headers: UA })).json();
      const c = (d.results ?? []).filter((r) => r.width >= 1024 && r.width / r.height >= 1.3 && r.width / r.height <= 2 && /\.jpe?g$/i.test(r.url)).slice(0, 4);
      const out = [];
      for (let i = 0; i < c.length; i++) {
        const r = c[i];
        try {
          try { if (!/staticflickr/.test(r.url)) throw 0; await dl(r.url.replace(/_b\.jpg$/, '_h.jpg'), `${DIR}/o${k}-${i}.jpg`); } catch { await dl(r.url, `${DIR}/o${k}-${i}.jpg`); }
          out.push({ i, title: r.title, artist: r.creator, license: `CC ${String(r.license).toUpperCase()} ${r.license_version ?? ''}`.trim(), page: r.foreign_landing_url, source: r.source });
        } catch (e) { console.log(k, i, e.message ?? e); }
      }
      meta['o' + k] = out; meta[k] = true; console.log(k, out.length);
      fs.writeFileSync(META, JSON.stringify(meta, null, 1));
    } catch (e) { console.log(k, 'ERR', e.message); await sleep(20000); }
    await sleep(1500);
  };
  await Promise.all([0, 1, 2, 3].map(async () => { while (todo.length) await one(todo.shift()); }));
} else {
  for (const [k, q] of Object.entries(COMMONS)) {
    if ((only.length && !only.includes(k)) || meta[k]) continue;
    try {
      const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: q + ' filetype:bitmap', gsrnamespace: '6', gsrlimit: '15', prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '1280' });
      const d = await (await fetch(u, { headers: UA })).json();
      const pages = Object.values(d.query?.pages ?? {}).sort((a, b) => a.index - b.index);
      const c = [];
      for (const p of pages) {
        const ii = p.imageinfo[0];
        if (ii.mime !== 'image/jpeg' || ii.width < 1600 || ii.width < ii.height * 1.2) continue;
        const m = ii.extmetadata ?? {};
        c.push({ title: p.title, thumb: ii.thumburl, page: ii.descriptionurl, license: m.LicenseShortName?.value ?? '', artist: String(m.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 100) });
      }
      const out = [];
      for (let i = 0; i < Math.min(3, c.length); i++) {
        try { await dl(c[i].thumb, `${DIR}/${k}-${i}.jpg`); out.push({ i, ...c[i] }); } catch (e) { console.log(k, i, e.message); }
        await sleep(1200);
      }
      meta[k] = out; console.log(k, out.length);
      fs.writeFileSync(META, JSON.stringify(meta, null, 1));
    } catch (e) { console.log(k, 'ERR', e.message); await sleep(30000); }
    await sleep(4000);
  }
}
fs.writeFileSync(META, JSON.stringify(meta, null, 1));
