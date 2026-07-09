import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LearnerService } from '../../../core/services/learner.service';
import { LearnerResponse } from '../../../core/models/learner.models';

@Component({
  selector: 'app-learners-page',
  imports: [RouterLink],
  templateUrl: './learners-page.html',
  styleUrl: './learners-page.scss',
})
export class LearnersPage implements OnInit {
  readonly learners = signal<LearnerResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly learnerService: LearnerService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.learnerService.listLearners().subscribe({
      next: (learners) => {
        this.learners.set(learners);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load your children right now.');
        this.isLoading.set(false);
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
