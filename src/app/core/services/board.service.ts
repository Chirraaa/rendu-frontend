import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BoardDto, ColumnDto, MemberDto } from '../models/board.models';
import { TicketDto, CreateTicketDto, UpdateTicketDto, TicketHistoryDto } from '../models/ticket.models';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getBoard(kanbanId: number): Observable<BoardDto> {
    return this.http.get<BoardDto>(`${this.base}/kanbans/${kanbanId}`);
  }

  addColumn(kanbanId: number, name: string): Observable<ColumnDto> {
    return this.http.post<ColumnDto>(`${this.base}/kanbans/${kanbanId}/columns`, { name });
  }

  updateColumn(kanbanId: number, columnId: number, name: string): Observable<void> {
    return this.http.put<void>(`${this.base}/kanbans/${kanbanId}/columns/${columnId}`, { name });
  }

  deleteColumn(kanbanId: number, columnId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/kanbans/${kanbanId}/columns/${columnId}`);
  }

  reorderColumns(kanbanId: number, columnIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/kanbans/${kanbanId}/columns/reorder`, { columnIds });
  }

  addTicket(kanbanId: number, dto: CreateTicketDto): Observable<TicketDto> {
    return this.http.post<TicketDto>(`${this.base}/kanbans/${kanbanId}/tickets`, dto);
  }

  updateTicket(kanbanId: number, ticketId: number, dto: UpdateTicketDto): Observable<void> {
    return this.http.put<void>(`${this.base}/kanbans/${kanbanId}/tickets/${ticketId}`, dto);
  }

  deleteTicket(kanbanId: number, ticketId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/kanbans/${kanbanId}/tickets/${ticketId}`);
  }

  moveTicket(kanbanId: number, ticketId: number, targetColumnId: number): Observable<void> {
    return this.http.put<void>(`${this.base}/kanbans/${kanbanId}/tickets/${ticketId}/move`, { targetColumnId });
  }

  reorderTickets(kanbanId: number, columnId: number, ticketIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/kanbans/${kanbanId}/columns/${columnId}/tickets/reorder`, { ticketIds });
  }

  getTicketHistory(kanbanId: number, ticketId: number): Observable<TicketHistoryDto[]> {
    return this.http.get<TicketHistoryDto[]>(`${this.base}/kanbans/${kanbanId}/tickets/${ticketId}/history`);
  }

  inviteMember(kanbanId: number, email: string): Observable<MemberDto> {
    return this.http.post<MemberDto>(`${this.base}/kanbans/${kanbanId}/members`, { email });
  }

  updateMemberRole(kanbanId: number, userId: number, role: string): Observable<void> {
    return this.http.put<void>(`${this.base}/kanbans/${kanbanId}/members/${userId}`, { role });
  }

  removeMember(kanbanId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/kanbans/${kanbanId}/members/${userId}`);
  }
}
