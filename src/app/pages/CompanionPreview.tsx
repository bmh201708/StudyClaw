import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, FastForward } from "lucide-react";
import { SunnyDollCompanion } from "../components/SunnyDollCompanion";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const FAST_STEP_SEC = 60;

export function CompanionPreview() {
  const [focusTime, setFocusTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    if (!isTimerRunning) return;
    const timer = window.setInterval(() => {
      setFocusTime((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTimerRunning]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffaf8_0%,#fff3ee_100%)] px-4 py-8 text-[#2d3436]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#d48272]">Remote Preview</p>
          <h1 className="text-4xl font-bold [font-family:Fredoka,sans-serif]">Sunny Doll Companion Preview</h1>
          <p className="text-sm text-[#6f787c]">
            This page is built from the remote server source. Use it to debug state text, MediaPipe detection,
            and GIF paths before formal deployment.
          </p>
        </div>

        <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_12px_0_rgba(0,0,0,0.03)]">
          <CardHeader>
            <CardTitle className="text-2xl [font-family:Fredoka,sans-serif]">Preview Controls</CardTitle>
            <CardDescription>
              Simulate focus time locally. Camera behavior still uses your real browser camera and MediaPipe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="rounded-full bg-[#ff9d8d] text-white hover:bg-[#ff8c79]"
                onClick={() => setIsTimerRunning((prev) => !prev)}
              >
                {isTimerRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                {isTimerRunning ? "Pause timer" : "Start timer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-[#d8ebef] bg-[#eef9fb] text-[#5fa9ba] hover:bg-[#e5f6f9]"
                onClick={() => setFocusTime((prev) => prev + FAST_STEP_SEC)}
              >
                <FastForward className="mr-2 h-4 w-4" />
                Add 1 minute
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-[#f4ddd6] bg-[#fff7f4] text-[#c27b6b] hover:bg-[#fff0ea]"
                onClick={() => {
                  setFocusTime(0);
                  setIsTimerRunning(false);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="rounded-[1rem] bg-[#fff7f4] p-4 text-sm leading-7 text-[#5d666a]">
              <div>Current local focus time: {focusTime} sec</div>
              <div>3 minutes = 180 sec, 5 minutes = 300 sec, 25 minutes = 1500 sec</div>
              <div>Without camera: default is happy, after 1500 sec it becomes tired</div>
              <div>With camera: normal - happy - mid - tired, unfocus 3 sec becomes sleep</div>
            </div>

            <div className="rounded-[1.6rem] border-2 border-[#fff0eb] bg-[#fffaf8] px-5 py-6">
              <SunnyDollCompanion sessionFocusTimeSec={focusTime} isTimerRunning={isTimerRunning} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
