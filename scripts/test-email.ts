/**
 * Test SMTP Email Configuration
 * Usage: npm run test:email -- recipient@example.com
 * 
 * This script verifies SMTP connection and sends a test email to confirm
 * your email configuration works correctly. Never exposes passwords or secrets.
 */

import { config } from "@/lib/config";
import { verifyTransport, sendMail } from "@/lib/email/transport";

async function main() {
  const recipient = process.argv[2];
  
  if (!recipient) {
    console.error("Usage: npm run test:email -- recipient@example.com");
    console.error("Example: npm run test:email -- john.doe@gmail.com");
    process.exit(1);
  }
  
  // Validate that we're not running against production with dry-run
  if (config.EMAIL_DRY_RUN === "true" && process.env.VERCEL === "1") {
    console.error("ERROR: EMAIL_DRY_RUN cannot be enabled in production");
    process.exit(1);
  }
  
  // Print REDACTED configuration summary
  console.log("\n========================================");
  console.log("SMTP CONFIGURATION TEST");
  console.log("========================================\n");
  
  console.log("[Config - REDACTED]");
  console.log(`  SMTP_HOST: ${config.SMTP_HOST || "<not set>"}`);
  console.log(`  SMTP_PORT: ${config.SMTP_PORT}`);
  console.log(`  SMTP_SECURE_MODE: ${config.SMTP_SECURE === "true" ? "implicit TLS (465)" : "STARTTLS (587/25)"}`);
  console.log(`  SMTP_AUTH_ENABLED: ${config.SMTP_AUTH === "true" ? "yes" : "no"}`);
  console.log(`  SMTP_USERNAME: ${config.SMTP_USERNAME ? `${config.SMTP_USERNAME.substring(0, 2)}***` : "<not set>"}`);
  console.log(`  SMTP_PASSWORD_SET: ${config.SMTP_PASSWORD ? "yes" : "no"}`);
  console.log(`  SMTP_FROM_EMAIL: ${config.SMTP_FROM_EMAIL || "<not set>"}`);
  console.log(`  SMTP_FROM_NAME: "${config.SMTP_FROM_NAME}"`);
  console.log(`  EMAIL_DRY_RUN: ${config.EMAIL_DRY_RUN}`);
  console.log();
  
  // Step 1: Verify transporter
  console.log("Step 1: Verifying SMTP connection...");
  const verifyResult = await verifyTransport();
  
  if (!verifyResult.ok) {
    console.error("\n[ERROR] SMTP verification failed:");
    console.error(`  Error: ${verifyResult.error}`);
    
    if (verifyResult.code === "ECONNREFUSED") {
      console.error("\nLikely causes:");
      console.error("  - SMTP_HOST is unreachable (check firewall/network)");
      console.error("  - SMTP_PORT is incorrect or blocked");
      console.error("  - SMTP service is not running on the host");
    } else if (verifyResult.code === "ETIMEDOUT") {
      console.error("\nLikely causes:");
      console.error("  - Network timeout to SMTP server");
      console.error("  - Firewall blocking outbound mail port");
      console.error("  - Invalid SMTP_HOST address");
    } else if (verifyResult.code === "EAUTH" || verifyResult.command === "AUTH") {
      console.error("\nLikely causes:");
      console.error("  - Invalid SMTP_USERNAME or SMTP_PASSWORD");
      console.error("  - Some providers (Gmail) require an App Password, not your account password");
      console.error("  - Two-factor authentication may be enabled");
    } else if (verifyResult.code === "ERR_TLS_CERT_ERR") {
      console.error("\nLikely causes:");
      console.error("  - Server uses self-signed certificate");
      console.error("  - System CA certificates are outdated");
      console.error("  - MITM proxy intercepting connections");
    }
    
    process.exit(1);
  }
  
  console.log("  ✓ SMTP connection verified successfully\n");
  
  // Step 2: Send test email
  const testSubject = `[Edulari Test] ${new Date().toISOString()}`;
  const testHtml = `
    <h1>Email Configuration Test</h1>
    <p>This is a test email from Edulari.</p>
    <p>If you receive this email, your SMTP configuration is working correctly.</p>
    <hr/>
    <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
    <p><strong>To:</strong> ${recipient}</p>
    <p><strong>From:</strong> ${config.SMTP_FROM_EMAIL}</p>
  `;
  
  console.log("Step 2: Sending test email...");
  console.log(`  To: ${recipient}`);
  console.log(`  Subject: ${testSubject}`);
  console.log(`  Dry-run mode: ${config.EMAIL_DRY_RUN === "true" ? "YES (email logged only)" : "NO (will be sent)"}`);
  console.log();
  
  if (config.EMAIL_DRY_RUN === "true") {
    console.log("[Dry-run mode] Email would have been sent:");
    console.log(`  To: ${recipient}`);
    console.log(`  Subject: ${testSubject}`);
    console.log(`  HTML length: ${testHtml.length} bytes`);
  } else {
    const sendResult = await sendMail({
      to: recipient,
      subject: testSubject,
      html: testHtml,
    });
    
    if (!sendResult.ok) {
      console.error("\n[ERROR] Email send failed:");
      console.error(`  Error: ${sendResult.error}`);
      
      // Additional hints for common errors
      if (sendResult.error.includes("535") || sendResult.error.includes("authentication")) {
        console.error("\nLikely causes:");
        console.error("  - SMTP credentials are rejected by the server");
        console.error("  - Gmail requires an App Password (enable 2FA + generate app-specific password)");
        console.error("  - Zoho/Brevo may require OAuth instead of password auth");
      } else if (sendResult.error.includes("534") || sendResult.error.includes("SASL")) {
        console.error("\nLikely causes:");
        console.error("  - Provider doesn't accept basic username/password auth");
        console.error("  - Try Gmail with App Password or switch to OAuth if available");
      }
      
      process.exit(1);
    }
    
    console.log("  ✓ Email sent successfully!");
    console.log(`  Server response: OK`);
  }
  
  console.log("\n========================================");
  console.log("✓ TEST COMPLETE - SMTP WORKING");
  console.log("========================================\n");
  console.log("Next steps:");
  console.log("  - Check your inbox for the test email");
  console.log("  - If you didn't receive it, check spam folder");
  console.log("  - Verify the sender address matches expected value");
  console.log("\nIf tests fail:");
  console.log("  - Ensure EMAIL_DRY_RUN=false in .env.local (unless testing dry-run)");
  console.log("  - Verify SMTP credentials are correct for your provider");
  console.log("  - Check provider documentation for required settings:");
  console.log("    • Gmail: smtp.gmail.com:587, secure=false, use App Password");
  console.log("    • Brevo (Sendinblue): smtp.brevo.com:587, secure=false, use API key as password");
  console.log("    • Zoho: smtp.zoho.com:587, secure=false");
  console.log("    • cPanel/default: localhost:587 or your hosting provider's SMTP");
  console.log();
  
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[FATAL] Unexpected error:");
  console.error(err);
  process.exit(1);
});
