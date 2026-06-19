const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  hpBar: document.querySelector("#hpBar"),
  manaBar: document.querySelector("#manaBar"),
  xpBar: document.querySelector("#xpBar"),
  hpText: document.querySelector("#hpText"),
  manaText: document.querySelector("#manaText"),
  xpText: document.querySelector("#xpText"),
  realmText: document.querySelector("#realmText"),
  stoneText: document.querySelector("#stoneText"),
  pillText: document.querySelector("#pillText"),
  killText: document.querySelector("#killText"),
  questText: document.querySelector("#questText"),
  questBar: document.querySelector("#questBar"),
  inventoryList: document.querySelector("#inventoryList"),
  centerMessage: document.querySelector("#centerMessage"),
};

const realms = [
  { name: "炼气一层", need: 100, hp: 140, mana: 90, power: 18 },
  { name: "炼气三层", need: 180, hp: 175, mana: 120, power: 26 },
  { name: "筑基初期", need: 300, hp: 230, mana: 165, power: 38 },
  { name: "筑基圆满", need: 480, hp: 310, mana: 225, power: 54 },
  { name: "金丹初成", need: 740, hp: 430, mana: 320, power: 78 },
  { name: "元婴显化", need: 1100, hp: 620, mana: 470, power: 118 },
];

const questSteps = [
  { text: "斩杀 5 只妖物，夺回青玄谷灵脉。", target: 5 },
  { text: "收集 3 件战利品，铸成第一套法器。", target: 3 },
  { text: "击败谷底 Boss 赤霄妖君。", target: 1 },
  { text: "继续修炼突破，向更高境界进发。", target: 999 },
];

const keys = new Set();
const mouse = { x: 640, y: 360, down: false };
const camera = { x: 0, y: 0, shake: 0 };
const world = { width: 2800, height: 1800 };

const player = {
  x: world.width / 2,
  y: world.height / 2,
  r: 21,
  realm: 0,
  hp: realms[0].hp,
  mana: realms[0].mana,
  xp: 0,
  stones: 80,
  pills: 3,
  kills: 0,
  loot: [],
  angle: 0,
  attackCd: 0,
  dashCd: 0,
  novaCd: 0,
  invuln: 0,
  swordFlash: 0,
};

const state = {
  time: 0,
  last: performance.now(),
  enemies: [],
  projectiles: [],
  particles: [],
  damageTexts: [],
  floatingLoot: [],
  quest: 0,
  bossSpawned: false,
  messageTimer: 4,
  message: "WASD 移动，鼠标瞄准，空格挥剑。进入青玄谷，夺回灵脉。",
};

const terrain = Array.from({ length: 80 }, (_, i) => ({
  x: (i * 541) % world.width,
  y: (i * 887) % world.height,
  r: 36 + ((i * 29) % 92),
  type: i % 5,
}));

function maxHp() {
  return realms[player.realm].hp + player.loot.length * 8;
}

function maxMana() {
  return realms[player.realm].mana + player.loot.length * 4;
}

function power() {
  return realms[player.realm].power + player.loot.length * 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function spawnEnemy(kind = "mob") {
  const edge = Math.floor(Math.random() * 4);
  const margin = 140;
  const hp = kind === "boss" ? 720 + player.realm * 140 : 70 + player.realm * 34;
  state.enemies.push({
    x: edge === 0 ? margin : edge === 1 ? world.width - margin : Math.random() * world.width,
    y: edge === 2 ? margin : edge === 3 ? world.height - margin : Math.random() * world.height,
    r: kind === "boss" ? 48 : 24,
    kind,
    name: kind === "boss" ? "赤霄妖君" : ["玄甲妖卒", "噬灵藤", "阴火狐", "铁羽鸦"][Math.floor(Math.random() * 4)],
    hp,
    maxHp: hp,
    speed: kind === "boss" ? 70 : 110 + Math.random() * 28,
    damage: kind === "boss" ? 26 + player.realm * 6 : 12 + player.realm * 3,
    hitCd: 0,
    castCd: kind === "boss" ? 1.8 : 0,
    phase: Math.random() * Math.PI * 2,
  });
}

function spawnWave() {
  while (state.enemies.filter((e) => e.kind !== "boss").length < 10 + player.realm * 2) {
    spawnEnemy("mob");
  }
}

function spawnBoss() {
  if (state.bossSpawned) return;
  state.bossSpawned = true;
  const hp = 820 + player.realm * 160;
  state.enemies.push({
    x: clamp(player.x + 420, 120, world.width - 120),
    y: clamp(player.y - 220, 120, world.height - 120),
    r: 54,
    kind: "boss",
    name: "赤霄妖君",
    hp,
    maxHp: hp,
    speed: 76,
    damage: 30 + player.realm * 7,
    hitCd: 0,
    castCd: 1,
    phase: 0,
  });
  showMessage("赤霄妖君降临，谷底灵脉正在崩裂。");
  camera.shake = 18;
}

function addParticles(x, y, color, count, speed = 180) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.45,
      maxLife: 0.8,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

function damageText(x, y, text, color = "#ffe2a0") {
  state.damageTexts.push({ x, y, text, color, life: 0.9 });
}

function showMessage(text, seconds = 3) {
  state.message = text;
  state.messageTimer = seconds;
  ui.centerMessage.querySelector("span").textContent = text;
  ui.centerMessage.classList.add("show");
}

function attack() {
  if (player.attackCd > 0) return;
  player.attackCd = 0.24;
  player.swordFlash = 0.16;
  const range = 106;
  const arc = Math.PI * 0.72;
  let hit = false;

  for (const enemy of state.enemies) {
    const d = dist(player, enemy);
    const da = Math.abs(normalizeAngle(angleTo(player, enemy) - player.angle));
    if (d < range + enemy.r && da < arc) {
      const dmg = Math.floor(power() + 14 + Math.random() * 18);
      enemy.hp -= dmg;
      enemy.hitCd = 0.12;
      hit = true;
      damageText(enemy.x, enemy.y - enemy.r, dmg);
      addParticles(enemy.x, enemy.y, "#e2af4c", 14);
    }
  }

  if (hit) camera.shake = Math.max(camera.shake, 5);
}

function castNova() {
  if (player.novaCd > 0 || player.mana < 36) return;
  player.novaCd = 4.8;
  player.mana -= 36;
  camera.shake = 12;
  addParticles(player.x, player.y, "#72b8ff", 70, 340);
  for (const enemy of state.enemies) {
    const d = dist(player, enemy);
    if (d < 230 + enemy.r) {
      const dmg = Math.floor(power() * 1.6 + 30 + Math.random() * 32);
      enemy.hp -= dmg;
      enemy.hitCd = 0.2;
      damageText(enemy.x, enemy.y - enemy.r, dmg, "#72b8ff");
    }
  }
}

function dash() {
  if (player.dashCd > 0 || player.mana < 18) return;
  player.dashCd = 1.4;
  player.mana -= 18;
  player.invuln = 0.28;
  player.x = clamp(player.x + Math.cos(player.angle) * 180, 40, world.width - 40);
  player.y = clamp(player.y + Math.sin(player.angle) * 180, 40, world.height - 40);
  addParticles(player.x, player.y, "#62d6a4", 34, 220);
}

function heal() {
  if (player.pills <= 0 || player.hp >= maxHp()) return;
  player.pills -= 1;
  player.hp = clamp(player.hp + Math.floor(maxHp() * 0.38), 0, maxHp());
  player.mana = clamp(player.mana + Math.floor(maxMana() * 0.2), 0, maxMana());
  addParticles(player.x, player.y, "#62d6a4", 40, 160);
  showMessage("丹药化开，气血回升。", 1.4);
}

function breakthrough() {
  const realm = realms[player.realm];
  if (player.realm >= realms.length - 1) {
    showMessage("此界灵机已至尽头，等待飞升版本。");
    return;
  }
  if (player.xp < realm.need) {
    showMessage(`修为不足，还需 ${realm.need - player.xp} 点感悟。`, 1.6);
    return;
  }
  const cost = 60 + player.realm * 45;
  if (player.stones < cost) {
    showMessage(`突破需 ${cost} 灵石稳固阵法。`, 1.6);
    return;
  }
  player.stones -= cost;
  player.xp = 0;
  player.realm += 1;
  player.hp = maxHp();
  player.mana = maxMana();
  camera.shake = 24;
  addParticles(player.x, player.y, "#e2af4c", 120, 420);
  showMessage(`灵潮倒卷，突破至 ${realms[player.realm].name}。`, 2.6);
}

function update(dt) {
  state.time += dt;
  player.attackCd -= dt;
  player.dashCd -= dt;
  player.novaCd -= dt;
  player.invuln -= dt;
  player.swordFlash -= dt;
  player.mana = clamp(player.mana + dt * (7 + player.realm), 0, maxMana());

  const screenMouse = { x: mouse.x + camera.x, y: mouse.y + camera.y };
  player.angle = angleTo(player, screenMouse);

  let mx = 0;
  let my = 0;
  if (keys.has("w")) my -= 1;
  if (keys.has("s")) my += 1;
  if (keys.has("a")) mx -= 1;
  if (keys.has("d")) mx += 1;
  const mag = Math.hypot(mx, my) || 1;
  const speed = 235 + player.realm * 12;
  player.x = clamp(player.x + (mx / mag) * speed * dt, 40, world.width - 40);
  player.y = clamp(player.y + (my / mag) * speed * dt, 40, world.height - 40);

  if (mouse.down || keys.has(" ")) attack();
  if (keys.has("q")) castNova();

  updateEnemies(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  updateLoot(dt);
  handleQuest();
  updateCamera(dt);
  updateUi();
}

function updateEnemies(dt) {
  spawnWave();

  for (const enemy of state.enemies) {
    enemy.hitCd -= dt;
    enemy.castCd -= dt;
    enemy.phase += dt * 3;

    const a = angleTo(enemy, player);
    const wobble = Math.sin(enemy.phase) * 0.6;
    enemy.x += Math.cos(a + wobble * 0.18) * enemy.speed * dt;
    enemy.y += Math.sin(a + wobble * 0.18) * enemy.speed * dt;

    if (enemy.kind === "boss" && enemy.castCd <= 0) {
      enemy.castCd = 2.1;
      for (let i = -2; i <= 2; i += 1) {
        const pa = a + i * 0.22;
        state.projectiles.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(pa) * 320,
          vy: Math.sin(pa) * 320,
          r: 9,
          damage: enemy.damage,
          life: 2.4,
          color: "#dc685f",
        });
      }
    }

    if (dist(enemy, player) < enemy.r + player.r && player.invuln <= 0) {
      player.hp -= enemy.damage * dt * 2.3;
      camera.shake = Math.max(camera.shake, 8);
      if (player.hp <= 0) respawn();
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (enemy.hp <= 0) {
      killEnemy(enemy);
      state.enemies.splice(i, 1);
    }
  }
}

function updateProjectiles(dt) {
  for (const p of state.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (dist(p, player) < p.r + player.r && player.invuln <= 0) {
      player.hp -= p.damage;
      p.life = 0;
      camera.shake = 10;
      damageText(player.x, player.y - 35, `-${Math.floor(p.damage)}`, "#dc685f");
      addParticles(player.x, player.y, "#dc685f", 18, 180);
      if (player.hp <= 0) respawn();
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.life > 0);
}

function killEnemy(enemy) {
  const xp = enemy.kind === "boss" ? 240 + player.realm * 70 : 28 + player.realm * 9;
  const stones = enemy.kind === "boss" ? 180 + player.realm * 60 : 8 + Math.floor(Math.random() * 18);
  player.xp += xp;
  player.stones += stones;
  player.kills += 1;
  addParticles(enemy.x, enemy.y, enemy.kind === "boss" ? "#e2af4c" : "#62d6a4", enemy.kind === "boss" ? 120 : 32, 300);
  damageText(enemy.x, enemy.y, `+${xp} 修为`, "#62d6a4");

  if (Math.random() < (enemy.kind === "boss" ? 1 : 0.22)) {
    const loot = enemy.kind === "boss" ? "赤霄妖丹" : ["青铜剑胚", "灵藤甲片", "玄火符", "妖骨坠"][Math.floor(Math.random() * 4)];
    state.floatingLoot.push({ x: enemy.x, y: enemy.y, name: loot, life: 12 });
  }

  if (enemy.kind === "boss") {
    state.quest = Math.max(state.quest, 3);
    showMessage("赤霄妖君伏诛，青玄谷灵脉重归宗门。", 3.5);
  }
}

function updateLoot(dt) {
  for (const item of state.floatingLoot) {
    item.life -= dt;
    if (dist(item, player) < 52) {
      player.loot.unshift(item.name);
      player.loot = player.loot.slice(0, 8);
      item.life = 0;
      damageText(player.x, player.y - 48, `获得 ${item.name}`, "#ffe2a0");
    }
  }
  state.floatingLoot = state.floatingLoot.filter((item) => item.life > 0);
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  for (const t of state.damageTexts) {
    t.y -= 44 * dt;
    t.life -= dt;
  }
  state.damageTexts = state.damageTexts.filter((t) => t.life > 0);

  state.messageTimer -= dt;
  if (state.messageTimer <= 0) ui.centerMessage.classList.remove("show");
}

function handleQuest() {
  if (state.quest === 0 && player.kills >= questSteps[0].target) {
    state.quest = 1;
    showMessage("第一道宗门令完成，开始收束战利品。");
  }
  if (state.quest === 1 && player.loot.length >= questSteps[1].target) {
    state.quest = 2;
    showMessage("法器已成，赤霄妖君被灵脉震动惊醒。");
    spawnBoss();
  }
}

function respawn() {
  player.hp = Math.floor(maxHp() * 0.65);
  player.mana = Math.floor(maxMana() * 0.5);
  player.x = world.width / 2;
  player.y = world.height / 2;
  player.stones = Math.max(0, player.stones - 45);
  player.invuln = 2.2;
  camera.shake = 26;
  showMessage("道躯破碎，元神被宗门护阵拉回。损失部分灵石。", 3.2);
}

function updateCamera(dt) {
  const viewW = canvas.width;
  const viewH = canvas.height;
  camera.x += (player.x - viewW / 2 - camera.x) * clamp(dt * 8, 0, 1);
  camera.y += (player.y - viewH / 2 - camera.y) * clamp(dt * 8, 0, 1);
  camera.x = clamp(camera.x, 0, world.width - viewW);
  camera.y = clamp(camera.y, 0, world.height - viewH);
  camera.shake = Math.max(0, camera.shake - dt * 36);
}

function updateUi() {
  const realm = realms[player.realm];
  ui.hpBar.style.width = `${(player.hp / maxHp()) * 100}%`;
  ui.manaBar.style.width = `${(player.mana / maxMana()) * 100}%`;
  ui.xpBar.style.width = `${clamp((player.xp / realm.need) * 100, 0, 100)}%`;
  ui.hpText.textContent = `${Math.ceil(player.hp)} / ${maxHp()}`;
  ui.manaText.textContent = `${Math.floor(player.mana)} / ${maxMana()}`;
  ui.xpText.textContent = `${Math.floor(player.xp)} / ${realm.need}`;
  ui.realmText.textContent = realm.name;
  ui.stoneText.textContent = `灵石 ${player.stones}`;
  ui.pillText.textContent = `丹药 ${player.pills}`;
  ui.killText.textContent = `斩妖 ${player.kills}`;
  ui.questText.textContent = questSteps[state.quest].text;
  const progress = state.quest === 0 ? player.kills / 5 : state.quest === 1 ? player.loot.length / 3 : state.quest === 2 ? 0.2 : 1;
  ui.questBar.style.width = `${clamp(progress * 100, 0, 100)}%`;
  ui.inventoryList.innerHTML = player.loot.length === 0
    ? `<div class="inventory-item"><span>暂无战利品</span><b>--</b></div>`
    : player.loot.slice(0, 5).map((item, i) => `<div class="inventory-item"><span>${item}</span><b>+${(i + 1) * 2}</b></div>`).join("");
}

function render() {
  const sx = (Math.random() - 0.5) * camera.shake;
  const sy = (Math.random() - 0.5) * camera.shake;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x + sx, -camera.y + sy);
  drawWorld();
  drawLoot();
  drawEnemies();
  drawProjectiles();
  drawPlayer();
  drawParticles();
  ctx.restore();
  drawVignette();
  drawMinimap();
}

function drawWorld() {
  const grad = ctx.createLinearGradient(0, 0, world.width, world.height);
  grad.addColorStop(0, "#10281d");
  grad.addColorStop(0.45, "#1b291b");
  grad.addColorStop(1, "#251716");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.strokeStyle = "rgba(226, 175, 76, 0.08)";
  ctx.lineWidth = 2;
  for (let x = 0; x < world.width; x += 180) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 420, world.height);
    ctx.stroke();
  }

  for (const t of terrain) {
    const colors = ["#213b2a", "#294032", "#1d302d", "#3a3321", "#172e35"];
    ctx.fillStyle = colors[t.type];
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    if (t.type === 3) {
      ctx.strokeStyle = "rgba(226, 175, 76, 0.22)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  ctx.fillStyle = "rgba(114, 184, 255, 0.14)";
  ctx.beginPath();
  ctx.ellipse(world.width * 0.62, world.height * 0.55, 360, 170, -0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const aura = player.invuln > 0 ? 58 : 42 + player.realm * 4;
  ctx.save();
  ctx.shadowColor = "#62d6a4";
  ctx.shadowBlur = 22;
  ctx.strokeStyle = "rgba(98, 214, 164, 0.58)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, aura, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = "#efe5c6";
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-15, -17);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-15, 17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#e2af4c";
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = player.swordFlash > 0 ? "#fff3bf" : "#bcd7c4";
  ctx.lineWidth = player.swordFlash > 0 ? 8 : 4;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(82, 0);
  ctx.stroke();
  ctx.restore();
}

function drawEnemies() {
  for (const e of state.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = e.kind === "boss" ? "#dc685f" : "#983c45";
    ctx.shadowBlur = e.kind === "boss" ? 28 : 14;
    ctx.fillStyle = e.hitCd > 0 ? "#fff3bf" : e.kind === "boss" ? "#6c1f22" : "#3b171a";
    ctx.beginPath();
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      const r = e.r * (0.82 + (i % 2) * 0.26);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd06b";
    ctx.beginPath();
    ctx.arc(e.r * 0.22, -e.r * 0.12, 4 + e.r * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawEnemyBar(e);
  }
}

function drawEnemyBar(e) {
  const w = e.kind === "boss" ? 120 : 58;
  const x = e.x - w / 2;
  const y = e.y - e.r - 24;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, w, 7);
  ctx.fillStyle = e.kind === "boss" ? "#e2af4c" : "#dc685f";
  ctx.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 7);
  if (e.kind === "boss") {
    ctx.fillStyle = "#f5f0df";
    ctx.font = "14px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(e.name, e.x, y - 8);
  }
}

function drawProjectiles() {
  for (const p of state.projectiles) {
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawLoot() {
  ctx.font = "14px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  for (const item of state.floatingLoot) {
    ctx.save();
    ctx.shadowColor = "#e2af4c";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ffe2a0";
    ctx.beginPath();
    ctx.arc(item.x, item.y, 11 + Math.sin(state.time * 5) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5f0df";
    ctx.fillText(item.name, item.x, item.y - 22);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.font = "700 18px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  for (const t of state.damageTexts) {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawVignette() {
  const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.25, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawMinimap() {
  const size = 142;
  const x = canvas.width - size - 24;
  const y = 128;
  ctx.save();
  ctx.fillStyle = "rgba(9,12,11,0.58)";
  ctx.strokeStyle = "rgba(255,226,158,0.22)";
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, size, size);
  ctx.strokeRect(x, y, size, size);
  const px = x + (player.x / world.width) * size;
  const py = y + (player.y / world.height) * size;
  ctx.fillStyle = "#62d6a4";
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#dc685f";
  for (const e of state.enemies) {
    ctx.fillRect(x + (e.x / world.width) * size - 2, y + (e.y / world.height) * size - 2, 4, 4);
  }
  ctx.restore();
}

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.last) / 1000);
  state.last = now;
  resizeCanvas();
  update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (key === "shift") dash();
  if (key === "e") heal();
  if (key === "r") breakthrough();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
});

canvas.addEventListener("mousedown", () => {
  mouse.down = true;
});

window.addEventListener("mouseup", () => {
  mouse.down = false;
});

document.querySelector(".skill-row").addEventListener("click", (event) => {
  const skill = event.target.closest("button")?.dataset.skill;
  if (skill === "slash") attack();
  if (skill === "dash") dash();
  if (skill === "nova") castNova();
  if (skill === "heal") heal();
  if (skill === "breakthrough") breakthrough();
});

window.addEventListener("contextmenu", (event) => event.preventDefault());

showMessage(state.message, 4);
for (let i = 0; i < 8; i += 1) spawnEnemy();
resizeCanvas();
updateUi();
requestAnimationFrame(loop);
