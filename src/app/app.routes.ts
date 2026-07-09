import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'learners' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register-page/register-page').then((m) => m.RegisterPage),
  },
  {
    path: 'learners',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/learners/learners-page/learners-page').then((m) => m.LearnersPage),
  },
  {
    path: 'learners/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/learners/create-learner-page/create-learner-page').then(
        (m) => m.CreateLearnerPage,
      ),
  },
  { path: '**', redirectTo: 'learners' },
];
