import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Goal, SendMessageResponse, StartSessionResponse } from '../models/journey.models';

@Injectable({ providedIn: 'root' })
export class JourneyService {
  constructor(private readonly http: HttpClient) {}

  startSession(learnerId: string): Observable<StartSessionResponse> {
    return this.http.post<StartSessionResponse>(`${environment.apiUrl}/api/journey/sessions`, {
      learnerId,
    });
  }

  sendMessage(sessionId: string, message: string): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>(
      `${environment.apiUrl}/api/journey/sessions/${sessionId}/messages`,
      { message },
    );
  }

  completeSession(sessionId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/journey/sessions/${sessionId}/complete`, {});
  }

  listGoals(learnerId: string): Observable<Goal[]> {
    return this.http.get<Goal[]>(`${environment.apiUrl}/api/learners/${learnerId}/goals`);
  }
}
