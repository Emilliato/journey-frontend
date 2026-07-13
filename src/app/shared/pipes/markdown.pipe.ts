import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Renders JOURNEY's markdown replies as HTML for the chat bubbles.
 *
 * The model's output is untrusted input: it goes through DOMPurify before
 * bypassSecurityTrustHtml, so the trust call only ever sees sanitized
 * markup. Learner-authored messages stay plain text and never pass
 * through this pipe.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    const html = marked.parse(value, { async: false, gfm: true, breaks: true });
    const clean = DOMPurify.sanitize(html, {
      // Chat bubbles need formatting, not embeds or interactivity.
      FORBID_TAGS: ['img', 'iframe', 'form', 'input', 'button', 'style'],
      FORBID_ATTR: ['style'],
    });

    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}
