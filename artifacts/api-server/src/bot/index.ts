import mineflayer, { type Bot } from "mineflayer";
import pathfinderPkg from "mineflayer-pathfinder";
import { logger } from "../lib/logger";

const { pathfinder, Movements } = pathfinderPkg;

const HOST = " Rabbite6555-ACGQ.aternos.me";
const PORT = 60064;
const USERNAME = "Rat-pro";
const RECONNECT_DELAY_MS = 8000;

const ALL_MESSAGES = [
  // online / here
  "I am here",
  "online :)",
  "yo!",
  "hey",
  "sup",
  "I'm back",
  "still here",
  "present!",
  "hi all",
  "heyy",
  "hello!",
  "it's me",
  // happy
  "lets go!!",
  "feeling good",
  "good vibes",
  "love it here",
  "so happy rn",
  "yesss!!",
  ":D",
  "great day!",
  "woooo!!",
  // sad
  "miss u all",
  "lonely rn :(",
  "anyone there?",
  "so quiet...",
  ":(",
  "feeling empty",
  "sad hours",
  // funny
  "lol hi",
  "oops",
  "wait what",
  "just vibing",
  "no thoughts",
  "lmaooo",
  "skill issue",
  "i fell again",
  "classic me",
  "uhh hi",
  "ok bye",
  "jk still here",
  // random
  ".",
  "hmm",
  "???",
  "bruh",
  "gg",
  "rip",
  "fr fr",
  "no way",
  "real",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let messageQueue: string[] = [];

function nextMessage(): string {
  if (messageQueue.length === 0) {
    messageQueue = shuffle(ALL_MESSAGES);
  }
  return messageQueue.pop()!;
}

export type BotStatus = "connecting" | "active" | "disconnected" | "error";

type ActionName =
  | "sprint_forward"
  | "run_forward"
  | "walk_backward"
  | "jump_in_place"
  | "jump_and_run"
  | "hit"
  | "greeting"
  | "look_around";

interface ActionResult {
  name: ActionName;
  durationMs: number;
}

let activeBot: Bot | null = null;
let currentStatus: BotStatus = "disconnected";
let currentAction: ActionName | null = null;
let lastError: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getBotInfo() {
  return {
    status: currentStatus,
    action: currentAction,
    error: lastError,
    position: activeBot?.entity?.position
      ? {
          x: Math.floor(activeBot.entity.position.x),
          y: Math.floor(activeBot.entity.position.y),
          z: Math.floor(activeBot.entity.position.z),
        }
      : null,
    health: activeBot?.health ?? null,
    food: activeBot?.food ?? null,
    username: activeBot?.username ?? USERNAME,
    server: `${HOST}:${PORT}`,
  };
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function clearAllControls(bot: Bot) {
  bot.setControlState("forward", false);
  bot.setControlState("back", false);
  bot.setControlState("left", false);
  bot.setControlState("right", false);
  bot.setControlState("sprint", false);
  bot.setControlState("jump", false);
}

async function doSprintForward(bot: Bot): Promise<ActionResult> {
  const duration = rand(2000, 5000);
  bot.entity.yaw = Math.random() * Math.PI * 2;
  bot.setControlState("forward", true);
  bot.setControlState("sprint", true);
  logger.info({ durationMs: duration }, "Rat-pro: sprinting forward");
  return { name: "sprint_forward", durationMs: duration };
}

async function doRunForward(bot: Bot): Promise<ActionResult> {
  const duration = rand(1500, 4000);
  bot.entity.yaw = Math.random() * Math.PI * 2;
  bot.setControlState("forward", true);
  bot.setControlState("sprint", false);
  logger.info({ durationMs: duration }, "Rat-pro: running forward");
  return { name: "run_forward", durationMs: duration };
}

async function doWalkBackward(bot: Bot): Promise<ActionResult> {
  const duration = rand(1000, 3000);
  bot.setControlState("back", true);
  logger.info({ durationMs: duration }, "Rat-pro: walking backward");
  return { name: "walk_backward", durationMs: duration };
}

async function doJumpInPlace(bot: Bot): Promise<ActionResult> {
  const jumps = rand(2, 6);
  logger.info({ jumps }, "Rat-pro: jumping in place");
  for (let i = 0; i < jumps; i++) {
    if (!activeBot) break;
    bot.setControlState("jump", true);
    await sleep(300);
    bot.setControlState("jump", false);
    await sleep(400);
  }
  return { name: "jump_in_place", durationMs: jumps * 700 };
}

async function doJumpAndRun(bot: Bot): Promise<ActionResult> {
  const duration = rand(2000, 4000);
  bot.entity.yaw = Math.random() * Math.PI * 2;
  bot.setControlState("forward", true);
  bot.setControlState("sprint", true);
  bot.setControlState("jump", true);
  logger.info({ durationMs: duration }, "Rat-pro: jump running");
  return { name: "jump_and_run", durationMs: duration };
}

async function doHit(bot: Bot): Promise<ActionResult> {
  const swings = rand(3, 8);
  logger.info({ swings }, "Rat-pro: hitting");

  const nearbyEntities = Object.values(bot.entities).filter(
    (e) =>
      e !== bot.entity &&
      e.position.distanceTo(bot.entity.position) < 3.5 &&
      e.type !== "object" &&
      e.name !== "item"
  );

  for (let i = 0; i < swings; i++) {
    if (!activeBot) break;
    try {
      if (nearbyEntities.length > 0) {
        const target = nearbyEntities[Math.floor(Math.random() * nearbyEntities.length)];
        bot.attack(target);
        logger.info({ entity: target.name ?? target.type }, "Rat-pro: attacked entity");
      } else {
        bot.swingArm();
      }
    } catch {
      try { bot.swingArm(); } catch { }
    }
    await sleep(rand(400, 700));
  }

  return { name: "hit", durationMs: swings * 550 };
}

async function doGreeting(bot: Bot): Promise<ActionResult> {
  const msg = nextMessage();
  logger.info({ msg }, "Rat-pro: sending message");
  try {
    bot.chat(msg);
  } catch {
    logger.warn("Rat-pro: couldn't send chat");
  }
  return { name: "greeting", durationMs: 800 };
}

async function doLookAround(bot: Bot): Promise<ActionResult> {
  const steps = rand(3, 7);
  logger.info({ steps }, "Rat-pro: looking around");
  for (let i = 0; i < steps; i++) {
    if (!activeBot) break;
    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 1.2;
    await bot.look(yaw, pitch, true);
    await sleep(rand(300, 700));
  }
  return { name: "look_around", durationMs: steps * 500 };
}

const WEIGHTED_ACTIONS: Array<{
  weight: number;
  fn: (bot: Bot) => Promise<ActionResult>;
}> = [
  { weight: 20, fn: doSprintForward },
  { weight: 15, fn: doRunForward },
  { weight: 12, fn: doWalkBackward },
  { weight: 12, fn: doJumpInPlace },
  { weight: 12, fn: doJumpAndRun },
  { weight: 13, fn: doHit },
  { weight: 10, fn: doGreeting },
  { weight: 6,  fn: doLookAround },
];

const totalWeight = WEIGHTED_ACTIONS.reduce((s, a) => s + a.weight, 0);

function pickAction() {
  let r = Math.random() * totalWeight;
  for (const action of WEIGHTED_ACTIONS) {
    r -= action.weight;
    if (r <= 0) return action.fn;
  }
  return WEIGHTED_ACTIONS[0].fn;
}

async function runActionLoop(bot: Bot) {
  while (activeBot === bot && currentStatus === "active") {
    clearAllControls(bot);
    await sleep(rand(200, 600));
    if (!activeBot || currentStatus !== "active") break;

    const actionFn = pickAction();
    let result: ActionResult;
    try {
      result = await actionFn(bot);
    } catch (e) {
      logger.warn({ e }, "Rat-pro: action threw, continuing");
      currentAction = null;
      await sleep(1000);
      continue;
    }

    currentAction = result.name;
    await sleep(result.durationMs);
    clearAllControls(bot);
    currentAction = null;
    await sleep(rand(300, 1200));
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  logger.info({ delayMs: RECONNECT_DELAY_MS }, "Scheduling reconnect");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, RECONNECT_DELAY_MS);
}

export function createBot() {
  if (activeBot) {
    try { activeBot.quit(); } catch { }
    activeBot = null;
  }

  currentStatus = "connecting";
  currentAction = null;
  lastError = null;
  logger.info({ host: HOST, port: PORT, username: USERNAME }, "Bot connecting");

  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    auth: "offline",
    version: false as unknown as string,
    hideErrors: false,
  });

  bot.loadPlugin(pathfinder);
  activeBot = bot;

  bot.once("spawn", () => {
    currentStatus = "active";
    logger.info("Rat-pro spawned — starting non-stop action loop");

    try {
      const defaultMove = new Movements(bot);
      defaultMove.canDig = false;
      bot.pathfinder.setMovements(defaultMove);
    } catch { }

    runActionLoop(bot).catch((e) =>
      logger.error({ e }, "Action loop crashed")
    );
  });

  bot.on("health", () => {
    if (bot.health !== undefined && bot.health <= 0) {
      logger.warn("Rat-pro died, respawning");
      clearAllControls(bot);
      setTimeout(() => {
        try { bot.respawn(); } catch { }
      }, 2000);
    }
  });

  bot.on("kicked", (reason) => {
    currentStatus = "disconnected";
    lastError = reason;
    activeBot = null;
    logger.warn({ reason }, "Rat-pro was kicked");
    scheduleReconnect();
  });

  bot.on("error", (err) => {
    currentStatus = "error";
    lastError = err.message;
    activeBot = null;
    logger.error({ err }, "Rat-pro error");
    scheduleReconnect();
  });

  bot.on("end", (reason) => {
    if (currentStatus !== "error" && currentStatus !== "disconnected") {
      currentStatus = "disconnected";
      lastError = reason ?? null;
      activeBot = null;
      logger.warn({ reason }, "Rat-pro disconnected");
      scheduleReconnect();
    }
  });
}
