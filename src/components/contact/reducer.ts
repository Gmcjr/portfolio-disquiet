// Pure state machine for the contact form. No DOM, no fetch, no timers
// createContactForm.ts wires this to the page. Kept separate so it can
// be unit-tested directly (see reducer.test.ts) with zero jsdom.

export interface FieldErrors {
  name?: string;
  email?: string;
  message?: string;
}

export type ContactFormState =
  | { status: 'idle'; fieldErrors: FieldErrors; formError?: string }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'error'; message: string; mailtoEmphasized: boolean };

export type ContactFormEvent =
  | { type: 'submit' }
  | { type: 'validationError'; fieldErrors: FieldErrors }
  | { type: 'tooFast' }
  | { type: 'vendorError'; message: string }
  | { type: 'genericError'; message: string }
  | { type: 'success' }
  | { type: 'edit' };

export const initialState: ContactFormState = {
  status: 'idle',
  fieldErrors: {},
};

export function contactFormReducer(
  state: ContactFormState,
  event: ContactFormEvent,
): ContactFormState {
  switch (event.type) {
    case 'submit':
      return { status: 'submitting' };
    case 'validationError':
      return { status: 'idle', fieldErrors: event.fieldErrors };
    case 'tooFast':
      return {
        status: 'idle',
        fieldErrors: {},
        formError: 'That was quick — please try again.',
      };
    case 'vendorError':
      return {
        status: 'error',
        message: event.message,
        mailtoEmphasized: true,
      };
    case 'genericError':
      return {
        status: 'error',
        message: event.message,
        mailtoEmphasized: false,
      };
    case 'success':
      return { status: 'success' };
    case 'edit':
      return { status: 'idle', fieldErrors: {} };
    default:
      return state;
  }
}
