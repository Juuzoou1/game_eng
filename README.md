# ★ RETRO-PSX ENGINE ★

محرك ألعاب 3D بسيط بإحساس **بلايستيشن 1 / ويندوز XP** — يشتغل في المتصفح مباشرة بدون أي تنصيب.

A tiny browser-based 3D game engine that deliberately looks like a
late-90s console: chunky pixels, wobbly geometry, swimming textures and
foggy draw distance.

![retro](https://img.shields.io/badge/style-PSX-ff66aa) ![webgl](https://img.shields.io/badge/WebGL-1.0-blue)

---

## التشغيل / How to run

المتصفحات تمنع تحميل وحدات JavaScript عبر `file://`، فلازم سيرفر محلي بسيط.
Browsers block ES modules over `file://`, so serve the folder over HTTP:

```bash
# أي واحد من هذي / pick any one:
python3 -m http.server 8000
#  أو
npx serve .
```

ثم افتح المتصفح على / then open:

```
http://localhost:8000
```

**اضغط على الشاشة** عشان يقفل الماوس وتبدأ تلعب.
**Click the screen** to lock the mouse and start playing.

### التحكم / Controls

| المفتاح / Key | الوظيفة / Action |
|---|---|
| `W` `A` `S` `D` | المشي / move |
| الماوس / Mouse | النظر / look around |
| `Shift` | الركض / run |
| `Esc` | تحرير الماوس / release mouse |

---

## ليش يحس قديم؟ / Why it looks retro

كل هذي الحيل مطبّقة عمداً عشان الإحساس القديم:

The vintage feel comes from intentionally emulating PS1 hardware limits:

1. **دقة منخفضة (320×240)** — المشهد يُرسم في بفر صغير ويُكبّر بـ nearest filtering فتطلع البكسلات واضحة ومكعبة.
   *Low internal resolution upscaled with nearest filtering → chunky pixels.*
2. **اهتزاز الفيرتكس / Vertex snapping** — البلايستيشن ما كان عنده دقة تحت-البكسل، فالمجسمات ترجف. نحاكيها بتقريب إحداثيات الرؤوس لشبكة منخفضة في الـ vertex shader.
3. **تشويه التكسرات / Affine texture mapping** — تجاهل تصحيح المنظور للـ UV فتتلوّى الزخارف على المثلثات (العلامة المميزة لألعاب PS1).
4. **ضباب المسافة / Distance fog** — يخفي حدود الرسم القريبة.
5. **إضاءة بسيطة + ديذرنق / Gouraud lighting + Bayer dithering** — ألوان محدودة (15-bit) مع تنقيط منظّم.
6. **خطوط الـ CRT / Scanlines + vignette** — طبقة CSS فوق الكانفس.

---

## بنية المشروع / Project structure

```
index.html        صفحة الدخول + ستايل الـ CRT
src/
  math.js         vec3 و mat4 (بدون مكتبات)
  textures.js     زخارف تُرسم برمجياً (طوب، معدن، صناديق، عشب…)
  mesh.js         مكعب / مستوى / هرم
  renderer.js     قلب المحرك: شيدرات PS1 + بفر منخفض + ديذرنق
  camera.js       كاميرا منظور أول
  input.js        كيبورد + قفل الماوس
  scene.js        كيانات (entities) ومصفوفات التحويل
  main.js         تجميع كل شي + بناء المستوى التجريبي
```

---

## تضيف أشياء جديدة / Adding things

عشان تضيف مجسم جديد للمشهد:

```js
scene.add(new Entity({
  mesh: mesh.cube,
  texture: tex.brick,
  position: [2, 0.5, -3],
  rotation: [0, 0.4, 0],
  scale: [1, 1, 1],
  // اختياري: تحديث كل فريم
  update: (e, dt, time) => { e.rotation[1] += dt; },
}));
```

تبي زخرفة جديدة؟ زِد دالة في `src/textures.js` ترجع `<canvas>`، وحمّلها بـ `createTexture(gl, ...)`.

---

استمتع! 🎮  Built as a from-scratch learning engine — no frameworks, ~700 lines.
