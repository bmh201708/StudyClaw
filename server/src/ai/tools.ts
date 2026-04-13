import { progressStore, store } from "../store.js";
import type { AiToolDefinition, OpenAiCompatibleToolDefinition, WorkflowAssistantToolContext } from "./types.js";

function toToolDefinition(definition: AiToolDefinition<WorkflowAssistantToolContext>): OpenAiCompatibleToolDefinition {
  return {
    type: "function",
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
    },
  };
}

export function createWorkflowAssistantTools() {
  const tools: AiToolDefinition<WorkflowAssistantToolContext>[] = [
    {
      name: "get_current_user_profile",
      description: "Get the logged-in user's profile for personalized coaching.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async ({ user }) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      }),
    },
    {
      name: "get_current_learning_context",
      description: "Get the user's current learning goal, stored session context, and live workflow snapshot.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async ({ user, sessionId, liveSnapshot }) => {
        const activeSession = await store.getActive(user.id, sessionId);
        return {
          activeSession: activeSession
            ? {
                id: activeSession.id,
                goal: activeSession.goal,
                mode: activeSession.mode,
                contextSummary: activeSession.contextSummary || "",
                createdAt: activeSession.createdAt,
                updatedAt: activeSession.updatedAt,
                focusTime: activeSession.focusTime,
                completedTasks: activeSession.completedTasks,
                totalTasks: activeSession.totalTasks,
                distractionCount: activeSession.distractionCount,
                tasks: activeSession.tasks,
                distractionEscrow: activeSession.distractionEscrow,
              }
            : null,
          liveWorkflowSnapshot: liveSnapshot,
        };
      },
    },
    {
      name: "get_recent_saved_progress",
      description: "Get the user's three most recent saved progress snapshots.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async ({ user }) => {
        const recent = await progressStore.listRecent(user.id, 3);
        return recent.map((item) => ({
          id: item.id,
          goal: item.goal,
          focusTime: item.focusTime,
          completedTasks: item.completedTasks,
          totalTasks: item.totalTasks,
          distractionCount: item.distractionCount,
          savedAt: item.savedAt,
        }));
      },
    },
  ];

  return {
    definitions: tools,
    openAiTools: tools.map(toToolDefinition),
  };
}
