export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

/** `email` carries a parent's email OR a learner's username — the API resolves either. */
export interface LoginRequest {
  email: string;
  password: string;
}

export type AccountRole = 'Parent' | 'Learner';

export interface AuthResponse {
  token: string;
  expiresAt: string;
  parentId: string;
  email: string;
  displayName: string | null;
  /** Which kind of account signed in — drives post-login routing. */
  role: AccountRole;
  /** Set for learner logins: the learner profile this account is bound to. */
  learnerId: string | null;
}
