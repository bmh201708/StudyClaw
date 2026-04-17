import { apiUrl, authHeaders } from "../lib/sessionApi";

export type CompanionScene = "camera-on" | "camera-off";
export type CompanionState = "normal" | "happy" | "mid" | "tired" | "sleep";

export type CompanionSignalMetrics = {
  tabVisible?: boolean;
  faceDetected?: boolean;
  faceCount?: number;
  faceCentered?: number;
  eyeOpenScore?: number;
  headStability?: number;
  motionScore?: number;
  interactionScore?: number;
};

export type CompanionEvaluatePayload = {
  cameraEnabled: boolean;
  focusDurationSec: number;
  unfocusDurationSec: number;
  isTimerRunning?: boolean;
  clickRecoveryRequested?: boolean;
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
    signalsUsed: string[];
    reasons: string[];
  };
};

const UNFOCUS_THRESHOLD_SEC = 3;
const HAPPY_THRESHOLD_SEC = 5 * 60;
const MID_THRESHOLD_SEC = 3 * 60;
const TIRED_THRESHOLD_SEC = 25 * 60;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
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

  if (typeof metrics.tabVisible === "boolean") {
    weighted.push(["tabVisible", metrics.tabVisible ? 1 : 0, 0.22]);
    reasons.push(metrics.tabVisible ? "tab visible" : "tab hidden");
  }
  if (typeof metrics.faceDetected === "boolean") {
    weighted.push(["faceDetected", metrics.faceDetected ? 1 : 0, 0.28]);
    reasons.push(metrics.faceDetected ? "face detected" : "face missing");
  }
  if (typeof metrics.faceCentered === "number") weighted.push(["faceCentered", clamp01(metrics.faceCentered), 0.14]);
  if (typeof metrics.eyeOpenScore === "number") weighted.push(["eyeOpenScore", clamp01(metrics.eyeOpenScore), 0.12]);
  if (typeof metrics.headStability === "number") weighted.push(["headStability", clamp01(metrics.headStability), 0.1]);
  if (typeof metrics.interactionScore === "number") weighted.push(["interactionScore", clamp01(metrics.interactionScore), 0.08]);
  if (typeof metrics.motionScore === "number") {
    const motion = clamp01(metrics.motionScore);
    const moderateMotionScore = motion > 0.85 ? 0.45 : motion < 0.08 ? 0.55 : 1;
    weighted.push(["motionScore", moderateMotionScore, 0.06]);
  }
  if (typeof metrics.faceCount === "number") {
    reasons.push(metrics.faceCount > 1 ? "multiple faces detected" : "single face or unknown");
  }

  if (weighted.length === 0) {
    return {
      score: 0.7,
      signalsUsed: [],
      reasons: ["metrics object empty; using neutral default"],
    };
  }

  const totalWeight = weighted.reduce((sum, [, , weight]) => sum + weight, 0);
  const score = weighted.reduce((sum, [, value, weight]) => sum + value * weight, 0) / totalWeight;

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
  const attention = deriveAttentionScore(payload.metrics);

  let state: CompanionState = payload.cameraEnabled ? "normal" : "happy";
  let focusScore = payload.cameraEnabled ? Math.max(0.8, attention.score) : 1;
  const reasons = [...attention.reasons];

  if (!payload.cameraEnabled) {
    if (focusDurationSec >= TIRED_THRESHOLD_SEC) {
      state = "tired";
      focusScore = 0;
      reasons.unshift(`camera off and usage >= ${TIRED_THRESHOLD_SEC}s`);
    } else {
      state = "happy";
      focusScore = 1;
      reasons.unshift("camera off default state");
    }
  } else if (unfocusDurationSec >= UNFOCUS_THRESHOLD_SEC) {
    state = "sleep";
    focusScore = 0;
    reasons.unshift(`unfocused for >= ${UNFOCUS_THRESHOLD_SEC}s`);
  } else if (focusDurationSec >= TIRED_THRESHOLD_SEC) {
    state = "tired";
    focusScore = 0;
    reasons.unshift(`focused for >= ${TIRED_THRESHOLD_SEC}s`);
  } else if (focusDurationSec >= HAPPY_THRESHOLD_SEC) {
    state = "mid";
    focusScore = round3(Math.max(0, 0.8 * (1 - (focusDurationSec - HAPPY_THRESHOLD_SEC) / (TIRED_THRESHOLD_SEC - HAPPY_THRESHOLD_SEC))));
    reasons.unshift("focus duration in mid-state decay window (5-25 min)");
  } else if (focusDurationSec >= MID_THRESHOLD_SEC) {
    state = "happy";
    focusScore = round3(0.8 + 0.2 * ((focusDurationSec - MID_THRESHOLD_SEC) / (HAPPY_THRESHOLD_SEC - MID_THRESHOLD_SEC)));
    reasons.unshift("focus duration in happy window (3-5 min)");
  } else {
    state = "normal";
    focusScore = round3(Math.max(0.8, attention.score));
    reasons.unshift("focus duration < 3 min and unfocus threshold not reached");
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
