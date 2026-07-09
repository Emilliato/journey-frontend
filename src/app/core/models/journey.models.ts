export interface StartSessionResponse {
  sessionId: string;
  startedAt: string;
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

export interface ChatMessage {
  role: 'learner' | 'journey';
  text: string;
}
