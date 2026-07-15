import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BrainSparkAnswerResponse,
  BrainSparkQuestion,
  DashboardResponse,
} from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getDashboard(learnerId: string): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(
      `${environment.apiUrl}/api/learners/${learnerId}/dashboard`,
    );
  }

  listBrainSparks(): Observable<BrainSparkQuestion[]> {
    return this.http.get<BrainSparkQuestion[]>(`${environment.apiUrl}/api/brainsparks`);
  }

  answerBrainSpark(
    learnerId: string,
    questionId: string,
    answer: string,
  ): Observable<BrainSparkAnswerResponse> {
    return this.http.post<BrainSparkAnswerResponse>(
      `${environment.apiUrl}/api/learners/${learnerId}/brainsparks/answers`,
      { questionId, answer },
    );
  }

  deleteMemory(learnerId: string, memoryId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/api/learners/${learnerId}/memories/${memoryId}`,
    );
  }
}
