import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { KanbanDto, CreateKanbanDto } from '../models/kanban.models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class KanbanService {
  private apiUrl = `${environment.apiUrl}/kanbans`;

  constructor(private http: HttpClient) { }

  getMyKanbans(): Observable<KanbanDto[]> {
    return this.http.get<KanbanDto[]>(this.apiUrl);
  }

  createKanban(dto: CreateKanbanDto): Observable<KanbanDto> {
    return this.http.post<KanbanDto>(this.apiUrl, dto);
  }

  deleteKanban(kanban: KanbanDto) {
    return this.http.delete<void>(`${this.apiUrl}/${kanban.id}`);
  }
}