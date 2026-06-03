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

### اللعب / Gameplay

تمشّى في الساحة و**اجمع كل المجوهرات العشر** 💎. ما تقدر تعدّي الصناديق ولا الأعمدة (في تصادمات)، وكل شي له صوت ريترو 8-bit. أول ما تجمعهم كلهم تطلع لك نغمة فوز.

*Walk around and collect all 10 gems. Crates and pillars are solid (collision), everything has 8-bit sound, and a fanfare plays when you grab them all.*

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
index.html              صفحة الدخول + ستايل الـ CRT
src/
  main.js               مُشغّل: يختار لعبة ويشغّلها
  engine/               ★ نواة المحرك (قابلة لإعادة الاستخدام) ★
    engine.js           الواجهة البرمجية: Engine — تربط كل شي
    renderer.js         الراسم: شيدرات PS1 + بفر منخفض + ديذرنق
    math.js             vec3 و mat4 (بدون مكتبات)
    mesh.js             بنّاءات المجسمات: مكعب / مستوى / هرم
    textures.js         زخارف تُرسم برمجياً
    camera.js           كاميرا منظور أول
    input.js            كيبورد + قفل الماوس
    physics.js          تصادمات AABB
    audio.js            أصوات 8-bit (Web Audio)
    scene.js            الكيانات (entities) والتحويلات
  games/                ألعاب مبنية فوق المحرك
    gem-collector.js    لعبة المثال (لا تستخدم إلا واجهة المحرك)
```

**الفكرة:** كل شي تحت `engine/` هو المحرك العام. الألعاب تحت `games/` تُبنى فوقه بدون ما تلمس داخليّاته.

---

## تصمّم لعبتك / Make your own game

اللعبة كاملة تتكتب بواجهة `Engine` فقط. مثال أدنى لعبة ممكنة:

```js
import { Engine, TexGen } from './engine/engine.js';

const game = new Engine(document.getElementById('game'), { width: 320, height: 240 });

// 1) سجّل الأصول (زخارف، مجسمات)
game.defineTexture('floor', TexGen.checker());
game.defineTexture('wall', TexGen.brick());

// 2) فعّل كاميرا المشي الجاهزة (مع تصادمات تلقائية)
game.useFirstPersonController({ bounds: 20 });

// 3) ابنِ المستوى
game.onStart = (g) => {
  g.spawn({ mesh: 'plane', texture: 'floor', scale: [40, 1, 40] });
  g.spawn({ mesh: 'cube', texture: 'wall', position: [0, 0.5, -5], solid: true });
};

// 4) منطق كل فريم
game.onUpdate = (g, dt) => {
  // مثال: شِف قرب اللاعب من نقطة
  // if (g.distanceToCamera([0,0,-5]) < 2) { ... }
};

game.run();
```

### أهم دوال الـ Engine API

| الدالة | الوظيفة |
|---|---|
| `defineTexture(name, canvas\|color)` | تسجّل زخرفة (من `<canvas>` أو لون CSS) |
| `defineMesh(name, {vertices,indices})` | تسجّل مجسم مخصّص |
| `spawn({mesh, texture, position, rotation, scale, tint, update, solid})` | تنشئ كياناً؛ `solid:true` يضيف تصادم |
| `despawn(entity)` | تحذف كياناً (وتصادمه) |
| `useFirstPersonController(cfg)` | كاميرا مشي WASD + ماوس مع تصادمات |
| `collide(x, z, r)` | تحلّ تصادم دائرة ضد كل العوائق |
| `distanceToCamera(pos)` | مسافة (XZ) من اللاعب لنقطة |
| `g.input` / `g.audio` / `g.camera` / `g.scene` | وصول مباشر للأنظمة |
| `run()` | يبدأ حلقة اللعبة |

المجسمات الجاهزة: `'cube'` · `'plane'` · `'pyramid'`.
الزخارف الجاهزة في `TexGen`: `checker` · `brick` · `metal` · `crate` · `grass` · `gem`.

عشان تشغّل لعبتك، عدّل `src/main.js` ليستورد لعبتك بدل `gem-collector`.

---

استمتع! 🎮  Built from scratch — no frameworks, no engine libraries.
