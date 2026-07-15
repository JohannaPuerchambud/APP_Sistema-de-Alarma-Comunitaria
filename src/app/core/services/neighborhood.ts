import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NeighborhoodService {
  private apiUrl = `${environment.apiBaseUrl}/neighborhoods`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  create(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  setAdmin(neighborhoodId: number, adminUserId: number | null, promote = false): Observable<any> {
    return this.http.put(`${this.apiUrl}/${neighborhoodId}/admin`, {
      admin_user_id: adminUserId,
      promote,
    });
  }

  updateUsers(
    neighborhoodId: number,
    userIds: number[],
    action: 'add' | 'remove',
  ): Observable<any> {
    return this.http.put(`${this.apiUrl}/${neighborhoodId}/users`, {
      user_ids: userIds,
      action,
    });
  }
}
