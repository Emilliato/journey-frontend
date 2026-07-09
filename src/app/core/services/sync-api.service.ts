import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SyncBatchRequest, SyncBatchResponse } from '../models/sync.models';

@Injectable({ providedIn: 'root' })
export class SyncApiService {
  constructor(private readonly http: HttpClient) {}

  syncBatch(request: SyncBatchRequest): Observable<SyncBatchResponse> {
    return this.http.post<SyncBatchResponse>(`${environment.apiUrl}/api/sync/batch`, request);
  }
}
