import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KanbanService } from '../../core/services/kanban.service';
import { AuthService } from '../../core/services/auth.service';
import { KanbanDto } from '../../core/models/kanban.models';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  kanbans: KanbanDto[] = [];
  loading = true;
  showCreateDialog = false;
  newKanbanName = '';
  creating = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private kanbanService: KanbanService,
    public authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.loadKanbans();
  }

  loadKanbans(): void {
    this.loading = true;
    this.kanbanService.getMyKanbans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.kanbans = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load boards.'
          });
        }
      });
  }

  openCreateDialog(): void {
    this.newKanbanName = '';
    this.showCreateDialog = true;
  }

  createKanban(): void {
    if (!this.newKanbanName.trim()) return;
    this.creating = true;

    this.kanbanService.createKanban({ name: this.newKanbanName.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kanban) => {
          this.kanbans.push(kanban);
          this.showCreateDialog = false;
          this.creating = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Created',
            detail: `"${kanban.name}" board created.`
          });
        },
        error: () => {
          this.creating = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create board.'
          });
        }
      });
  }

  deleteKanban(kanban: KanbanDto, e: Event): void {
    e.stopPropagation();
    const isAdmin = kanban.role === 'Admin';

    this.confirmationService.confirm({
      message: isAdmin
        ? `Are you sure you want to permanently delete "${kanban.name}"? This cannot be undone.`
        : `Are you sure you want to leave "${kanban.name}"?`,
      header: isAdmin ? 'Delete Board' : 'Leave Board',
      icon: isAdmin ? 'pi pi-trash' : 'pi pi-sign-out',
      acceptLabel: isAdmin ? 'Delete' : 'Leave',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Cancel',
      accept: () => {
        this.kanbanService.deleteKanban(kanban)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.kanbans = this.kanbans.filter(n => n.id !== kanban.id);
              this.messageService.add({
                severity: 'success',
                summary: isAdmin ? 'Deleted' : 'Left',
                detail: isAdmin
                  ? `"${kanban.name}" has been deleted.`
                  : `You have left "${kanban.name}".`
              });
            },
            error: () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: isAdmin ? 'Failed to delete board.' : 'Failed to leave board.'
              });
            }
          });
      }
    });
  }

  openKanban(id: number): void {
    this.router.navigate(['/kanban', id]);
  }

  logout(): void {
    this.authService.logout();
  }
}
