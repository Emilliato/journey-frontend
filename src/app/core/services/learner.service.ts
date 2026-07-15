import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateLearnerRequest, LearnerResponse } from '../models/learner.models';

@Injectable({ providedIn: 'root' })
export class LearnerService {
  constructor(private readonly http: HttpClient) {}

  createLearner(request: CreateLearnerRequest): Observable<LearnerResponse> {
    return this.http.post<LearnerResponse>(`${environment.apiUrl}/api/learners`, request);
  }

  listLearners(): Observable<LearnerResponse[]> {
    return this.http.get<LearnerResponse[]>(`${environment.apiUrl}/api/learners`);
  }

  getLearner(id: string): Observable<LearnerResponse> {
    return this.http.get<LearnerResponse>(`${environment.apiUrl}/api/learners/${id}`);
  }

  /** Avatar Studio save — the whole config as one JSON string. */
  updateAvatar(id: string, avatarConfig: string): Observable<LearnerResponse> {
    return this.http.put<LearnerResponse>(`${environment.apiUrl}/api/learners/${id}/avatar`, {
      avatarConfig,
    });
  }

  /** Parent dashboard consent toggle (grant/revoke). */
  setConsent(id: string, active: boolean): Observable<LearnerResponse> {
    return this.http.put<LearnerResponse>(`${environment.apiUrl}/api/learners/${id}/consent`, {
      active,
    });
  }
}
