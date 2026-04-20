export interface TicketDto {
  id: number;
  title: string;
  description?: string;
  timeSpent: number;
  columnId: number;
  assignedToUserId?: number;
  assignedToEmail: string;
  assignedToName: string;
  createdAt: string;
}

export interface CreateTicketDto {
  title: string;
  description?: string;
  timeSpent: number;
  columnId: number;
  assignedToUserId?: number;
}

export interface UpdateTicketDto {
  title: string;
  description?: string;
  timeSpent: number;
  columnId: number;
  assignedToUserId?: number;
}

export interface TicketHistoryDto {
  id: number;
  fromColumnName: string;
  toColumnName: string;
  movedAt: string;
}