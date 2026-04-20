import { Component, DestroyRef, inject, OnInit, OnDestroy, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HubConnectionBuilder, HubConnection } from '@microsoft/signalr';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { BoardService } from '../../core/services/board.service';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { MemberRole } from '../../core/models/member-role';
import { BoardDto, ColumnDto, MemberDto } from '../../core/models/board.models';
import { TicketDto, TicketHistoryDto } from '../../core/models/ticket.models';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';

import { ButtonModule } from 'primeng/button';
import { ButtonGroupModule } from 'primeng/buttongroup';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MenuModule } from 'primeng/menu';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    ButtonModule,
    ButtonGroupModule,
    CardModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    SkeletonModule,
    SelectModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    MenuModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './board.html',
  styleUrl: './board.scss'
})
export class BoardComponent implements OnInit, OnDestroy {
  board: BoardDto | null = null;
  loading = true;
  kanbanId!: number;

  connectionStatus: 'connected' | 'disconnected' | 'hidden' = 'hidden';
  private syncBadgeTimer: ReturnType<typeof setTimeout> | null = null;

  showAddColumnDialog = false;
  showEditColumnDialog = false;
  newColumnName = '';
  editColumnName = '';
  editingColumn: ColumnDto | null = null;
  columnMenuItems: MenuItem[] = [];

  openColumnMenu(event: Event, col: ColumnDto, menu: any): void {
    this.columnMenuItems = [
      { label: 'Change name', icon: 'pi pi-pencil', command: () => this.openEditColumn(col) },
      { label: 'Delete column', icon: 'pi pi-trash', command: () => this.deleteColumn(col) }
    ];
    menu.toggle(event);
  }

  showTicketDialog = false;
  editingTicket: TicketDto | null = null;
  ticketForm = { title: '', description: '', timeSpent: 0, columnId: 0, assignedToUserId: undefined as number | undefined };
  savingTicket = false;

  showMembersDialog = false;
  inviteEmail = '';
  inviting = false;

  showMemberPickerDialog = false;
  memberPickerSearch = '';

  showHistoryDialog = false;
  historyTicket: TicketDto | null = null;
  ticketHistory: TicketHistoryDto[] = [];
  historyLoading = false;

  searchText = '';
  isDragging = false;
  private hubConnection: HubConnection | null = null;
  private isRefreshing = false;
  private suppressUntil = 0;

  private destroyRef = inject(DestroyRef);

  private _selectedViewUserId: number | 'global' | null = null;
  private _displayColumns: ColumnDto[] = [];

  get selectedViewUserId(): number | 'global' | null {
    return this._selectedViewUserId;
  }

  set selectedViewUserId(value: number | 'global' | null) {
    this._selectedViewUserId = value;
    this.searchText = '';
    this.computeDisplayColumns();
  }

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private boardService: BoardService,
    public authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.kanbanId = parseInt(this.route.snapshot.paramMap.get('id')!);
    this.loadBoard();
  }

  ngOnDestroy(): void {
    if (this.syncBadgeTimer) clearTimeout(this.syncBadgeTimer);
    this.stopSignalR();
  }

  loadBoard(): void {
    this.loading = true;
    this.boardService.getBoard(this.kanbanId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.board = data;
          this._selectedViewUserId = data.currentUserRole === MemberRole.Admin ? 'global' : null;
          this.computeDisplayColumns();
          this.loading = false;
          this.startSignalR();
        },
        error: () => {
          this.loading = false;
          this.router.navigate(['/dashboard']);
        }
      });
  }

  private get anyDialogOpen(): boolean {
    return this.showAddColumnDialog || this.showEditColumnDialog ||
           this.showTicketDialog || this.showMembersDialog ||
           this.showHistoryDialog || this.showMemberPickerDialog;
  }

  private startSignalR(): void {
    const hubUrl = environment.apiUrl.replace('/api', '') + '/hubs/board';
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => this.authService.getAccessToken() ?? ''
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('BoardUpdated', () => {
      if (Date.now() < this.suppressUntil) return;
      this.ngZone.run(() => this.refreshBoard());
    });

    this.hubConnection.onreconnecting(() => {
      this.ngZone.run(() => {
        if (this.syncBadgeTimer) { clearTimeout(this.syncBadgeTimer); this.syncBadgeTimer = null; }
        this.connectionStatus = 'disconnected';
      });
    });

    this.hubConnection.onreconnected(() => {
      this.ngZone.run(() => this.setConnected());
      this.hubConnection!.invoke('JoinBoard', this.kanbanId).catch(() => {
        this.ngZone.run(() => {
        if (this.syncBadgeTimer) { clearTimeout(this.syncBadgeTimer); this.syncBadgeTimer = null; }
        this.connectionStatus = 'disconnected';
      });
      });
    });

    this.hubConnection.onclose(() => {
      this.ngZone.run(() => {
        if (this.syncBadgeTimer) { clearTimeout(this.syncBadgeTimer); this.syncBadgeTimer = null; }
        this.connectionStatus = 'disconnected';
      });
    });

    this.hubConnection.start()
      .then(() => {
        this.ngZone.run(() => this.setConnected());
        return this.hubConnection!.invoke('JoinBoard', this.kanbanId);
      })
      .catch(() => {
        this.ngZone.run(() => {
        if (this.syncBadgeTimer) { clearTimeout(this.syncBadgeTimer); this.syncBadgeTimer = null; }
        this.connectionStatus = 'disconnected';
      });
      });
  }

  private stopSignalR(): void {
    if (!this.hubConnection) return;
    this.hubConnection.invoke('LeaveBoard', this.kanbanId)
      .catch(() => {})
      .finally(() => { this.hubConnection?.stop(); this.hubConnection = null; });
  }

  private setConnected(): void {
    if (this.syncBadgeTimer) clearTimeout(this.syncBadgeTimer);
    this.connectionStatus = 'connected';
    this.syncBadgeTimer = setTimeout(() => {
      this.ngZone.run(() => { this.connectionStatus = 'hidden'; });
    }, 3000);
  }

  private notifyMutated(): void {
    this.suppressUntil = Date.now() + 1500;
  }

  refreshBoard(): void {
    if (this.isDragging || this.anyDialogOpen || this.loading || this.isRefreshing) return;
    this.isRefreshing = true;
    this.boardService.getBoard(this.kanbanId).subscribe({
      next: (data) => {
        this.isRefreshing = false;
        if (this.isDragging || this.anyDialogOpen) return;
        this.board = data;
        this.computeDisplayColumns();
      },
      error: () => { this.isRefreshing = false; }
    });
  }

  get isAdmin(): boolean {
    return this.board?.currentUserRole === MemberRole.Admin;
  }

  get isOwner(): boolean {
    const currentUserId = this.board?.members.find(
      m => m.email === this.authService.currentUser()?.email
    )?.userId;
    return currentUserId !== undefined && currentUserId === this.board?.createdByUserId;
  }

  get columnIds(): string[] {
    return this.board?.columns.map(c => 'col-' + c.id) ?? [];
  }

  get isFiltered(): boolean {
    return this.selectedViewUserId !== null;
  }

  get isGlobalView(): boolean {
    return this.selectedViewUserId === 'global';
  }

  get isMemberView(): boolean {
    return typeof this._selectedViewUserId === 'number';
  }

  get selectedMemberEmail(): string {
    if (typeof this._selectedViewUserId === 'number') {
      return this.board?.members.find(m => m.userId === this._selectedViewUserId)?.email ?? '';
    }
    return '';
  }

  get filteredMemberPickerList(): MemberDto[] {
    const q = this.memberPickerSearch.trim().toLowerCase();
    const currentEmail = this.authService.currentUser()?.email;
    return (this.board?.members ?? [])
      .filter(m => m.email !== currentEmail)
      .filter(m => !q ||
        m.email.toLowerCase().includes(q) ||
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q));
  }

  selectMemberView(userId: number): void {
    this.selectedViewUserId = userId;
    this.showMemberPickerDialog = false;
    this.memberPickerSearch = '';
  }

  get assignableMembers(): { label: string; value: number }[] {
    return this.board?.members.map(m => ({
      label: `${m.firstName} ${m.lastName}`.trim() || m.email,
      value: m.userId
    })) ?? [];
  }

  get displayColumns(): ColumnDto[] {
    return this._displayColumns;
  }

  get displayTotalHours(): number {
    return this._displayColumns.reduce((sum, c) => sum + c.totalHours, 0);
  }

  computeDisplayColumns(): void {
    if (!this.board) { this._displayColumns = []; return; }

    let filterUserId: number | undefined;

    if (typeof this._selectedViewUserId === 'number') {
      filterUserId = this._selectedViewUserId;
    } else if (this._selectedViewUserId === null) {
      const email = this.authService.currentUser()?.email;
      filterUserId = this.board.members.find(m => m.email === email)?.userId;
    }

    this._displayColumns = filterUserId !== undefined
      ? this.board.columns.map(col => {
          const tickets = col.tickets.filter(t => t.assignedToUserId === filterUserId);
          return {
            ...col,
            tickets,
            ticketCount: tickets.length,
            totalHours: tickets.reduce((sum, t) => sum + t.timeSpent, 0)
          };
        })
      : this.board.columns;

    if (this.isGlobalView && this.searchText.trim()) {
      const q = this.searchText.trim().toLowerCase();
      this._displayColumns = this._displayColumns.map(col => {
        const tickets = col.tickets.filter(t =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          t.assignedToEmail.toLowerCase().includes(q) ||
          t.assignedToName.toLowerCase().includes(q)
        );
        return { ...col, tickets, ticketCount: tickets.length, totalHours: tickets.reduce((sum, t) => sum + t.timeSpent, 0) };
      });
    }
  }

  onDragStarted(): void {
    this.isDragging = true;
  }

  onColumnDrop(event: CdkDragDrop<ColumnDto[]>): void {
    this.isDragging = false;
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.board!.columns, event.previousIndex, event.currentIndex);
    this.computeDisplayColumns();
    const newOrder = this.board!.columns.map(c => c.id);
    this.notifyMutated();
    this.boardService.reorderColumns(this.kanbanId, newOrder).subscribe({
      error: () => this.loadBoard()
    });
  }

  onTicketDrop(event: CdkDragDrop<TicketDto[]>, targetColumn: ColumnDto): void {
    this.isDragging = false;
    this.notifyMutated();

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.recalculateHours();
      const ids = targetColumn.tickets.map(t => t.id);
      this.boardService.reorderTickets(this.kanbanId, targetColumn.id, ids).subscribe({
        error: () => this.loadBoard()
      });
    } else {
      const sourceCol = this.board!.columns.find(c => c.tickets === event.previousContainer.data)!;
      const ticket = event.previousContainer.data[event.previousIndex];
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      ticket.columnId = targetColumn.id;
      this.recalculateHours();

      this.boardService.moveTicket(this.kanbanId, ticket.id, targetColumn.id).subscribe({
        error: () => this.loadBoard()
      });
      const sourceIds = sourceCol.tickets.map(t => t.id);
      this.boardService.reorderTickets(this.kanbanId, sourceCol.id, sourceIds).subscribe({
        error: () => this.loadBoard()
      });
      const targetIds = targetColumn.tickets.map(t => t.id);
      this.boardService.reorderTickets(this.kanbanId, targetColumn.id, targetIds).subscribe({
        error: () => this.loadBoard()
      });
    }
  }

  recalculateHours(): void {
    if (!this.board) return;
    for (const col of this.board.columns) {
      col.totalHours = col.tickets.reduce((sum, t) => sum + t.timeSpent, 0);
      col.ticketCount = col.tickets.length;
    }
    this.board.totalHours = this.board.columns.reduce((sum, c) => sum + c.totalHours, 0);
  }

  addColumn(): void {
    if (!this.newColumnName.trim()) return;
    this.boardService.addColumn(this.kanbanId, this.newColumnName.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (col) => {
          this.notifyMutated();
          this.board!.columns.push(col);
          this.showAddColumnDialog = false;
          this.newColumnName = '';
          this.toast('success', 'Column added');
        },
        error: () => this.toast('error', 'Failed to add column')
      });
  }

  openEditColumn(col: ColumnDto): void {
    this.editingColumn = col;
    this.editColumnName = col.name;
    this.showEditColumnDialog = true;
  }

  saveEditColumn(): void {
    if (!this.editingColumn || !this.editColumnName.trim()) return;
    this.boardService.updateColumn(this.kanbanId, this.editingColumn.id, this.editColumnName.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifyMutated();
          this.editingColumn!.name = this.editColumnName.trim();
          this.showEditColumnDialog = false;
          this.toast('success', 'Column renamed');
        },
        error: () => this.toast('error', 'Failed to rename column')
      });
  }

  deleteColumn(col: ColumnDto): void {
    this.confirmationService.confirm({
      message: `Delete column "${col.name}" and all its tickets?`,
      header: 'Delete Column',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.boardService.deleteColumn(this.kanbanId, col.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.notifyMutated();
              this.board!.columns = this.board!.columns.filter(c => c.id !== col.id);
              this.recalculateHours();
              this.toast('success', 'Column deleted');
            },
            error: () => this.toast('error', 'Failed to delete column')
          });
      }
    });
  }

  openAddTicket(columnId: number): void {
    this.editingTicket = null;
    this.ticketForm = { title: '', description: '', timeSpent: 0, columnId, assignedToUserId: undefined };
    this.showTicketDialog = true;
  }

  openEditTicket(ticket: TicketDto): void {
    this.editingTicket = ticket;
    this.ticketForm = {
      title: ticket.title,
      description: ticket.description ?? '',
      timeSpent: ticket.timeSpent,
      columnId: ticket.columnId,
      assignedToUserId: ticket.assignedToUserId
    };
    this.showTicketDialog = true;
  }

  saveTicket(): void {
    if (!this.ticketForm.title.trim()) return;
    this.savingTicket = true;

    if (this.editingTicket) {
      this.boardService.updateTicket(this.kanbanId, this.editingTicket.id, this.ticketForm)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            const col = this.board!.columns.find(c => c.id === this.editingTicket!.columnId);
            const ticket = col?.tickets.find(t => t.id === this.editingTicket!.id);
            if (ticket) {
              ticket.title = this.ticketForm.title;
              ticket.description = this.ticketForm.description;
              ticket.timeSpent = this.ticketForm.timeSpent;
              if (this.ticketForm.assignedToUserId !== undefined) {
                ticket.assignedToUserId = this.ticketForm.assignedToUserId;
                const member = this.board!.members.find(m => m.userId === this.ticketForm.assignedToUserId);
                ticket.assignedToEmail = member?.email ?? '';
                ticket.assignedToName = (`${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || member?.email) ?? '';
              }
            }
            this.notifyMutated();
            this.computeDisplayColumns();
            this.recalculateHours();
            this.showTicketDialog = false;
            this.savingTicket = false;
            this.toast('success', 'Ticket updated');
          },
          error: () => { this.savingTicket = false; this.toast('error', 'Failed to update ticket'); }
        });
    } else {
      this.boardService.addTicket(this.kanbanId, this.ticketForm)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (ticket) => {
            this.notifyMutated();
            const col = this.board!.columns.find(c => c.id === this.ticketForm.columnId);
            col?.tickets.push(ticket);
            this.recalculateHours();
            this.showTicketDialog = false;
            this.savingTicket = false;
            this.toast('success', 'Ticket created');
          },
          error: () => { this.savingTicket = false; this.toast('error', 'Failed to create ticket'); }
        });
    }
  }

  deleteTicket(ticket: TicketDto, col: ColumnDto): void {
    this.confirmationService.confirm({
      message: `Delete ticket "${ticket.title}"?`,
      header: 'Delete Ticket',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.boardService.deleteTicket(this.kanbanId, ticket.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.notifyMutated();
              const realCol = this.board!.columns.find(c => c.id === ticket.columnId) ?? col;
              realCol.tickets = realCol.tickets.filter(t => t.id !== ticket.id);
              this.computeDisplayColumns();
              this.recalculateHours();
              this.toast('success', 'Ticket deleted');
            },
            error: () => this.toast('error', 'Failed to delete ticket')
          });
      }
    });
  }

  assignTicket(ticket: TicketDto, userId: number): void {
    const member = this.board!.members.find(m => m.userId === userId);
    this.boardService.updateTicket(this.kanbanId, ticket.id, {
      title: ticket.title,
      description: ticket.description,
      timeSpent: ticket.timeSpent,
      columnId: ticket.columnId,
      assignedToUserId: userId
    }).subscribe({
      next: () => {
        this.notifyMutated();
        ticket.assignedToUserId = userId;
        ticket.assignedToEmail = member?.email ?? '';
        ticket.assignedToName = (`${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || member?.email) ?? '';
        this.computeDisplayColumns();
      },
      error: () => this.toast('error', 'Failed to assign ticket')
    });
  }

  inviteMember(): void {
    if (!this.inviteEmail.trim()) return;
    this.inviting = true;
    this.boardService.inviteMember(this.kanbanId, this.inviteEmail.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (member) => {
          this.notifyMutated();
          this.board!.members.push(member);
          this.inviteEmail = '';
          this.inviting = false;
          this.toast('success', 'Member invited');
        },
        error: (err) => {
          this.inviting = false;
          if (err.status === 404) {
            this.toast('error', 'User not found');
          } else if (err.status === 409) {
            this.toast('error', 'User is already a member');
          } else {
            this.toast('error', 'Failed to invite member');
          }
        }
      });
  }

  updateMemberRole(member: MemberDto, role: string): void {
    this.boardService.updateMemberRole(this.kanbanId, member.userId, role)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifyMutated();
          member.role = role;
          this.toast('success', 'Role updated');
        },
        error: () => this.toast('error', 'Failed to update role')
      });
  }

  removeMember(member: MemberDto): void {
    this.confirmationService.confirm({
      message: `Remove ${member.firstName} ${member.lastName} from this board?`,
      header: 'Remove Member',
      icon: 'pi pi-user-minus',
      acceptLabel: 'Remove',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.boardService.removeMember(this.kanbanId, member.userId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.notifyMutated();
              this.board!.members = this.board!.members.filter(m => m.userId !== member.userId);
              this.toast('success', 'Member removed');
            },
            error: () => this.toast('error', 'Failed to remove member')
          });
      }
    });
  }

  clearSearch(): void {
    this.searchText = '';
    this.computeDisplayColumns();
  }

  openHistory(ticket: TicketDto): void {
    this.historyTicket = ticket;
    this.ticketHistory = [];
    this.showHistoryDialog = true;
    this.historyLoading = true;
    this.boardService.getTicketHistory(this.kanbanId, ticket.id).subscribe({
      next: (h) => { this.ticketHistory = h; this.historyLoading = false; },
      error: () => { this.historyLoading = false; }
    });
  }

  toast(severity: string, detail: string): void {
    this.messageService.add({ severity, summary: severity === 'success' ? 'Success' : 'Error', detail });
  }
}
