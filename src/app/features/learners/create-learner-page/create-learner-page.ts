import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { LearnerService } from '../../../core/services/learner.service';

/**
 * Child profile creation — deliberately online-only, no offline queue (see
 * PLAN.md Phase 2 and CLAUDE.md constraint 1). Connectivity is checked both
 * up front (to disable the form early) and again at submit time, since
 * navigator.onLine can go stale between the two.
 */
@Component({
  selector: 'app-create-learner-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-learner-page.html',
  styleUrl: './create-learner-page.scss',
})
export class CreateLearnerPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly learnerService = inject(LearnerService);
  private readonly connectivityService = inject(ConnectivityService);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    displayName: ['', [Validators.required]],
    // The child's own sign-in (Learner role) — chosen by the parent here.
    // Password length mirrors the server's Identity policy (min 8).
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    consentGranted: [false, [Validators.requiredTrue]],
  });

  readonly isOnline = signal(true);
  readonly isCheckingConnectivity = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly handleOnline = () => this.refreshConnectivity();
  private readonly handleOffline = () => this.isOnline.set(false);

  ngOnInit(): void {
    this.refreshConnectivity();
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.connectivityService.checkOnline().subscribe((online) => {
      this.isOnline.set(online);

      if (!online) {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          'You are offline. Child profile creation requires an internet connection — please reconnect and try again.',
        );
        return;
      }

      const { displayName, username, password, consentGranted } = this.form.getRawValue();

      this.learnerService
        .createLearner({
          displayName: displayName!,
          consentGranted: consentGranted!,
          username: username!,
          password: password!,
        })
        .subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.router.navigateByUrl('/learners');
          },
          error: (error: HttpErrorResponse) => {
            this.isSubmitting.set(false);

            if (error.status === 0) {
              this.isOnline.set(false);
              this.errorMessage.set(
                'Lost connection while saving. Please reconnect and try again — nothing was saved.',
              );
            } else {
              this.errorMessage.set('Could not create the profile right now. Please try again.');
            }
          },
        });
    });
  }

  private refreshConnectivity(): void {
    this.isCheckingConnectivity.set(true);
    this.connectivityService.checkOnline().subscribe((online) => {
      this.isOnline.set(online);
      this.isCheckingConnectivity.set(false);
    });
  }
}
