import { TicketDto } from './ticket.models';

export interface ColumnDto {
  id: number;
  name: string;
  order: number;
  ticketCount: number;
  totalHours: number;
  tickets: TicketDto[];
}

export interface BoardDto {
  id: number;
  name: string;
  currentUserRole: string;
  createdByUserId: number;
  totalHours: number;
  columns: ColumnDto[];
  members: MemberDto[];
}

export interface MemberDto {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  joinedAt: string;
}