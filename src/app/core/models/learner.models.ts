export interface CreateLearnerRequest {
  displayName: string;
  consentGranted: boolean;
}

export interface LearnerResponse {
  id: string;
  displayName: string;
  createdAt: string;
  consentActive: boolean;
}
