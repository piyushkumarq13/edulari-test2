import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/help-center.css";
import HelpCenterClient from "./HelpCenterClient";

export const metadata: Metadata = pageMetadata({
  title: "Help Center - Edulari",
  description: "Get answers to common questions about courses, enrollment, payments, certificates, and your Edulari account.",
  path: "/help-center",
  keywords: "help center, support, faq, edulari help, common questions",
});

const faqs = [
  { cat: "getting-started", q: "How do I set up my student profile?", a: "Go to My Profile and fill in your bio, interests, and learning goals. A complete profile unlocks personalised course recommendations on your dashboard. It takes about 2 minutes via the onboarding wizard." },
  { cat: "getting-started", q: "How do I change my display name or photo?", a: "Head to Profile Settings, click the avatar to upload a new photo, and update your display name in the Personal Info tab. Changes save instantly." },
  { cat: "courses", q: "How do I enroll in a course?", a: "Browse the course catalogue, open a course page and click Enroll Now. Free courses enroll instantly. For paid courses, you'll be guided through checkout. After enrolling the course appears in My Courses." },
  { cat: "courses", q: "Can I access course videos offline?", a: "Currently, all video content streams online through the Learn player. Offline download is not supported at this time. We recommend a stable internet connection for the best experience." },
  { cat: "courses", q: "Why is my course progress not saving?", a: "Progress is saved when you mark a lesson complete using the Mark as Complete button. If progress still doesn't save, try refreshing the page or clearing your browser cache. If the issue persists, contact support." },
  { cat: "quizzes", q: "How many times can I attempt a quiz?", a: "The number of allowed attempts is set by the instructor and shown on the quiz page before you start. Once you've used all attempts, you won't be able to retake it. Your highest score across all attempts is recorded." },
  { cat: "quizzes", q: "What happens if I fail a quiz?", a: "If you fail, you can retry if attempts remain. Review the lesson material before retrying. Some courses require a passing score to unlock the next section. Check the quiz instructions for the passing threshold." },
  { cat: "certificates", q: "When do I receive my certificate?", a: "Your certificate is automatically generated as soon as you complete 100% of a course. You'll find it in My Certificates. You can download it as a PDF or share a unique link." },
  { cat: "certificates", q: "Can I add my certificate to LinkedIn?", a: "Yes! On the certificate page click Share on LinkedIn. It auto-fills your course name, credential ID and issue date so the certificate appears in your LinkedIn profile's Licences and Certifications section." },
  { cat: "billing", q: "How do I request a refund?", a: "We offer a 7-day refund on most paid courses. To request one, contact support within 7 days of purchase with your order details. Refunds are not available after you've completed more than 30% of the course." },
  { cat: "billing", q: "What payment methods are accepted?", a: "We accept all major credit/debit cards (Visa, Mastercard, RuPay), UPI, net banking, and popular wallets. All transactions are secured and encrypted." },
  { cat: "account", q: "How do I reset my password?", a: "On the login page click Forgot password?, enter your registered email and we'll send a reset link. The link is valid for 30 minutes. You can also change your password from Profile to Security when logged in." },
  { cat: "account", q: "How do I turn off email notifications?", a: "Go to Profile to Notifications and toggle off the types of emails you no longer want to receive. You can manage marketing emails, course updates, and quiz reminders separately." },
  { cat: "account", q: "How do I delete my account?", a: "Account deletion is permanent and removes all your courses, progress and certificates. To proceed, go to Profile to Security to Delete Account or contact support. We recommend downloading your certificates before deleting." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HelpCenterPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HelpCenterClient faqs={faqs} />
    </>
  );
}
