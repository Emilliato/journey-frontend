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
}
