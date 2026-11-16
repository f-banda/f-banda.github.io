/**
 * Contact form configuration.
 *
 * Every value here is a *public* identifier and is safe to commit — the secrets
 * (your reCAPTCHA secret key and your email inbox) live in the EmailJS dashboard,
 * never in this repo.
 *
 * Setup (once):
 *  1. reCAPTCHA — https://www.google.com/recaptcha/admin/create
 *     Type: "Challenge (v2)" -> "I'm not a robot" checkbox.
 *     Domains: f-banda.com, localhost. Copy the SITE key into `recaptchaSiteKey`.
 *  2. EmailJS — https://dashboard.emailjs.com
 *     a. Email Services -> add your mail provider -> copy the Service ID.
 *     b. Email Templates -> new template. Use {{from_name}}, {{reply_to}} and {{message}} in the
 *        body, and set "Reply To" to {{reply_to}}. Copy the Template ID.
 *     c. In that template's Settings tab, enable "reCAPTCHA V2 verification" and
 *        paste the reCAPTCHA SECRET key there (EmailJS verifies every token).
 *     d. Account -> General -> copy the Public Key.
 *     e. Account -> Security -> add f-banda.com to the allowed domains list.
 *
 * Until all four values are filled in, the chat still collects the details but
 * ends by pointing visitors to LinkedIn instead of sending.
 */
export const contactConfig = {
  recaptchaSiteKey: '6Lei0CIuAAAAAC8UYVKvDq4uTMNE9myFLRRAju6E',
  emailjsPublicKey: 'Akw27mN-qR7-2sPaH',
  emailjsServiceId: 'service_93pzf6c',
  emailjsTemplateId: 'template_xppqr6e',
};

export const isContactConfigured = Object.values(contactConfig).every((v) => v.trim().length > 0);
