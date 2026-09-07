import assert from 'node:assert/strict';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
const output = process.env.TEST_OUTPUT_DIR ?? '/tmp/hunteragent-film';
await mkdir(output, { recursive: true });
const timing = JSON.parse(await readFile(new URL('../media/what-if/timing.json', import.meta.url), 'utf8'));
for (const [name, width, height] of [['what-if-hero.mp4', 1280, 720], ['what-if-hero-portrait.mp4', 540, 960]]) {
const asset = await stat(new URL(`../public/films/${name}`, import.meta.url));
assert.ok(asset.size < 1_800_000, 'Each complete hero stays below 1.8 MB');
const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', new URL(`../public/films/${name}`, import.meta.url).pathname], { encoding: 'utf8' }));
assert.equal(metadata.streams.length, 1, 'Hero preview has no audio track');
assert.equal(metadata.streams[0].codec_type, 'video');
assert.ok(Math.abs(Number(metadata.format.duration) - timing.durationSeconds) < .1);
assert.equal(metadata.streams[0].width, width);
assert.equal(metadata.streams[0].height, height);
console.log(`PASS: ${name}: ${asset.size} bytes, silent, ${timing.durationSeconds}s`);
}
const renderer = await readFile(new URL('../media/what-if/render_concept.py', import.meta.url), 'utf8');
const storyText = await readFile(new URL('../media/what-if/story.json', import.meta.url), 'utf8');
const story = JSON.parse(storyText);
const beat = 60 / timing.bpm;
for (const [index, scene] of story.entries()) {
  assert.ok(Math.abs(scene.start / beat - Math.round(scene.start / beat)) < .001, 'Every scene change lands on a musical beat');
  assert.equal(scene.start + scene.duration, story[index + 1]?.start ?? timing.durationSeconds, 'No timeline gaps');
}
assert.equal(story.find((scene) => scene.reflection).duration, 3, 'Three-second reading hold, not the overlong six-second pause');
assert.ok(story.filter((scene) => scene.clipIndex).every((scene) => scene.duration === 3), 'Career shots are tightened to three seconds');
assert.equal(execFileSync('unzip', ['-p', new URL('../media/what-if/render-source.zip', import.meta.url).pathname, 'timing.json'], {encoding:'utf8'}), await readFile(new URL('../media/what-if/timing.json', import.meta.url), 'utf8'));
assert.deepEqual(story.filter((scene) => scene.clipIndex).map((scene) => scene.clipIndex), [1,2,3,4], 'All four career scenes are retained');
assert.equal(execFileSync('unzip', ['-p', new URL('../media/what-if/render-source.zip', import.meta.url).pathname, 'story.json'], {encoding:'utf8'}), storyText);
assert.ok(!renderer.includes('AI-CREATED CONCEPT'), 'No production label in the full-film renderer');
assert.equal(execFileSync('unzip', ['-p', new URL('../media/what-if/render-source.zip', import.meta.url).pathname, 'render_concept.py'], {encoding: 'utf8'}), renderer, 'Packaged render source stays in sync');
const archiveNames = execFileSync('unzip', ['-Z1', new URL('../media/what-if/render-source.zip', import.meta.url).pathname], {encoding:'utf8'}).trim().split('\n');
assert.ok(!archiveNames.some((name) => /\.(wav|mp3|caf)$/.test(name)), 'Licensed music is not redistributed as standalone audio in the source archive');
for (const name of ['manifest.json', 'music.json']) {
  assert.equal(execFileSync('unzip', ['-p', new URL('../media/what-if/render-source.zip', import.meta.url).pathname, name], {encoding:'utf8'}), await readFile(new URL(`../media/what-if/${name}`, import.meta.url), 'utf8'));
}
for (const [format, width, height] of [['landscape', 1920, 1080], ['portrait', 1080, 1920]]) {
  const fullMeta = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', new URL(`../public/films/what-if-${format}.mp4`, import.meta.url).pathname], {encoding: 'utf8'}));
  const stream = fullMeta.streams.find((item) => item.codec_type === 'video');
  assert.equal(stream.width, width); assert.equal(stream.height, height);
  assert.ok(Math.abs(Number(fullMeta.format.duration) - timing.durationSeconds) < .1);
  assert.ok(fullMeta.streams.some((item) => item.codec_type === 'audio'));
  const samples = execFileSync('ffmpeg', ['-v', 'error', '-i', new URL(`../public/films/what-if-${format}.mp4`, import.meta.url).pathname, '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], {maxBuffer: 2_000_000});
  let energy = 0, peak = 0;
  for (let i = 0; i < samples.length; i += 4) { const value = samples.readFloatLE(i); energy += value * value; peak = Math.max(peak, Math.abs(value)); }
  assert.ok(Math.sqrt(energy / (samples.length / 4)) > .025, 'Soundtrack is audible, not an empty audio stream');
  assert.ok(peak < .99, 'Soundtrack has headroom, not clipped samples');
}
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL ?? 'chrome' });
async function settle(page) { await page.waitForTimeout(300); }
async function playing(video) { await video.page().waitForFunction((element) => !element.paused && element.readyState >= 2, await video.elementHandle()); }
async function hidden(page, value) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}
async function leave(page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('#dream-film-player').paused && !document.querySelector('#dream-film-player source[src]'));
}
async function enter(page) { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); }

try {
  for (const [name, viewport] of [['desktop', {width: 1440, height: 900}], ['mobile', {width: 390, height: 844}]]) {
    for (const scenario of ['normal', 'reduced', 'blocked', 'no-observer', 'no-frame-callback']) {
      const page = await browser.newPage({ viewport, reducedMotion: scenario === 'reduced' ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(15000);
      const errors = [], requests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => { if (/\.mp4(?:\?|$)/.test(request.url())) requests.push(request.url()); });
      await page.addInitScript(({scenario}) => {
        window.__heroPlays = 0;
        window.__allowHeroPlay = scenario !== 'blocked';
        const original = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          if (this.id === 'dream-film-player') {
            window.__heroPlays++;
            if (!window.__allowHeroPlay) return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
          }
          return original.call(this);
        };
        if (scenario === 'no-observer') window.IntersectionObserver = undefined;
        if (scenario === 'no-frame-callback') HTMLVideoElement.prototype.requestVideoFrameCallback = undefined;
      }, { scenario });
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      const video = page.locator('#dream-film-player');
      const full = page.locator('dialog video');
      const watch = page.getByRole('button', { name: 'Watch the film', exact: true });
      await watch.waitFor();
      await settle(page);
      assert.equal(await page.locator('.hero-section #the-what-if').count(), 1, 'The film is in the hero, not a later section');
      assert.equal(await page.locator('#the-what-if').count(), 1);
      assert.equal(await video.getAttribute('preload'), 'none');
      assert.notEqual(await video.getAttribute('loop'), null);
      assert.ok(await video.getAttribute('poster'));
      assert.equal(await full.getAttribute('src'), null);
      const heroName = name === 'mobile' ? 'what-if-hero-portrait.mp4' : 'what-if-hero.mp4';
      assert.ok(requests.every((url) => new URL(url).pathname.endsWith(heroName)), 'Only the matching lightweight preview, not the full film or the other format, is downloaded');
      const boxes = await page.evaluate(() => ({
        video: document.querySelector('#dream-film-player').getBoundingClientRect().toJSON(),
        headline: document.querySelector('h1').getBoundingClientRect().toJSON(),
        cta: document.querySelector('.hero-actions .button').getBoundingClientRect().toJSON(),
        height: innerHeight,
      }));
      assert.ok(boxes.video.top >= 0 && boxes.video.bottom < boxes.height, 'Entire preview fits in the initial viewport');
      assert.ok(boxes.cta.bottom < boxes.height, 'Signup action is also above the fold');
      assert.ok(boxes.headline.left >= boxes.video.left && boxes.headline.right <= boxes.video.right, 'Live headline stays inside the film');
      assert.ok(boxes.headline.top >= boxes.video.top && boxes.headline.bottom < boxes.cta.top, 'Headline overlays the footage without covering the signup action');
      assert.equal(await page.getByRole('heading', {level: 1}).count(), 1);
      assert.equal(await page.getByRole('heading', {level: 1}).innerText(), 'What if this\nwas work?');
      const text = await page.locator('main').innerText();
      assert.ok(text.includes('Our agents search widely for roles'), 'The agent-search promise is explicit');
      for (const phrase of ['25 seconds. Your sound, your choice.', 'AI-created concept scenes, not advertised vacancies.', 'A little possibility. Replay whenever you like.', 'Keep your job. Keep your standards.', 'Three or five possibilities worth making a move for.']) assert.ok(!text.includes(phrase));
      if (scenario === 'normal' || scenario === 'no-frame-callback') await playing(video);
      else {
        assert.equal(await video.evaluate((element) => element.paused), true);
        if (scenario === 'reduced' || scenario === 'no-observer') assert.equal(requests.length, 0, 'Manual-only preference displays only the poster');
        if (scenario === 'blocked') {
          const count = await page.evaluate(() => window.__heroPlays);
          await leave(page); await enter(page); await settle(page);
          assert.equal(await page.evaluate(() => window.__heroPlays), count, 'Blocked autoplay is not retried endlessly');
          await page.evaluate(() => { window.__allowHeroPlay = true; });
        }
        await page.getByRole('button', {name:'Play preview', exact:true}).click();
        await playing(video);
      }
      assert.equal(await video.evaluate((element) => element.muted), true);
      if (scenario === 'normal' || scenario === 'no-frame-callback') {
        await video.evaluate((element) => { element.currentTime = 2.7; });
        await page.waitForFunction(() => document.querySelector('#dream-film-player').currentTime >= 3.35);
        assert.equal(await page.locator('h1').innerText(), story[1].lines.join('\n'), 'Motion copy follows the playing film across a cut');
        await page.getByRole('button', {name:'Pause preview', exact:true}).click();
        for (const [index, scene] of story.entries()) {
          await video.evaluate((element, time) => { element.currentTime = time; }, scene.start + .8);
          await page.waitForFunction((copy) => document.querySelector('h1').innerText === copy, scene.lines.join('\n'));
          await page.waitForTimeout(1000);
          assert.equal(await page.getByRole('heading', {level:1}).getAttribute('aria-label'), 'What if this was work?', 'Stable accessible heading, no repeated screen-reader announcements');
          const layout = await page.evaluate(() => {
            const heading = document.querySelector('h1'), cta = document.querySelector('.hero-actions .button');
            return {fits: [...heading.children].every((line) => line.scrollWidth <= line.clientWidth), bottom: heading.getBoundingClientRect().bottom, ctaTop: cta.getBoundingClientRect().top, ctaBottom: cta.getBoundingClientRect().bottom, height: innerHeight, fit: getComputedStyle(document.querySelector('#dream-film-player')).objectFit, video: document.querySelector('#dream-film-player').getBoundingClientRect().toJSON(), opacity: getComputedStyle(heading.parentElement).opacity};
          });
          assert.ok(layout.fits && layout.bottom < layout.ctaTop && layout.ctaBottom < layout.height, `Scene ${index} stays readable with signup visible`);
          assert.equal(layout.fit, 'cover', 'No mid-film object-fit switch');
          assert.deepEqual(layout.video, boxes.video, 'The video frame never changes size or position between scenes');
          assert.equal(Number(layout.opacity), 1, 'Headline is fully readable after its entrance');
          await page.screenshot({path:`${output}/${name}-scene-${index}.png`});
        }
        const reflection = story.find((scene) => scene.reflection);
        await video.evaluate((element, time) => { element.currentTime = time; }, reflection.start + reflection.duration - .3);
        await page.waitForFunction(() => document.querySelector('[data-reflection="true"]')?.style.opacity === '1');
        assert.equal(await page.locator('h1').innerText(), reflection.lines.join('\n'), 'Closing sentence stays fully readable until just before the cut');
        await page.getByRole('button', {name:'Play preview', exact:true}).click();
        await video.evaluate((element) => { element.currentTime = element.duration - 0.1; });
        await page.waitForFunction(() => {const v=document.querySelector('#dream-film-player'); return !v.paused && v.currentTime < 2;});
        await leave(page); await enter(page); await playing(video);
        await hidden(page, true);
        assert.equal(await video.evaluate((element) => element.paused), true);
        await hidden(page, false); await playing(video);
        await page.emulateMedia({reducedMotion:'reduce'}); await settle(page);
        assert.equal(await video.evaluate((element) => element.paused), true);
        await page.emulateMedia({reducedMotion:'no-preference'}); await playing(video);
      }
      await page.getByRole('button', {name:'Pause preview', exact:true}).click();
      const position = await video.evaluate((element) => element.currentTime);
      assert.equal(await video.evaluate((element) => element.paused), true);
      assert.ok(await video.evaluate((element) => element.readyState >= 2), 'An intentional pause retains the visible frame');
      const attempts = await page.evaluate(() => window.__heroPlays);
      await leave(page); await enter(page); await settle(page);
      await hidden(page, true); await hidden(page, false); await settle(page);
      assert.equal(await page.evaluate(() => window.__heroPlays), attempts, 'User pause survives scrolling and tab visibility changes');
      await watch.click();
      const dialog = page.getByRole('dialog', {name:'Find your what if.'});
      await dialog.waitFor(); await playing(full);
      assert.equal(await video.evaluate((element) => element.paused), true);
      assert.equal(await full.evaluate((element) => element.controls), true);
      assert.ok(await full.evaluate((element) => element.currentSrc.includes(innerWidth <= 600 ? 'portrait' : 'landscape')));
      assert.ok(Math.abs(await full.evaluate((element) => element.duration) - timing.durationSeconds) < 0.2);
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.ok(await page.evaluate(() => document.activeElement.closest('dialog') !== null), 'Focus moves inside the modal');
      assert.equal(await dialog.locator('details, summary').count(), 0, 'No visible transcript section');
      assert.ok(!(await dialog.innerText()).includes('Read the film'));
      for (let i=0; i<7; i++) {
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => document.activeElement.closest('dialog') !== null), 'Keyboard focus stays inside the modal');
      }
      await hidden(page, true);
      assert.equal(await full.evaluate((element) => element.paused), true);
      await hidden(page, false);
      assert.equal(await full.evaluate((element) => element.paused), true, 'Do not restart audible playback on tab return');
      await page.keyboard.press('Escape');
      await dialog.waitFor({state:'hidden'});
      await page.waitForFunction(() => !document.querySelector('dialog video').hasAttribute('src'));
      assert.equal(await full.getAttribute('src'), null, 'Closing the modal releases the full film');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      assert.equal(await watch.evaluate((element) => element === document.activeElement), true);
      assert.equal(await video.evaluate((element) => element.paused), true, 'Explicit preview pause is preserved after closing the film');
      await page.getByRole('button', {name:'Play preview', exact:true}).click(); await playing(video);
      assert.ok(await video.evaluate((element, prior) => element.currentTime >= prior || prior > element.duration - 1, position));
      await watch.click(); await playing(full);
      await page.getByRole('button', {name:'Close film', exact:true}).click();
      if (scenario === 'normal' || scenario === 'blocked' || scenario === 'no-frame-callback') await playing(video);
      await watch.click(); await playing(full);
      await page.mouse.click(2, 2);
      await dialog.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (scenario === 'normal') {
        await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
        await video.evaluate((element) => element.pause());
        await page.screenshot({path:`${output}/${name}-hero.png`});
        await watch.click(); await playing(full);
        await page.screenshot({path:`${output}/${name}-full-film.png`});
        await page.keyboard.press('Escape');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS: ${name}/${scenario}: above-fold hero, lazy full film, accessible modal, autoplay, loop, pause, focus, no overflow/errors`);
      await page.close();
    }
  }
  for (const [width, height] of [[320, 568], [375, 667], [768, 1024], [1024, 768], [1440, 900]]) {
    const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce'});
    await page.goto(base); await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const video = document.querySelector('#dream-film-player').getBoundingClientRect();
      const headline = document.querySelector('h1');
      const rect = headline.getBoundingClientRect();
      const cta = document.querySelector('.hero-actions .button').getBoundingClientRect();
      return {
        fits: video.top >= 0 && video.bottom < innerHeight && cta.bottom < innerHeight,
        headlineFits: [...headline.querySelectorAll('span')].every((line) => line.scrollWidth <= line.clientWidth) && rect.bottom < cta.top,
        overflow: document.documentElement.scrollWidth > innerWidth,
        animations: [...headline.querySelectorAll('span')].map((line) => getComputedStyle(line).animationName),
      };
    });
    assert.equal(geometry.fits, true, `Above-fold film and signup at ${width}x${height}`);
    assert.equal(geometry.headlineFits, true, 'No cropped or overlapping headline');
    assert.equal(geometry.overflow, false);
    assert.ok(geometry.animations.every((name) => name === 'none'), 'Reduced motion also disables headline animation');
    await page.screenshot({path: `${output}/responsive-${width}.png`});
    await page.close();
  }
  const noJS = await browser.newPage({javaScriptEnabled: false, viewport: {width: 390, height: 844}});
  const noJSRequests = [];
  noJS.on('request', (request) => { if (request.url().includes('.mp4')) noJSRequests.push(request.url()); });
  await noJS.goto(base);
  assert.ok(await noJS.getByRole('heading', {name: 'What if this was work?'}).isVisible());
  assert.ok(await noJS.locator('.hero-section').getByRole('link', {name: 'Find my what if', exact: true}).isVisible());
  assert.ok(await noJS.locator('#dream-film-player').getAttribute('poster'));
  assert.equal(noJSRequests.length, 0, 'Without JavaScript the poster and signup still work without video downloads');
  await noJS.close();
  console.log('PASS: five responsive sizes, no clipped type, reduced-motion typography, no-JavaScript fallback, full export dimensions/source');
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
