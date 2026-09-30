import { describe, expect, it } from 'vitest';
import {
  contactFormReducer,
  initialState,
  type ContactFormState,
} from './reducer';

describe('contactFormReducer', () => {
  it('starts idle with no errors', () => {
    expect(initialState).toEqual({ status: 'idle', fieldErrors: {} });
  });

  it('moves to submitting on submit', () => {
    const next = contactFormReducer(initialState, { type: 'submit' });
    expect(next).toEqual({ status: 'submitting' });
  });

  it('returns to idle with field errors on validationError', () => {
    const submitting: ContactFormState = { status: 'submitting' };
    const next = contactFormReducer(submitting, {
      type: 'validationError',
      fieldErrors: { email: 'Enter a valid email address.' },
    });
    expect(next).toEqual({
      status: 'idle',
      fieldErrors: { email: 'Enter a valid email address.' },
    });
  });

  it('stays idle and editable on tooFast, with a form-level message', () => {
    const submitting: ContactFormState = { status: 'submitting' };
    const next = contactFormReducer(submitting, { type: 'tooFast' });
    expect(next).toEqual({
      status: 'idle',
      fieldErrors: {},
      formError: 'That was quick — please try again.',
    });
  });

  it('goes to success on success', () => {
    const submitting: ContactFormState = { status: 'submitting' };
    const next = contactFormReducer(submitting, { type: 'success' });
    expect(next).toEqual({ status: 'success' });
  });

  it('marks a vendor error as mailto-emphasized', () => {
    const submitting: ContactFormState = { status: 'submitting' };
    const next = contactFormReducer(submitting, {
      type: 'vendorError',
      message: 'The email service is temporarily unavailable.',
    });
    expect(next).toEqual({
      status: 'error',
      message: 'The email service is temporarily unavailable.',
      mailtoEmphasized: true,
    });
  });

  it('does not emphasize mailto for a generic error', () => {
    const submitting: ContactFormState = { status: 'submitting' };
    const next = contactFormReducer(submitting, {
      type: 'genericError',
      message: 'Something went wrong.',
    });
    expect(next).toEqual({
      status: 'error',
      message: 'Something went wrong.',
      mailtoEmphasized: false,
    });
  });

  it('resets from an error state back to idle on edit', () => {
    const errored: ContactFormState = {
      status: 'error',
      message: 'Something went wrong.',
      mailtoEmphasized: false,
    };
    const next = contactFormReducer(errored, { type: 'edit' });
    expect(next).toEqual({ status: 'idle', fieldErrors: {} });
  });

  it('clears field errors on edit from an idle-with-errors state', () => {
    const idleWithErrors: ContactFormState = {
      status: 'idle',
      fieldErrors: { name: 'Required.' },
    };
    const next = contactFormReducer(idleWithErrors, { type: 'edit' });
    expect(next).toEqual({ status: 'idle', fieldErrors: {} });
  });
});
