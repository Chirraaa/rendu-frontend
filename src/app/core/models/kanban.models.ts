export interface KanbanDto {
    id: number;
    name: string;
    role: string;
    memberCount: number;
    createdAt: string;
}

export interface CreateKanbanDto {
    name: string;
}