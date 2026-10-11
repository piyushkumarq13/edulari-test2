/** Display constants mirrored from private/config.php. */

export const SITE_NAME = process.env.SITE_NAME ?? "Edulari";

/** private/config.php's ADMIN_EMAIL. */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "support@edulari-test.vercel.app";

/** The signing authority printed on the certificate (generate-certificate.php). */
export const CERTIFICATE_SIGNATORY_NAME = "Mr. Piyush Chaurasiya";
export const CERTIFICATE_SIGNATORY_TITLE = "Founder & CEO, Edulari";