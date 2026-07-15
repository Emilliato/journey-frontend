import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { OfflineAuthService } from '../../../core/offline/offline-auth.service';
import { AuthResponse } from '../../../core/models/auth.models';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { AvatarConfig } from '../../../shared/avatar/avatar-config';

/**
 * One sign-in for both roles: parents use their email, learners use the
 * username their parent chose. The response's role routes each to the
 * right place. With no connection, credentials are verified locally
 * against the record of this device's last successful online login (see
 * OfflineAuthService) — a device that has never signed this account in
 * online still needs connectivity once.
 */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AvatarComponent],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  /** A friendly companion greeting on the sign-in screen (cosmetic). */
  protected readonly heroAvatar: AvatarConfig = {
    skin: '#E8B48A',
    hair: 'curly',
    hairColor: '#3B2417',
    eyes: 'happy',
    accessory: 'glasses',
    outfitColor: '#4338CA',
    themeColor: '#4338CA',
  };

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly offlineAuthService = inject(OfflineAuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    // Not Validators.email — learner usernames are valid identifiers too.
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly usedOfflineLogin = signal(false);

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.usedOfflineLogin.set(false);

    const { identifier, password } = this.form.getRawValue();

    this.authService.login({ email: identifier!, password: password! }).subscribe({
      next: (response) => {
        // Record a locally-verifiable credential so this account can sign
        // back in on this device with no connection.
        void this.offlineAuthService.recordSuccessfulLogin(identifier!, password!, response);

        this.isSubmitting.set(false);
        this.routeByRole(response);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 0) {
          // Network-level failure — the API is unreachable, so fall back
          // to offline verification instead of failing outright.
          void this.tryOffline(identifier!, password!);
          return;
        }

        this.isSubmitting.set(false);
        this.errorMessage.set(
          error.status === 401
            ? 'Incorrect email/username or password.'
            : 'Could not sign in right now. Please try again.',
        );
      },
    });
  }

  private async tryOffline(identifier: string, password: string): Promise<void> {
    const session = await this.offlineAuthService.tryOfflineLogin(identifier, password);

    this.isSubmitting.set(false);

    if (!session) {
      this.errorMessage.set(
        "You're offline and this sign-in can't be verified on this device. " +
          'Check the details, or connect to the internet for a first-time sign-in.',
      );
      return;
    }

    this.usedOfflineLogin.set(true);
    this.authService.adoptSession(session);
    this.routeByRole(session);
  }

  private routeByRole(session: AuthResponse): void {
    if (session.role === 'Learner' && session.learnerId) {
      // Learners land straight in their own JOURNEY chat.
      void this.router.navigate(['/learners', session.learnerId, 'journey']);
    } else {
      // Parents pick (or manage) a child profile.
      void this.router.navigateByUrl('/learners');
    }
  }
}
