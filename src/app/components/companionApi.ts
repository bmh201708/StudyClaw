import { apiUrl, authHeaders } from "../lib/sessionApi";

export type CompanionScene = "camera-on" | "camera-off";
export type CompanionState = "normal" | "happy" | "mid" | "tired" | "sleep";

export type CompanionSignalMetrics = {
  tabVisible?: boolean;
  faceDetected?: boolean;
  faceCount?: number;
  faceCentered?: number;
  eyeOpenScore?: number;
  headPoseScore?: number;
  headStability?: number;
  motionScore?: number;
  interactionScore?: number;
  painScore?: number;
  anxietyScore?: number;
  distressScore?: number;
};

export type CompanionEvaluatePayload = {
  cameraEnabled: boolean;
  focusDurationSec: number;
  unfocusDurationSec: number;
  isTimerRunning?: boolean;
  clickRecoveryRequested?: boolean;
  manualPauseActive?: boolean;
  distressLocked?: boolean;
  tiredThresholdSec?: number;
  metrics?: CompanionSignalMetrics;
};

export type CompanionEvaluateResponse = {
  scene: CompanionScene;
  state: CompanionState;
  focusScore: number;
  focusDurationSec: number;
  unfocusDurationSec: number;
  clickAction:
    | "none"
    | "recover-to-happy"
    | "recover-to-normal"
    | "repair-to-normal"
    | "reset-to-normal";
  asset: {
    idleDir: string;
    clickDir?: string;
  };
  debug: {
    attentionScore: number;
    painScore: number;
    anxietyScore: number;
    distressScore: number;
    distressLocked: boolean;
    signalsUsed: string[];
    reasons: string[];
  };
};

const UNFOCUS_THRESHOLD_SEC = 3;
const HAPPY_WINDOW_START_SEC = 3 * 60;
const MID_WINDOW_START_SEC = 5 * 60;
const DEFAULT_TIRED_THRESHOLD_SEC = 25 * 60;
const MAX_TIRED_THRESHOLD_SEC = 25 * 60;
const DISTRESS_FORCE_TIRED_THRESHOLD = 0.74;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function scoreMotionBalance(motionScore: number): number {
  const motion = clamp01(motionScore);
  if (motion < 0.02) return 0.35;
  if (motion < 0.08) return 0.72;
  if (motion <= 0.35) return 1;
  if (motion <= 0.6) return 0.72;
  if (motion <= 0.82) return 0.42;
  return 0.18;
}

function normalizeTiredThreshold(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIRED_THRESHOLD_SEC;
  return Math.min(MAX_TIRED_THRESHOLD_SEC, Math.max(60, Math.floor(value as number)));
}

function resolveStageWindows(tiredThresholdSec: number) {
  if (tiredThresholdSec <= HAPPY_WINDOW_START_SEC) {
    return { happyStartSec: tiredThresholdSec, midStartSec: tiredThresholdSec };
  }
  if (tiredThresholdSec <= MID_WINDOW_START_SEC) {
    return { happyStartSec: HAPPY_WINDOW_START_SEC, midStartSec: tiredThresholdSec };
  }
  return { happyStartSec: HAPPY_WINDOW_START_SEC, midStartSec: MID_WINDOW_START_SEC };
}

function computeMidStageScore(focusDurationSec: number, midStartSec: number, tiredThresholdSec: number): number {
  if (focusDurationSec <= midStartSec) return 0.8;
  if (focusDurationSec >= tiredThresholdSec) return 0;
  const decayProgress = (focusDurationSec - midStartSec) / Math.max(tiredThresholdSec - midStartSec, 1);
  return round3(clamp01(0.8 * (1 - decayProgress)));
}

function deriveAttentionScore(metrics?: CompanionSignalMetrics): {
  score: number;
  signalsUsed: string[];
  reasons: string[];
} {
  if (!metrics) {
    return {
      score: 0.7,
      signalsUsed: [],
      reasons: ["no metrics provided; using neutral default"],
    };
  }

  const weighted: Array<[string, number, number]> = [];
  const reasons: string[] = [];

  if (metrics.tabVisible === false) {
    return {
      score: 0.02,
      signalsUsed: ["tabVisible"],
      reasons: ["tab hidden -> attention forced low"],
    };
  }

  if (metrics.faceDetected === false) {
    return {
      score: round3(0.08 + 0.08 * clamp01(metrics.interactionScore ?? 0)),
      signalsUsed: ["faceDetected", "interactionScore"],
      reasons: [
        "face missing -> attention forced low",
        `interaction=${round3(clamp01(metrics.interactionScore ?? 0))}`,
      ],
    };
  }

  if (typeof metrics.tabVisible === "boolean") {
    weighted.push(["tabVisible", metrics.tabVisible ? 1 : 0, 0.08]);
    reasons.push(metrics.tabVisible ? "tab visible" : "tab hidden");
  }
  if (typeof metrics.faceCentered === "number") {
    const centered = clamp01(metrics.faceCentered);
    weighted.push(["faceCentered", centered, 0.24]);
    reasons.push(`faceCentered=${round3(centered)}`);
  }
  if (typeof metrics.eyeOpenScore === "number") {
    const eyeOpen = clamp01(metrics.eyeOpenScore);
    weighted.push(["eyeOpenScore", eyeOpen, 0.22]);
    reasons.push(`eyeOpen=${round3(eyeOpen)}`);
  }
  if (typeof metrics.headPoseScore === "number") {
    const headPose = clamp01(metrics.headPoseScore);
    weighted.push(["headPoseScore", headPose, 0.2]);
    reasons.push(`headPose=${round3(headPose)}`);
  }
  if (typeof metrics.headStability === "number") {
    const headStability = clamp01(metrics.headStability);
    weighted.push(["headStability", headStability, 0.14]);
    reasons.push(`headStability=${round3(headStability)}`);
  }
  if (typeof metrics.interactionScore === "number") {
    const interaction = clamp01(metrics.interactionScore);
    weighted.push(["interactionScore", interaction, 0.12]);
    reasons.push(`interaction=${round3(interaction)}`);
  }
  if (typeof metrics.motionScore === "number") {
    const motion = clamp01(metrics.motionScore);
    const motionBalance = scoreMotionBalance(motion);
    weighted.push(["motionScore", motionBalance, 0.08]);
    reasons.push(`motion=${round3(motion)} -> balance=${round3(motionBalance)}`);
  }
  let penalty = 0;
  if (typeof metrics.faceCount === "number") {
    if (metrics.faceCount > 1) {
      penalty += 0.12;
      reasons.push(`faceCount=${metrics.faceCount} -> multi-face penalty`);
    } else {
      reasons.push("single face");
    }
  }

  if (weighted.length === 0) {
    return {
      score: 0.7,
      signalsUsed: [],
      reasons: ["metrics object empty; using neutral default"],
    };
  }

  const totalWeight = weighted.reduce((sum, [, , weight]) => sum + weight, 0);
  const score =
    weighted.reduce((sum, [, value, weight]) => sum + value * weight, 0) / totalWeight - penalty;

  return {
    score: round3(clamp01(score)),
    signalsUsed: weighted.map(([name]) => name),
    reasons,
  };
}

function assetFor(scene: "camera-on" | "camera-off", state: CompanionState) {
  const root = "/assets/sunny-doll";
  if (scene === "camera-off") {
    if (state === "tired") {
      return {
        idleDir: `${root}/camera-off/tired/idle`,
        clickDir: `${root}/camera-off/tired/click-recover`,
      };
    }
    return { idleDir: `${root}/camera-off/happy/idle` };
  }

  if (state === "mid") {
    return {
      idleDir: `${root}/camera-on/mid/idle`,
      clickDir: `${root}/camera-on/mid/click-reset`,
    };
  }
  if (state === "tired") {
    return {
      idleDir: `${root}/camera-on/tired/idle`,
      clickDir: `${root}/camera-on/tired/click-recover`,
    };
  }
  if (state === "sleep") {
    return {
      idleDir: `${root}/camera-on/sleep/idle`,
      clickDir: `${root}/camera-on/sleep/click-repair`,
    };
  }
  if (state === "happy") {
    return { idleDir: `${root}/camera-on/happy/idle` };
  }
  return { idleDir: `${root}/camera-on/normal/idle` };
}

function clickActionFor(scene: "camera-on" | "camera-off", state: CompanionState): CompanionEvaluateResponse["clickAction"] {
  if (scene === "camera-off" && state === "tired") return "recover-to-happy";
  if (scene === "camera-on" && state === "mid") return "reset-to-normal";
  if (scene === "camera-on" && state === "tired") return "recover-to-normal";
  if (scene === "camera-on" && state === "sleep") return "repair-to-normal";
  return "none";
}

function evaluateCompanionLocally(payload: CompanionEvaluatePayload): CompanionEvaluateResponse {
  const scene = payload.cameraEnabled ? "camera-on" : "camera-off";
  const focusDurationSec = Math.max(0, Math.floor(payload.focusDurationSec || 0));
  const unfocusDurationSec = Math.max(0, Math.floor(payload.unfocusDurationSec || 0));
  const tiredThresholdSec = normalizeTiredThreshold(payload.tiredThresholdSec);
  const attention = deriveAttentionScore(payload.metrics);
  const painScore = round3(clamp01(payload.metrics?.painScore ?? 0));
  const anxietyScore = round3(clamp01(payload.metrics?.anxietyScore ?? 0));
  const distressScore = round3(
    clamp01(
      Math.max(
        clamp01(payload.metrics?.distressScore ?? 0),
        painScore * 0.55 + anxietyScore * 0.45,
        painScore,
        anxietyScore,
      ),
    ),
  );

  let state: CompanionState = payload.cameraEnabled ? "normal" : "happy";
  const { happyStartSec, midStartSec } = resolveStageWindows(tiredThresholdSec);
  let focusScore = payload.cameraEnabled ? round3(Math.max(0.8, clamp01(attention.score))) : 1;
  const reasons = [...attention.reasons];

  if (!payload.cameraEnabled) {
    if (focusDurationSec >= DEFAULT_TIRED_THRESHOLD_SEC) {
      state = "tired";
      focusScore = 0;
      reasons.unshift(`camera off and usage >= ${DEFAULT_TIRED_THRESHOLD_SEC}s`);
    } else {
      state = "happy";
      focusScore = 1;
      reasons.unshift("camera off default state");
    }
  } else if (payload.manualPauseActive) {
    state = "happy";
    focusScore = 1;
    reasons.unshift("manual pause active -> keep happy until focus resumes");
  } else if (payload.distressLocked || distressScore >= DISTRESS_FORCE_TIRED_THRESHOLD) {
    state = "tired";
    focusScore = 0;
    reasons.unshift(
      payload.distressLocked
        ? "pain/anxiety lock is active until manual recovery"
        : `pain/anxiety exceeded threshold (pain=${painScore}, anxiety=${anxietyScore})`,
    );
  } else if (unfocusDurationSec >= UNFOCUS_THRESHOLD_SEC || (unfocusDurationSec >= 2 && attention.score < 0.18)) {
    state = "sleep";
    focusScore = 0;
    reasons.unshift(`unfocused for >= ${UNFOCUS_THRESHOLD_SEC}s or live attention collapsed`);
  } else if (focusDurationSec >= tiredThresholdSec) {
    state = "tired";
    focusScore = 0;
    reasons.unshift(`focused for >= ${tiredThresholdSec}s`);
  } else if (focusDurationSec >= midStartSec) {
    state = "mid";
    focusScore = computeMidStageScore(focusDurationSec, midStartSec, tiredThresholdSec);
    reasons.unshift("sustained focus in dynamic mid-state window");
  } else if (focusDurationSec >= happyStartSec) {
    state = "happy";
    focusScore = round3(Math.max(0.8, clamp01(attention.score)));
    reasons.unshift("sustained focus in dynamic happy window");
  } else {
    state = "normal";
    reasons.unshift(
      attention.score >= 0.75
        ? "camera-on baseline normal state"
        : "temporary unfocus below sleep threshold; keep normal state",
    );
  }

  return {
    scene,
    state,
    focusScore,
    focusDurationSec,
    unfocusDurationSec,
    clickAction: clickActionFor(scene, state),
    asset: assetFor(scene, state),
    debug: {
      attentionScore: attention.score,
      painScore,
      anxietyScore,
      distressScore,
      distressLocked: Boolean(payload.distressLocked),
      signalsUsed: attention.signalsUsed,
      reasons,
    },
  };
}

export async function evaluateCompanion(
  payload: CompanionEvaluatePayload,
): Promise<CompanionEvaluateResponse | null> {
  try {
    const res = await fetch(apiUrl("/api/companion/evaluate"), {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return evaluateCompanionLocally(payload);
    return (await res.json()) as CompanionEvaluateResponse;
  } catch {
    return evaluateCompanionLocally(payload);
  }
}
