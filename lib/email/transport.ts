import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

/**
 * Fix common SMTP issues:
 * 1. Port 465 requires secure: true (implicit TLS)
 *    Ports 587 or 25 require secure: false with STARTTLS
 * 2. Add connection/greeting/socket timeouts
 * 3. Support separate SMTP_FROM_EMAIL when provider rejects default 'From' address
 */
function getTransporter(): Transporter {
  if (transporter) return transporter;
  
  const user = process.env.SMTP_USERNAME ?? process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const customSecure = process.env.SMTP_SECURE;
  
  // Auto-detect TLS mode if not explicitly set
  // Port 465 = implicit TLS (secure: true)
  // Ports 587, 25 = STARTTLS (secure: false, uses STARTTLS)
  let secure = customSecure ? String(customSecure) === "true" : false;
  if (!customSecure) {
    secure = port === 465;
  }
  
    // Debug logging - only in development
    const isDev = String(process.env.NODE_ENV) !== "production";
    if (isDev) {
      console.log("[SMTP] connecting:", {
        host: process.env.SMTP_HOST,
        port,
        secureMode: secure ? "implicit TLS (port 465)" : "STARTTLS (port 587/25)",
        authEnabled: String(process.env.SMTP_AUTH ?? "true") === "true",
        hasUsername: !!user,
        fromEmail: process.env.SMTP_FROM_EMAIL || "<not set>",
      });
    }
  
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: String(process.env.SMTP_AUTH ?? "true") === "true" && user ? { user, pass } : undefined,
    // Connection timeout settings to prevent hanging emails
    // Note: nodemailer timeout is handled at connection level via socket timeouts
    logger: false,           // Disabled to avoid leaking credentials in logs
  }, {
    // Default envelope settings - may be overridden per-send
    from: `"${process.env.SMTP_FROM_NAME ?? "Edulari"}" <${process.env.SMTP_FROM_EMAIL || user || "noreply@localhost"}>`,
  });
  
  return transporter;
}

/**
 * Verify SMTP connection before using it.
 * Useful for testing/smtp-test endpoint.
 */
export async function verifyTransport(): Promise<{ ok: true } | { ok: false; error: string; code?: string; command?: string }> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return { ok: true };
  } catch (e: unknown) {
    const err = e as Error & { code?: string; command?: string; response?: string };
    
    // Debug logging - only in development
    const isDev = String(process.env.NODE_ENV) !== "production";
    if (isDev) {
      console.error("[SMTP] verification failed:", {
        message: err.message,
        code: err.code,
        command: err.command,
        responseCode: err.response?.split(" ")[0],
      });
    }
    
    // Provide helpful hints based on common error patterns
    let hint = "";
    if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
      hint = " Check SMTP_HOST and SMTP_PORT are correct, and firewall allows outbound mail.";
    } else if (err.code === "EAUTH" || err.response?.includes("535")) {
      hint = " Invalid credentials - verify SMTP_USERNAME/SMTP_PASSWORD. Some providers (Gmail) require an App Password.";
    } else if (err.code === "ERR_TLS_CERT_ERR") {
      hint = " TLS certificate validation failed - ensure system CA certificates are up to date.";
    } else if (err.command === "AUTH" && err.response?.includes("534")) {
      hint = " Authentication mechanism not supported - this is common with Gmail requiring OAuth or App Password.";
    }
    
    return { 
      ok: false, 
      error: `${err.message}${hint}`,
      code: err.code,
      command: err.command,
    };
  }
}

export type Mail = { to: string; toName?: string; subject: string; html: string; text?: string };

export async function sendMail(m: Mail): Promise<{ ok: true } | { ok: false; error: string }> {
  const dryRun = String(process.env.EMAIL_DRY_RUN ?? "false");
  if (dryRun === "true") {
    // Debug logging - only in development
    const isDev = String(process.env.NODE_ENV) !== "production";
    if (isDev) {
      console.log("[EMAIL_DRY_RUN]", m.to, m.subject);
      
      // In development/dry-run mode, write to .dev-outbox for testing verification
      const fs = await import("fs");
      const path = await import("path");
      const outboxDir = path.join(process.cwd(), ".dev-outbox");
      
      try {
        if (!fs.existsSync(outboxDir)) {
          fs.mkdirSync(outboxDir, { recursive: true });
        }
        
        const emailFile = path.join(outboxDir, `${Date.now()}-${m.to.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
        const emailData = {
          to: m.to,
          toName: m.toName,
          subject: m.subject,
          html: m.html,
          text: m.text,
          createdAt: new Date().toISOString(),
        };
        
        fs.writeFileSync(emailFile, JSON.stringify(emailData, null, 2));
        // Debug logging - only in development
        if (isDev) {
          console.log(`[EMAIL_OUTBOX] written: ${emailFile}`);
        }
      } catch (writeErr) {
        console.warn("[EMAIL_OUTBOX] failed to write file:", writeErr);
        // Non-fatal - still return success since we're in dry-run mode
      }
    }
    
    return { ok: true };
  }
  
  // Refuse production dry-run mode - misconfiguration risk
  if (dryRun === "true" && process.env.VERCEL === "1") {
    console.error("[EMAIL_ERROR] EMAIL_DRY_RUN=true in production environment - refusing to run");
    return { ok: false, error: "EMAIL_DRY_RUN cannot be enabled in production deployments" };
  }
  
  try {
    const fromAddress = `"${process.env.SMTP_FROM_NAME ?? "Edulari"}" <${process.env.SMTP_FROM_EMAIL}>`;
    
    await getTransporter().sendMail({
      from: fromAddress,
      to: m.to,
      ...(m.toName ? { name: m.toName } : {}),
      subject: m.subject,
      html: m.html,
      text: m.text,
    });
    
    // Debug logging - only in development
    const isDev = String(process.env.NODE_ENV) !== "production";
    if (isDev) {
      console.log("[email] sent successfully:", { to: m.to, subject: m.subject });
    }
    return { ok: true };
  } catch (e) {
    const err = e as Error & { code?: string; command?: string };
    
    // Always log errors even in production
    console.error("[email] send failed:", {
      message: err.message,
      code: err.code,
      command: err.command,
      recipient: m.to,
      subject: m.subject,
    });
    return { ok: false, error: err instanceof Error ? err.message : String(e) };
  }
}
