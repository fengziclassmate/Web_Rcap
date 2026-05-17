export const queryKeys = {
  schedule: {
    all: ["schedule"] as const,
    byUser: (userId: string) => ["schedule", "by-user", userId] as const,
  },
  researchWorkflow: {
    all: ["research-workflow"] as const,
    byUser: (userId: string) => ["research-workflow", "by-user", userId] as const,
  },
  logs: {
    all: ["logs"] as const,
    posts: (userId: string) => ["logs", "posts", userId] as const,
    tags: (userId: string) => ["logs", "tags", userId] as const,
  },
  literature: {
    all: ["literature"] as const,
    items: (userId: string) => ["literature", "items", userId] as const,
    tags: (userId: string) => ["literature", "tags", userId] as const,
    attachments: (userId: string) => ["literature", "attachments", userId] as const,
  },
  llm: {
    all: ["llm"] as const,
    chatSessions: ["llm", "chat-sessions"] as const,
  },
};
