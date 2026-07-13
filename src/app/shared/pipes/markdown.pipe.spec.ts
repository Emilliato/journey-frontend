import { TestBed } from '@angular/core/testing';
import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  function createPipe(): MarkdownPipe {
    return TestBed.runInInjectionContext(() => new MarkdownPipe());
  }

  it('renders markdown formatting to HTML', () => {
    const html = String(createPipe().transform('Here is **bold** and a list:\n\n- one\n- two'));

    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>one</li>');
  });

  it('renders tables', () => {
    const html = String(createPipe().transform('| Part | Name |\n|------|------|\n| Top | Numerator |'));

    expect(html).toContain('<table>');
    expect(html).toContain('<td>Numerator</td>');
  });

  it('strips scripts, event handlers, and images from model output', () => {
    const html = String(
      createPipe().transform('hi <script>alert(1)</script> <img src="x" onerror="alert(1)"> <a href="javascript:alert(1)">x</a>'),
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('returns empty output for empty input', () => {
    expect(String(createPipe().transform(null))).not.toContain('<');
  });
});
