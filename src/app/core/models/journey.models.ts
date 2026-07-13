export interface StartSessionResponse {
  sessionId: string;
  startedAt: string;
  /** JOURNEY speaks first — the AI-generated opening message for this session. */
  greeting: string;
}

export interface SendMessageRequest {
  message: string;
}

export interface GoalUpdate {
  id: string;
  title: string;
  description: string | null;
  status: 'Active' | 'Completed' | 'Abandoned';
  wasCreated: boolean;
}

export interface SendMessageResponse {
  reply: string;
  goalUpdates: GoalUpdate[];
  memoriesRecorded: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: 'Active' | 'Completed' | 'Abandoned';
  updatedAt: string;
}

export type JourneyMemoryCategory = 'academic' | 'preference' | 'engagement' | 'goal_related';

export interface JourneyMemory {
  id: string;
  conversationSessionId: string | null;
  category: JourneyMemoryCategory;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'learner' | 'journey';
  text: string;
}
