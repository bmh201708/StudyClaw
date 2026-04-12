import { motion, AnimatePresence } from "motion/react";
import { X, Heart } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface EmpathyOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

const empathyMessages = [
  "It's okay to take a moment. Sometimes the best ideas come after a short pause. 🌸",
  "Feeling stuck? That's your brain reorganizing. You're closer than you think! 💭",
  "Every expert was once a beginner who didn't give up. Keep going! 🌱",
  "Progress isn't always linear. You're doing better than you realize. ✨",
  "Taking a break is productive too. Your mind needs rest to be creative. 🍃",
  "This challenge is temporary. Your growth is permanent. 🌟",
  "Breathe. You've overcome harder things before. 💪",
  "Small steps are still steps forward. Be kind to yourself. 🦋",
  "Confusion is the beginning of understanding. Stay curious! 🔍",
  "Your effort today is building tomorrow's success. Keep planting seeds. 🌻",
];

export function EmpathyOverlay({ isVisible, onClose }: EmpathyOverlayProps) {
  const randomMessage = empathyMessages[Math.floor(Math.random() * empathyMessages.length)];

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Overlay Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
          >
            <Card className="bg-white/90 border-slate-200 shadow-2xl backdrop-blur">
              <div className="p-6 space-y-4">
                {/* Close Button */}
                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Heart Icon with Animation */}
                <div className="flex justify-center">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Heart className="w-16 h-16 text-sky-500 fill-sky-500" />
                  </motion.div>
                </div>

                {/* Empathy Message */}
                <div className="text-center space-y-3">
                  <h3 className="text-xl text-slate-800">
                    Hey, noticed you might be stuck 💜
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {randomMessage}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-slate-200 hover:bg-slate-50"
                    onClick={onClose}
                  >
                    I'm OK
                  </Button>
                  <Button
                    className="flex-1 bg-[#3f5b6b] hover:bg-[#344f5e]"
                    onClick={onClose}
                  >
                    Thanks!
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
