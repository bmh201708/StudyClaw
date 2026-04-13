import type { OpenAiCompatibleMessage, WorkflowAssistantInput, WorkflowAssistantLiveSnapshot } from "./types.js";

export function buildStudyPlanMessages(goal: string, contextForAI: string): OpenAiCompatibleMessage[] {
  const systemPrompt = [
    "You are StudyClaw's planning engine.",
    "Convert the user's goal and context into a short actionable task plan.",
    "Return only JSON with this exact shape:",
    '{"summary":"string","tasks":[{"title":"string","duration":"string","note":"string","priority":"important-urgent|important-not-urgent|not-important-urgent|not-important-not-urgent"}]}',
    "Rules:",
    "- Produce 3 to 7 tasks.",
    "- Keep task titles concrete and short.",
    "- duration should be human-readable like '8 min' or '20 min'.",
    "- note should help the user start immediately.",
    "- priority must be one of the allowed enum values.",
    "- No markdown. No explanation outside JSON.",
  ].join("\n");

  const userPrompt = [`Goal: ${goal}`, "", "Context:", contextForAI.slice(0, 120_000)].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

export function buildWorkflowLiveSnapshot(input: WorkflowAssistantInput): WorkflowAssistantLiveSnapshot {
  return {
    goal: input.goal || "(未命名目标)",
    focusTime: input.focusTime,
    completedTasks: input.tasks.filter((task) => task.completed).length,
    totalTasks: input.tasks.length,
    tasks: input.tasks,
    distractions: input.distractions,
  };
}

export function buildWorkflowAssistantMessages(
  input: WorkflowAssistantInput,
  liveSnapshot: WorkflowAssistantLiveSnapshot,
): OpenAiCompatibleMessage[] {
  const systemPrompt = [
    "You are StudyClaw workflow companion.",
    "Help the user continue their current study session with concise, empathetic, actionable coaching.",
    "Use tools when you need facts about the user, the current workflow, or recent saved progress.",
    "Do not invent user profile details or session context if a tool can provide them.",
    "Keep responses short and useful. Suggest one or two next steps at most.",
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content: `Live workflow snapshot from client:\n${JSON.stringify(liveSnapshot)}`,
    },
    ...input.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}
