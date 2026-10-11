import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/contact.css";
import ContactForm from "./ContactForm";
import { readCsrfToken } from "@/lib/security/csrf";
import { siteUrl } from "@/lib/format";
export const metadata: Metadata = pageMetadata({
  title: "Contact Us - Edulari",
  description: "Get in touch with the Edulari team. Send us a message and we'll get back to you within one business day.",
  path: "/contact",
  keywords: "contact edulari, support, customer service, get in touch",
});

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const success = sp.success === "1";
  const ticketRef = sp.ref ?? "";
  const prefill = { name: sp.name ?? "", email: sp.email ?? "" };
  const csrfToken = await readCsrfToken();

  // Ported from contact.php: a ContactPage entity for the support channel.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Us — Edulari",
    url: siteUrl("/contact"),
    description: "Have a question or feedback? Get in touch with the Edulari team.",
  };

  return (
    <main className="ct-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="ct-hero">
        <div className="ct-hero-inner">
          <span className="ct-hero-badge">Contact</span>
          <h1 className="ct-hero-title">We&apos;d love to hear from you</h1>
          <p className="ct-hero-sub">Questions, feedback, or a partnership idea? Send us a message.</p>
        </div>
      </section>

      <div className="ct-wrap">
        <section className="ct-form-card">
          {success ? (
            <div className="ct-success">
              <h2>Thanks for reaching out!</h2>
              <p>Your ticket reference is <strong>{ticketRef}</strong>. Track its status any time with your reference and email.</p>
              <a href={`/track-contact?ref=${encodeURIComponent(ticketRef)}`} className="ct-btn ct-btn--primary">Track My Ticket</a>
            </div>
          ) : (
            <ContactForm prefill={prefill} csrfToken={csrfToken} />
          )}
        </section>

        <aside className="ct-side">
          <div className="ct-info-card">
            <h3>Email Support</h3>
            <p>Reply within 24 hours.</p>
            <a href="mailto:support@edulari-test.vercel.app" className="ct-info-link">support@edulari-test.vercel.app</a>
          </div>
          <div className="ct-info-card">
            <h3>Report a Bug</h3>
            <p>Spotted a technical issue?</p>
            <a href="/report-bug" className="ct-info-link">Report a Bug</a>
          </div>
          <div className="ct-info-card">
            <h3>Help Center</h3>
            <p>Answers to common questions.</p>
            <a href="/help-center" className="ct-info-link">Visit Help Center</a>
          </div>
        </aside>
      </div>
    </main>
  );
}
