const UNFOCUS_THRESHOLD_SEC = 3;
const HAPPY_WINDOW_START_SEC = 3 * 60;
const MID_WINDOW_START_SEC = 5 * 60;
const DEFAULT_TIRED_THRESHOLD_SEC = 25 * 60;
const MAX_TIRED_THRESHOLD_SEC = 25 * 60;
const FOCUS_LOCK_THRESHOLD = 0.75;
const NORMAL_MIN_SCORE = 0.8;
const MID_START_SCORE = 0.8;
const DISTRESS_FORCE_TIRED_THRESHOLD = 0.74;
function clamp01(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.min(1, Math.max(0, value));
}
function round3(value) {
    return Math.round(value * 1000) / 1000;
}
function scoreMotionBalance(motionScore) {
    const motion = clamp01(motionScore);
    if (motion < 0.02)
        return 0.35;
    if (motion < 0.08)
        return 0.72;
    if (motion <= 0.35)
        return 1;
    if (motion <= 0.6)
        return 0.72;
    if (motion <= 0.82)
        return 0.42;
    return 0.18;
}
function normalizeTiredThreshold(value) {
    if (!Number.isFinite(value))
        return DEFAULT_TIRED_THRESHOLD_SEC;
    return Math.min(MAX_TIRED_THRESHOLD_SEC, Math.max(60, Math.floor(value)));
}
function resolveStageWindows(tiredThresholdSec) {
    if (tiredThresholdSec <= HAPPY_WINDOW_START_SEC) {
        return {
            happyStartSec: tiredThresholdSec,
            midStartSec: tiredThresholdSec,
        };
    }
    if (tiredThresholdSec <= MID_WINDOW_START_SEC) {
        return {
            happyStartSec: HAPPY_WINDOW_START_SEC,
            midStartSec: tiredThresholdSec,
        };
    }
    return {
        happyStartSec: HAPPY_WINDOW_START_SEC,
        midStartSec: MID_WINDOW_START_SEC,
    };
}
function computeMidStageScore(focusDurationSec, midStartSec, tiredThresholdSec) {
    if (focusDurationSec <= midStartSec)
        return MID_START_SCORE;
    if (focusDurationSec >= tiredThresholdSec)
        return 0;
    const decayProgress = (focusDurationSec - midStartSec) / Math.max(tiredThresholdSec - midStartSec, 1);
    return round3(clamp01(MID_START_SCORE * (1 - decayProgress)));
}
function deriveAttentionScore(metrics) {
    if (!metrics) {
        return {
            score: 0.7,
            signalsUsed: [],
            reasons: ["no metrics provided; using neutral default"],
        };
    }
    const weighted = [];
    const reasons = [];
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
        }
        else {
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
    const score = weighted.reduce((sum, [, value, weight]) => sum + value * weight, 0) / totalWeight - penalty;
    return {
        score: round3(clamp01(score)),
        signalsUsed: weighted.map(([name]) => name),
        reasons,
    };
}
function resolveCameraOnState(focusDurationSec, unfocusDurationSec, attentionScore, painScore, anxietyScore, distressScore, tiredThresholdSec, manualPauseActive, distressLocked) {
    if (manualPauseActive) {
        return {
            state: "happy",
            focusScore: 1,
            reasons: ["manual pause active -> keep happy until focus resumes"],
        };
    }
    if (distressLocked || distressScore >= DISTRESS_FORCE_TIRED_THRESHOLD) {
        return {
            state: "tired",
            focusScore: 0,
            reasons: [
                distressLocked
                    ? "pain/anxiety lock is active until manual recovery"
                    : `pain/anxiety exceeded threshold (pain=${round3(painScore)}, anxiety=${round3(anxietyScore)})`,
            ],
        };
    }
    if (unfocusDurationSec >= UNFOCUS_THRESHOLD_SEC) {
        return {
            state: "sleep",
            focusScore: 0,
            reasons: [`unfocused for >= ${UNFOCUS_THRESHOLD_SEC}s`],
        };
    }
    const { happyStartSec, midStartSec } = resolveStageWindows(tiredThresholdSec);
    if (focusDurationSec >= tiredThresholdSec) {
        return {
            state: "tired",
            focusScore: 0,
            reasons: [`focused for >= ${tiredThresholdSec}s`],
        };
    }
    if (focusDurationSec >= midStartSec) {
        return {
            state: "mid",
            focusScore: computeMidStageScore(focusDurationSec, midStartSec, tiredThresholdSec),
            reasons: ["sustained focus in dynamic mid-state window"],
        };
    }
    if (focusDurationSec >= happyStartSec) {
        return {
            state: "happy",
            focusScore: round3(Math.max(NORMAL_MIN_SCORE, clamp01(attentionScore))),
            reasons: ["sustained focus in dynamic happy window"],
        };
    }
    return {
        state: "normal",
        focusScore: round3(Math.max(NORMAL_MIN_SCORE, clamp01(attentionScore))),
        reasons: attentionScore >= FOCUS_LOCK_THRESHOLD
            ? ["camera-on baseline normal state"]
            : ["temporary unfocus below sleep threshold; keep normal state"],
    };
}
function resolveCameraOffState(focusDurationSec) {
    if (focusDurationSec >= DEFAULT_TIRED_THRESHOLD_SEC) {
        return {
            state: "tired",
            focusScore: 0,
            reasons: [`camera off and usage >= ${DEFAULT_TIRED_THRESHOLD_SEC}s`],
        };
    }
    return {
        state: "happy",
        focusScore: 1,
        reasons: ["camera off default state"],
    };
}
function assetFor(scene, state) {
    const root = "/assets/sunny-doll";
    if (scene === "camera-off") {
        if (state === "tired") {
            return {
                idleDir: `${root}/camera-off/tired/idle`,
                clickDir: `${root}/camera-off/tired/click-recover`,
            };
        }
        return {
            idleDir: `${root}/camera-off/happy/idle`,
        };
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
        return {
            idleDir: `${root}/camera-on/happy/idle`,
        };
    }
    return {
        idleDir: `${root}/camera-on/normal/idle`,
    };
}
function clickActionFor(scene, state) {
    if (scene === "camera-off" && state === "tired")
        return "recover-to-happy";
    if (scene === "camera-on" && state === "mid")
        return "reset-to-normal";
    if (scene === "camera-on" && state === "tired")
        return "recover-to-normal";
    if (scene === "camera-on" && state === "sleep")
        return "repair-to-normal";
    return "none";
}
export function evaluateCompanionState(input) {
    const cameraEnabled = Boolean(input.cameraEnabled);
    const scene = cameraEnabled ? "camera-on" : "camera-off";
    const focusDurationSec = Math.max(0, Math.floor(input.focusDurationSec || 0));
    const unfocusDurationSec = Math.max(0, Math.floor(input.unfocusDurationSec || 0));
    const tiredThresholdSec = normalizeTiredThreshold(input.tiredThresholdSec);
    const attention = deriveAttentionScore(input.metrics);
    const painScore = round3(clamp01(input.metrics?.painScore ?? 0));
    const anxietyScore = round3(clamp01(input.metrics?.anxietyScore ?? 0));
    const distressScore = round3(clamp01(Math.max(clamp01(input.metrics?.distressScore ?? 0), painScore * 0.55 + anxietyScore * 0.45, painScore, anxietyScore)));
    const resolved = cameraEnabled
        ? resolveCameraOnState(focusDurationSec, unfocusDurationSec, attention.score, painScore, anxietyScore, distressScore, tiredThresholdSec, Boolean(input.manualPauseActive), Boolean(input.distressLocked))
        : resolveCameraOffState(focusDurationSec);
    return {
        scene,
        state: resolved.state,
        focusScore: resolved.focusScore,
        focusDurationSec,
        unfocusDurationSec,
        clickAction: clickActionFor(scene, resolved.state),
        asset: assetFor(scene, resolved.state),
        debug: {
            attentionScore: attention.score,
            painScore,
            anxietyScore,
            distressScore,
            distressLocked: Boolean(input.distressLocked),
            signalsUsed: attention.signalsUsed,
            reasons: [...resolved.reasons, ...attention.reasons],
        },
    };
}
