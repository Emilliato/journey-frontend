import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarConfig, AvatarState, DEFAULT_AVATAR } from './avatar-config';

/**
 * Layered SVG avatar. Expression states are pure CSS class swaps (see the
 * lb-avatar rules in styles.scss) — no JS animation, no canvas, keeping the
 * GPU free for the on-device model:
 * - idle: gentle breathing + blink loop
 * - thinking: subtle bob (JOURNEY is generating)
 * - celebrating: bounce (confetti is a sibling, see ConfettiComponent)
 * - sleepy: droopy eyes, slower breath (device offline)
 */
@Component({
  selector: 'lb-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="lb-avatar lb-avatar--{{ state() }}"
      [style.width.px]="size()"
      [style.height.px]="size()"
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" [attr.width]="size()" [attr.height]="size()">
        <!-- Halo backdrop -->
        <circle cx="100" cy="100" r="92" [attr.fill]="config().outfitColor" opacity="0.08" />

        <g class="lb-avatar__body">
          <!-- Body -->
          <path d="M50 190 Q100 130 150 190 Z" [attr.fill]="config().outfitColor" />
          <!-- Neck -->
          <rect x="88" y="118" width="24" height="18" rx="6" [attr.fill]="config().skin" />
          <!-- Head -->
          <ellipse cx="100" cy="92" rx="42" ry="46" [attr.fill]="config().skin" />

          <!-- Hair -->
          @switch (config().hair) {
            @case ('short') {
              <path
                d="M58 78 Q60 46 100 44 Q140 46 142 78 Q126 62 100 62 Q74 62 58 78 Z"
                [attr.fill]="config().hairColor"
              />
            }
            @case ('long') {
              <path
                d="M56 100 Q52 44 100 42 Q148 44 144 100 Q140 66 100 62 Q60 66 56 100 Z"
                [attr.fill]="config().hairColor"
              />
              <path
                d="M56 100 Q52 150 68 168 L78 168 Q66 140 68 108 Z"
                [attr.fill]="config().hairColor"
              />
              <path
                d="M144 100 Q148 150 132 168 L122 168 Q134 140 132 108 Z"
                [attr.fill]="config().hairColor"
              />
            }
            @default {
              <g [attr.fill]="config().hairColor">
                <circle cx="70" cy="60" r="14" />
                <circle cx="86" cy="50" r="14" />
                <circle cx="104" cy="46" r="14" />
                <circle cx="122" cy="52" r="14" />
                <circle cx="136" cy="64" r="14" />
                <circle cx="60" cy="76" r="12" />
                <circle cx="142" cy="80" r="12" />
              </g>
            }
          }

          <!-- Eyes -->
          @switch (config().eyes) {
            @case ('sparkle') {
              <g class="lb-avatar__eyes">
                <circle cx="82" cy="90" r="5" fill="#1F1B2E" />
                <circle cx="118" cy="90" r="5" fill="#1F1B2E" />
                <circle cx="84" cy="88" r="1.5" fill="#fff" />
                <circle cx="120" cy="88" r="1.5" fill="#fff" />
              </g>
            }
            @case ('focused') {
              <g class="lb-avatar__eyes">
                <rect x="76" y="88" width="12" height="4" rx="2" fill="#1F1B2E" />
                <rect x="112" y="88" width="12" height="4" rx="2" fill="#1F1B2E" />
              </g>
            }
            @default {
              <g class="lb-avatar__eyes">
                <path
                  d="M76 92 Q82 86 88 92"
                  stroke="#1F1B2E"
                  stroke-width="3"
                  fill="none"
                  stroke-linecap="round"
                />
                <path
                  d="M112 92 Q118 86 124 92"
                  stroke="#1F1B2E"
                  stroke-width="3"
                  fill="none"
                  stroke-linecap="round"
                />
              </g>
            }
          }

          <!-- Blush -->
          <circle cx="72" cy="102" r="6" fill="#FB7185" opacity="0.35" />
          <circle cx="128" cy="102" r="6" fill="#FB7185" opacity="0.35" />

          <!-- Mouth: smile normally, small "zzz" line when sleepy -->
          @if (state() === 'sleepy') {
            <path
              class="lb-avatar__mouth"
              d="M88 118 Q100 114 112 118"
              stroke="#1F1B2E"
              stroke-width="3"
              stroke-linecap="round"
              fill="none"
            />
          } @else {
            <path
              class="lb-avatar__mouth"
              d="M86 112 Q100 124 114 112"
              stroke="#1F1B2E"
              stroke-width="3"
              stroke-linecap="round"
              fill="none"
            />
          }

          <!-- Accessory -->
          @switch (config().accessory) {
            @case ('glasses') {
              <g stroke="#1F1B2E" stroke-width="2.5" fill="none">
                <circle cx="82" cy="92" r="10" />
                <circle cx="118" cy="92" r="10" />
                <path d="M92 92 L108 92" />
              </g>
            }
            @case ('headphones') {
              <g>
                <path
                  d="M56 88 Q56 50 100 50 Q144 50 144 88"
                  stroke="#1F1B2E"
                  stroke-width="4"
                  fill="none"
                />
                <rect x="48" y="86" width="14" height="24" rx="6" fill="#4338CA" />
                <rect x="138" y="86" width="14" height="24" rx="6" fill="#4338CA" />
              </g>
            }
            @case ('cap') {
              <g>
                <path d="M56 74 Q60 44 100 44 Q140 44 144 74 Z" fill="#4338CA" />
                <path d="M56 74 L172 78 L144 74 Z" fill="#312E81" />
                <circle cx="100" cy="52" r="4" fill="#F59E0B" />
              </g>
            }
          }
        </g>
      </svg>
    </div>
  `,
})
export class AvatarComponent {
  readonly config = input<AvatarConfig>(DEFAULT_AVATAR);
  readonly state = input<AvatarState>('idle');
  readonly size = input(160);
}
