export interface CreateLearnerRequest {
  displayName: string;
  consentGranted: boolean;
  /** The child's own sign-in, chosen by the parent (Learner role account). */
  username: string;
  password: string;
}

export interface LearnerResponse {
  id: string;
  displayName: string;
  createdAt: string;
  consentActive: boolean;
  /** Serialized AvatarConfig JSON, or null for learners with no avatar yet. */
  avatarConfig: string | null;
}
