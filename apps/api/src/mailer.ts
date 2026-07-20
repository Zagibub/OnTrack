export interface MagicLinkEmail {
  to: string;
  url: string;
}

export interface Mailer {
  /** Sends the mail; returns the provider's message id if it has one. Throws on failure. */
  sendMagicLink(email: MagicLinkEmail): Promise<{ providerId: string | null }>;
}

/** Dev mailer: prints the link instead of sending. */
export class ConsoleMailer implements Mailer {
  async sendMagicLink({ to, url }: MagicLinkEmail): Promise<{ providerId: string | null }> {
    console.info(`[mailer] magic link for ${to}: ${url}`);
    return { providerId: null };
  }
}

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendMagicLink({ to, url }: MagicLinkEmail): Promise<{ providerId: string | null }> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject: "Your OnTrack sign-in link",
        text: `Sign in to OnTrack:\n\n${url}\n\nThe link is valid for 15 minutes. If you didn't request it, you can ignore this email.`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { id?: string };
    return { providerId: body.id ?? null };
  }
}
