/* =========================================================
   Veda Jyothi Pathashala — site configuration

   Edit this file, commit, and Vercel redeploys. Nothing here is secret:
   it is served to every visitor, so never put an API key or token in it.
   ========================================================= */

window.VJP_CONFIG = {
  /**
   * n8n Production webhook URL for the enquiry form.
   *
   * Paste the URL from the n8n Webhook node ("Production URL", not "Test
   * URL" — the test URL only works while the editor is listening).
   *
   * Leave empty and the form falls back to opening WhatsApp on the
   * visitor's own device, exactly as it did before.
   */
  n8nWebhook: "",

  /** Where enquiries go, in international format, no + or spaces. */
  whatsappNumber: "919032644115",

  /**
   * After n8n accepts the enquiry, also open WhatsApp for the visitor so
   * they can message directly if they want to. The enquiry has already
   * been delivered by then — this is a convenience, not the delivery path.
   */
  openWhatsAppAfterSend: false,
};
