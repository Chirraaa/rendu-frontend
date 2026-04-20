import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { CommonModule } from '@angular/common';

function passwordStrength(control: AbstractControl): ValidationErrors | null {
  const v: string = control.value ?? '';
  const errors: ValidationErrors = {};
  if (v.length < 8)            errors['minLength'] = true;
  if (!/[A-Z]/.test(v))        errors['uppercase'] = true;
  if (!/[0-9]/.test(v))        errors['number']    = true;
  if (!/[^A-Za-z0-9]/.test(v)) errors['special']   = true;
  return Object.keys(errors).length ? errors : null;
}

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm  = control.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    MessageModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent {
  private readonly REDIRECT_DELAY_MS = 1500;

  registerForm: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      firstName:       ['', [Validators.required, Validators.maxLength(50)]],
      lastName:        ['', [Validators.required, Validators.maxLength(50)]],
      email:           ['', [Validators.required, Validators.email]],
      password:        ['', [Validators.required, passwordStrength]],
      confirmPassword: ['',  Validators.required]
    }, { validators: passwordsMatch });
  }

  get pw() { return this.registerForm.get('password'); }

  passwordFocused = false;

  private get pwValue(): string { return this.pw?.value ?? ''; }
  get reqMinLength(): boolean { return this.pwValue.length >= 8; }
  get reqUppercase(): boolean { return /[A-Z]/.test(this.pwValue); }
  get reqNumber():    boolean { return /[0-9]/.test(this.pwValue); }
  get reqSpecial():   boolean { return /[^A-Za-z0-9]/.test(this.pwValue); }
  get showRules():    boolean {
    return this.passwordFocused || (!!this.pw?.touched && !!this.pw?.invalid);
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const firstName = this.registerForm.value.firstName.trim();
    const lastName  = this.registerForm.value.lastName.trim();
    const email     = this.registerForm.value.email.trim().toLowerCase();
    const password  = this.registerForm.value.password;

    this.authService.register({ firstName, lastName, email, password }).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Account created! Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), this.REDIRECT_DELAY_MS);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.status === 409
          ? 'This email is already in use.'
          : 'Registration failed. Please try again.';
      }
    });
  }
}
