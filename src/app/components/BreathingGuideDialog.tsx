import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type Phase = "inhale" | "hold" | "exhale" | "complete";

const INHALE_MS = 4000;
const HOLD_MS = 2000;
const EXHALE_MS = 6000;
const CYCLES = 3;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After user finishes, optional scroll to tasks */
  onContinueToTasks?: () => void;
};

export function BreathingGuideDialog({ open, onOpenChange, onContinueToTasks }: Props) {
  const [phase, setPhase] = useState<Phase>("inhale");
  const [cycleIndex, setCycleIndex] = useState(0);
  const runId = useRef(0);

  useEffect(() => {
    if (!open) {
      runId.current += 1;
      setPhase("inhale");
      setCycleIndex(0);
      return;
    }

    const id = ++runId.current;
    let cancelled = false;

    const sequence = async () => {
      setPhase("inhale");
      setCycleIndex(0);
      for (let c = 0; c < CYCLES; c++) {
        if (cancelled || runId.current !== id) return;
        setCycleIndex(c);
        setPhase("inhale");
        await sleep(INHALE_MS);
        if (cancelled || runId.current !== id) return;
        setPhase("hold");
        await sleep(HOLD_MS);
        if (cancelled || runId.current !== id) return;
        setPhase("exhale");
        await sleep(EXHALE_MS);
      }
      if (cancelled || runId.current !== id) return;
      setPhase("complete");
    };

    sequence();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const phaseLabel =
    phase === "inhale"
      ? "慢慢吸气…"
      : phase === "hold"
        ? "轻缓屏息…"
        : phase === "exhale"
          ? "缓缓呼气…"
          : "好了，温柔地回到当下";

  const subline =
    phase === "complete"
      ? "下一小口任务就好，不必一次做完所有事。"
      : `跟随圆环 · 第 ${cycleIndex + 1} / ${CYCLES} 轮`;

  const targetScale = phase === "inhale" ? 1.14 : phase === "hold" ? 1.14 : phase === "exhale" ? 0.86 : 1;

  const transitionDuration =
    phase === "inhale" ? INHALE_MS / 1000 : phase === "exhale" ? EXHALE_MS / 1000 : HOLD_MS / 1000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-amber-100/80 bg-white/95 shadow-[0_24px_80px_rgba(251,191,36,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-slate-800">Guide me through this</DialogTitle>
          <DialogDescription>跟着节奏呼吸几次，给身体一点空间。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-8 py-4">
          <p className="text-center text-[15px] leading-relaxed text-slate-600 px-2">
            Take a deep breath. The complexity you&apos;re navigating is significant. It&apos;s perfectly okay to pause
            here, shrink the next step, or ask for a lighter on-ramp.
          </p>

          <div className="relative flex h-48 w-48 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-200/50 to-rose-200/40 blur-2xl"
              aria-hidden
            />
            <motion.div
              className="relative flex h-36 w-36 items-center justify-center rounded-full border-2 border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 shadow-[0_0_40px_rgba(251,191,36,0.25)]"
              initial={{ scale: 0.88 }}
              animate={{ scale: phase === "complete" ? 1 : targetScale }}
              transition={{
                duration: phase === "hold" || phase === "complete" ? 0.35 : transitionDuration,
                ease: [0.45, 0, 0.55, 1],
              }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={phase + cycleIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-center text-sm font-medium text-amber-950/90 px-4"
                >
                  {phaseLabel}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          </div>

          <p className="text-xs text-slate-400">{subline}</p>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            {phase === "complete" ? (
              <>
                <Button
                  className="rounded-full bg-[#3f4f5c] text-white hover:bg-[#34424d]"
                  onClick={() => {
                    onOpenChange(false);
                    onContinueToTasks?.();
                  }}
                >
                  继续当前任务
                </Button>
                <Button variant="outline" className="rounded-full border-slate-200" onClick={() => onOpenChange(false)}>
                  关闭
                </Button>
              </>
            ) : (
              <Button variant="ghost" className="text-slate-400 hover:text-slate-600" onClick={() => onOpenChange(false)}>
                跳过引导
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
