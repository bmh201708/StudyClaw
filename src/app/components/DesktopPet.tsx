import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface DesktopPetProps {
  isFocused: boolean;
  isDistracted: boolean;
}

export function DesktopPet({ isFocused, isDistracted }: DesktopPetProps) {
  const [emotion, setEmotion] = useState<"happy" | "neutral" | "concerned">("neutral");

  useEffect(() => {
    if (isFocused) {
      setEmotion("happy");
    } else if (isDistracted) {
      setEmotion("concerned");
    } else {
      setEmotion("neutral");
    }
  }, [isFocused, isDistracted]);

  const getEmotionColor = () => {
    switch (emotion) {
      case "happy":
        return "from-emerald-200 via-teal-200 to-sky-200";
      case "concerned":
        return "from-amber-200 via-orange-200 to-rose-200";
      default:
        return "from-sky-200 via-indigo-200 to-violet-200";
    }
  };

  const getEmotionScale = () => {
    switch (emotion) {
      case "happy":
        return 1.1;
      case "concerned":
        return 0.9;
      default:
        return 1;
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        animate={{
          scale: getEmotionScale(),
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          scale: { duration: 0.5 },
          rotate: {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
        className="relative"
      >
        {/* Pet Body */}
        <div
          className={`w-32 h-32 rounded-full bg-gradient-to-br ${getEmotionColor()} shadow-2xl`}
        >
          {/* Glow Effect */}
          <motion.div
            animate={{
              opacity: isFocused ? [0.5, 1, 0.5] : 0.2,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={`absolute inset-0 rounded-full bg-gradient-to-br ${getEmotionColor()} blur-xl`}
          />

          {/* Eyes */}
          <div className="relative z-10 flex items-center justify-center h-full gap-6">
            <motion.div
              animate={{
                scaleY: isDistracted ? [1, 0.3, 1] : 1,
              }}
              transition={{
                duration: 0.3,
                repeat: isDistracted ? Infinity : 0,
                repeatDelay: 2,
              }}
              className="w-3 h-4 bg-white rounded-full"
            />
            <motion.div
              animate={{
                scaleY: isDistracted ? [1, 0.3, 1] : 1,
              }}
              transition={{
                duration: 0.3,
                repeat: isDistracted ? Infinity : 0,
                repeatDelay: 2,
              }}
              className="w-3 h-4 bg-white rounded-full"
            />
          </div>

          {/* Mouth */}
          <motion.div
            animate={{
              rotate: emotion === "happy" ? 0 : emotion === "concerned" ? 180 : 0,
            }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 w-12 h-6"
          >
            <div className={`w-full h-full border-b-2 border-white rounded-full ${
              emotion === "happy" ? "border-b-4" : ""
            }`} />
          </motion.div>
        </div>
      </motion.div>

      {/* Status Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-sm text-slate-600">
          {emotion === "happy" && "Great focus! Keep going! 🌟"}
          {emotion === "concerned" && "Stay strong! You got this 💪"}
          {emotion === "neutral" && "Ready when you are ✨"}
        </p>
      </motion.div>
    </div>
  );
}
