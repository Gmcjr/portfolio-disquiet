// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createContactForm } from './createContactForm';

function mountForm(): HTMLElement {
  document.body.innerHTML = `
    <div id="root">
      <form>
        <input name="name" />
        <p data-error-for="name"></p>
        <input name="email" />
        <p data-error-for="email"></p>
        <textarea name="message"></textarea>
        <p data-error-for="message"></p>
        <input name="_gotcha" />
        <button type="submit">Send</button>
      </form>
      <div data-form-error></div>
      <div data-status role="status"></div>
      <div data-error-banner hidden>
        <p data-error-text></p>
        <a data-mailto-link href="mailto:hello@disquiet.dev">Email me</a>
      </div>
    </div>
  `;
  return document.getElementById('root')!;
}

function fillValidForm(root: HTMLElement): void {
  const name = root.querySelector<HTMLInputElement>('[name="name"]')!;
  const email = root.querySelector<HTMLInputElement>('[name="email"]')!;
  const message = root.querySelector<HTMLTextAreaElement>('[name="message"]')!;
  name.value = 'Ada Lovelace';
  email.value = 'ada@example.com';
  message.value = 'Hello there';
}

async function submit(root: HTMLElement): Promise<void> {
  const form = root.querySelector('form')!;
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  // Let the async submit handler's microtasks run.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createContactForm', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = mountForm();
  });

  it('throws if the root has no form', () => {
    document.body.innerHTML = '<div id="empty"></div>';
    const empty = document.getElementById('empty')!;
    expect(() => createContactForm(empty, { now: () => 0, fetch })).toThrow();
  });

  it('shows a success message and hides the form on 200', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    createContactForm(root, {
      now: () => 2000,
      fetch: fakeFetch as typeof fetch,
    });
    fillValidForm(root);
    await submit(root);

    const form = root.querySelector('form')!;
    const status = root.querySelector('[data-status]')!;
    expect(form.hidden).toBe(true);
    expect(status.textContent).toContain('Thanks');
  });

  it('shows a fake success on honeypot fill, same as a real success', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    createContactForm(root, {
      now: () => 2000,
      fetch: fakeFetch as typeof fetch,
    });
    fillValidForm(root);
    root.querySelector<HTMLInputElement>('[name="_gotcha"]')!.value =
      'i-am-a-bot';
    await submit(root);

    const status = root.querySelector('[data-status]')!;
    expect(status.textContent).toContain('Thanks');
  });

  it('shows field errors from a 422 validation-failed response', async () => {
    const problem = {
      type: 'https://disquiet.dev/problems/validation-failed',
      title: 'Validation failed',
      status: 422,
      detail: 'One or more fields are invalid.',
      errors: [{ field: 'email', code: 'invalid_string' }],
    };
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(problem), { status: 422 }),
      );
    createContactForm(root, {
      now: () => 2000,
      fetch: fakeFetch as typeof fetch,
    });
    fillValidForm(root);
    await submit(root);

    const emailError = root.querySelector('[data-error-for="email"]')!;
    expect(emailError.textContent).not.toBe('');
  });

  it('shows the too-fast message without touching field errors', async () => {
    const problem = {
      type: 'https://disquiet.dev/problems/submitted-too-fast',
      title: 'That was quick — please try again',
      status: 422,
      detail: 'The form was submitted unusually fast. Please try again.',
    };
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(problem), { status: 422 }),
      );
    createContactForm(root, {
      now: () => 500,
      fetch: fakeFetch as typeof fetch,
    });
    fillValidForm(root);
    await submit(root);

    const formError = root.querySelector('[data-form-error]')!;
    expect(formError.textContent).toContain('quick');
  });

  it('shows the error banner, emphasized, on a 503', async () => {
    const problem = {
      type: 'https://disquiet.dev/problems/email-service-unavailable',
      title: 'The email service is temporarily unavailable',
      status: 503,
      detail: 'Try again shortly, or email me directly.',
    };
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(problem), { status: 503 }),
      );
    createContactForm(root, {
      now: () => 2000,
      fetch: fakeFetch as typeof fetch,
    });
    fillValidForm(root);
    await submit(root);

    const banner = root.querySelector<HTMLElement>('[data-error-banner]')!;
    const mailtoLink = root.querySelector('[data-mailto-link]')!;
    expect(banner.hidden).toBe(false);
    expect(mailtoLink.classList.contains('is-emphasized')).toBe(true);
  });

  it('clears a field error once the visitor edits that field again', async () => {
    const problem = {
      type: 'https://disquiet.dev/problems/validation-failed',
      title: 'Validation failed',
      status: 422,
      detail: 'One or more fields are invalid.',
      errors: [{ field: 'email', code: 'invalid_string' }],
    };
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(problem), { status: 422 }),
      );
    createContactForm(root, {
      now: () => 2000,
      fetch: fakeFetch as typeof fetch,
    });
    fillValidForm(root);
    await submit(root);

    const emailInput = root.querySelector<HTMLInputElement>('[name="email"]')!;
    const emailError = root.querySelector('[data-error-for="email"]')!;
    expect(emailError.textContent).not.toBe('');

    emailInput.value = 'ada@fixed.example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(emailError.textContent).toBe('');
  });

  it('disables the submit button while a request is in flight', () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fakeFetch = vi.fn().mockReturnValue(pendingFetch);
    createContactForm(root, {
      now: () => 2000,
      fetch: fakeFetch as typeof fetch,
    });
    fillValidForm(root);

    const form = root.querySelector('form')!;
    const submitButton = root.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;
    form.dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true }),
    );

    expect(submitButton.disabled).toBe(true);
    resolveFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });
});
