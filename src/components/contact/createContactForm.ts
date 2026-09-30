// Wires the reducer in reducer.ts to a real DOM form. This is the only file
// in the contact form that touches document, fetch, or timers. Everything
// else about the form's logic lives in the reducer and can be tested
// without a browser.
//
// Expected markup inside the root element, set by contact/index.astro:
//   <form>
//     <input name="name">      <p data-error-for="name"></p>
//     <input name="email">     <p data-error-for="email"></p>
//     <textarea name="message"></textarea>  <p data-error-for="message"></p>
//     <input name="_gotcha">   (hidden honeypot field)
//     <button type="submit">
//   </form>
//   <div data-form-error></div>     (the "that was quick" message)
//   <div data-status role="status"></div>   (the success message)
//   <div data-error-banner></div>   (a send failure, plus a mailto link)
//   <a data-mailto-link></a>        (inside the error banner)
//   <div data-error-summary>        (shown on a failed field validation)
//     <ul data-error-summary-list></ul>
//   </div>
//
// The page must still work with no JavaScript at all. This script only
// upgrades a form that already renders; it does not create the form.

import { contactSchema } from '../../lib/contact-schema';
import {
  contactFormReducer,
  initialState,
  type ContactFormState,
  type FieldErrors,
} from './reducer';

export interface ContactFormDeps {
  now: () => number;
  fetch: typeof fetch;
}

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: { field: string; code: string }[];
}

const FIELD_NAMES = ['name', 'email', 'message'] as const;
type FieldName = (typeof FIELD_NAMES)[number];

const FIELD_LABELS: Record<FieldName, string> = {
  name: 'Name',
  email: 'Email',
  message: 'Message',
};

function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

export function createContactForm(
  root: HTMLElement,
  deps: ContactFormDeps,
): void {
  const form = root.querySelector('form');
  if (!form) {
    throw new Error(
      'createContactForm: no <form> found inside the root element.',
    );
  }

  const nameInput = form.querySelector<HTMLInputElement>('[name="name"]');
  const emailInput = form.querySelector<HTMLInputElement>('[name="email"]');
  const messageInput =
    form.querySelector<HTMLTextAreaElement>('[name="message"]');
  const gotchaInput = form.querySelector<HTMLInputElement>('[name="_gotcha"]');
  const submitButton = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );

  if (
    !nameInput ||
    !emailInput ||
    !messageInput ||
    !gotchaInput ||
    !submitButton
  ) {
    throw new Error(
      'createContactForm: a required field is missing from the markup.',
    );
  }

  const formErrorEl = root.querySelector<HTMLElement>('[data-form-error]');
  const statusEl = root.querySelector<HTMLElement>('[data-status]');
  const errorBannerEl = root.querySelector<HTMLElement>('[data-error-banner]');
  const mailtoLinkEl =
    root.querySelector<HTMLAnchorElement>('[data-mailto-link]');
  const errorSummaryEl = root.querySelector<HTMLElement>(
    '[data-error-summary]',
  );
  const errorSummaryListEl = root.querySelector<HTMLElement>(
    '[data-error-summary-list]',
  );

  const fieldInputs: Record<FieldName, HTMLInputElement | HTMLTextAreaElement> =
    {
      name: nameInput,
      email: emailInput,
      message: messageInput,
    };

  const fieldErrorEls: Partial<Record<FieldName, HTMLElement>> = {};
  for (const fieldName of FIELD_NAMES) {
    const el = root.querySelector<HTMLElement>(
      `[data-error-for="${fieldName}"]`,
    );
    if (el) fieldErrorEls[fieldName] = el;
  }

  let state: ContactFormState = initialState;
  const mountedAt = deps.now();

  function render(): void {
    const isSubmitting = state.status === 'submitting';
    submitButton!.disabled = isSubmitting;
    submitButton!.setAttribute('aria-busy', String(isSubmitting));

    const fieldErrors: FieldErrors =
      state.status === 'idle' ? state.fieldErrors : {};
    for (const fieldName of FIELD_NAMES) {
      const input = fieldInputs[fieldName];
      const errorEl = fieldErrorEls[fieldName];
      const message = fieldErrors[fieldName];
      input.setAttribute('aria-invalid', String(Boolean(message)));
      if (errorEl) errorEl.textContent = message ?? '';
    }

    if (errorSummaryEl && errorSummaryListEl) {
      const erroringFields = FIELD_NAMES.filter((name) => fieldErrors[name]);
      errorSummaryEl.hidden = erroringFields.length === 0;
      while (errorSummaryListEl.firstChild) {
        errorSummaryListEl.removeChild(errorSummaryListEl.firstChild);
      }
      for (const fieldName of erroringFields) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.errorSummaryLink = fieldName;
        button.textContent = `${FIELD_LABELS[fieldName]}: ${fieldErrors[fieldName]}`;
        item.appendChild(button);
        errorSummaryListEl.appendChild(item);
      }
    }

    if (formErrorEl) {
      formErrorEl.textContent =
        state.status === 'idle' ? (state.formError ?? '') : '';
    }

    if (statusEl) {
      statusEl.textContent =
        state.status === 'success'
          ? 'Thanks — your message is on its way.'
          : '';
    }

    if (errorBannerEl) {
      const showBanner = state.status === 'error';
      errorBannerEl.hidden = !showBanner;
      if (showBanner && state.status === 'error') {
        errorBannerEl.querySelector('[data-error-text]')!.textContent =
          state.message;
        if (mailtoLinkEl) {
          mailtoLinkEl.classList.toggle(
            'is-emphasized',
            state.mailtoEmphasized,
          );
        }
      }
    }

    if (state.status === 'success') {
      form!.hidden = true;
    }
  }

  function extractFieldErrors(
    issues: { path: PropertyKey[]; message: string }[],
  ): FieldErrors {
    const fieldErrors: FieldErrors = {};
    for (const issue of issues) {
      const first = issue.path[0];
      if (typeof first === 'string' && isFieldName(first)) {
        fieldErrors[first] = issue.message;
      }
    }
    return fieldErrors;
  }

  function focusErrorSummary(): void {
    errorSummaryEl?.focus();
  }

  errorSummaryListEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>(
      '[data-error-summary-link]',
    );
    if (!button) return;
    const fieldName = button.dataset.errorSummaryLink;
    if (fieldName && isFieldName(fieldName)) {
      fieldInputs[fieldName].focus();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSubmit();
  });

  async function handleSubmit(): Promise<void> {
    state = contactFormReducer(state, { type: 'submit' });
    render();

    const payload = {
      name: nameInput!.value,
      email: emailInput!.value,
      message: messageInput!.value,
      _gotcha: gotchaInput!.value,
      elapsedMs: deps.now() - mountedAt,
    };

    // This check mirrors the server's schema for fast feedback only. The
    // server runs the same schema again and is the real authority.
    const parsed = contactSchema.safeParse(payload);
    if (!parsed.success) {
      state = contactFormReducer(state, {
        type: 'validationError',
        fieldErrors: extractFieldErrors(parsed.error.issues),
      });
      render();
      focusErrorSummary();
      return;
    }

    try {
      const response = await deps.fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        state = contactFormReducer(state, { type: 'success' });
        render();
        return;
      }

      const problem = (await response.json()) as ProblemDetails;

      if (problem.type.includes('submitted-too-fast')) {
        state = contactFormReducer(state, { type: 'tooFast' });
      } else if (problem.type.includes('validation-failed') && problem.errors) {
        const fieldErrors: FieldErrors = {};
        for (const err of problem.errors) {
          if (isFieldName(err.field)) {
            fieldErrors[err.field] = 'Check this field and try again.';
          }
        }
        state = contactFormReducer(state, {
          type: 'validationError',
          fieldErrors,
        });
      } else if (response.status === 502 || response.status === 503) {
        state = contactFormReducer(state, {
          type: 'vendorError',
          message: problem.detail,
        });
      } else {
        state = contactFormReducer(state, {
          type: 'genericError',
          message: problem.detail,
        });
      }
    } catch {
      state = contactFormReducer(state, {
        type: 'genericError',
        message:
          'Could not reach the server. Check your connection and try again.',
      });
    }

    render();
    if (state.status === 'idle' && Object.keys(state.fieldErrors).length > 0) {
      focusErrorSummary();
    }
  }

  for (const fieldName of FIELD_NAMES) {
    fieldInputs[fieldName].addEventListener('input', () => {
      const hasSomethingToClear =
        state.status === 'error' ||
        (state.status === 'idle' &&
          (Object.keys(state.fieldErrors).length > 0 || state.formError));
      if (hasSomethingToClear) {
        state = contactFormReducer(state, { type: 'edit' });
        render();
      }
    });
  }

  render();
}
