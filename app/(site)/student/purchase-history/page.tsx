import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import {
  getCourseSlugs,
  getPurchaseHistoryStats,
  getStudentPurchaseHistoryAll,
} from "@/lib/db/commerce";
import { CURRENCY_DISPLAY_SYMBOL } from "@/lib/format";
import PurchaseHistoryClient, { type GroupedPurchase } from "./PurchaseHistoryClient";
import "@/styles/css/student/purchase-history.css";
export type SerializablePurchase = Omit<GroupedPurchase, "group_members">;

export const metadata: Metadata = pageMetadata({
  title: "Purchase History — Edulari",
  description: "Every verified Edulari payment record, with receipts and self-service enrollment recovery.",
  path: "/student/purchase-history",
  noindex: true,
});

const PER_PAGE = 20;

/**
 * Repeated cancelled/failed attempts for the same course set are collapsed into one
 * row (with an "xN attempts" badge), exactly like purchase-history.php.
 */
export function groupPurchases(all: SerializablePurchase[]): GroupedPurchase[] {
  const grouped: GroupedPurchase[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const p of all) {
    const isCollapsible = p.status === "cancelled" || p.status === "failed";

    if (isCollapsible) {
      const courseIds = p.courses.map((c) => Number(c.course_id ?? 0)).sort((a, b) => a - b);
      const key = `${p.status}|${courseIds.join(",")}`;
      const existing = groupIndexByKey.get(key);

      if (existing !== undefined) {
        const target = grouped[existing];
        if (target) {
          target.group_members!.push({
            razorpay_order_id: p.razorpay_order_id,
            created_at: p.created_at,
            status: p.status,
            failure_reason: p.failure_reason,
          });
        }
        continue;
      }

      groupIndexByKey.set(key, grouped.length);
      grouped.push({
        ...p,
        group_members: [
          {
            razorpay_order_id: p.razorpay_order_id,
            created_at: p.created_at,
            status: p.status,
            failure_reason: p.failure_reason,
          },
        ],
      });
    } else {
      grouped.push({ ...p, group_members: null });
    }
  }

  return grouped;
}

export default async function PurchaseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;

  const [allPurchases, stats, csrfToken] = await Promise.all([
    getStudentPurchaseHistoryAll(user.id),
    getPurchaseHistoryStats(user.id),
    readCsrfToken(),
  ]);

  const serializableAll: SerializablePurchase[] = allPurchases.map((p) => ({
    id: p.id,
    razorpay_order_id: p.razorpay_order_id,
    razorpay_payment_id: p.razorpay_payment_id,
    amount_paise: Number(p.amount_paise),
    amount_rupees: (Number(p.amount_paise) / 100).toFixed(2),
    currency: p.currency,
    status: p.status,
    enrolled_count: Number(p.enrolled_count),
    courses: p.courses,
    created_at: new Date(p.created_at).toISOString(),
    failure_reason: p.failure_reason,
  }));

  const grouped = groupPurchases(serializableAll);

  const totalCount = grouped.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const page = Math.min(Math.max(1, Number(sp.page ?? 1) || 1), totalPages);
  const offset = (page - 1) * PER_PAGE;
  const purchases = grouped.slice(offset, offset + PER_PAGE);

  // Pre-fetch slugs for the clickable course links.
  const courseIds = Array.from(new Set(purchases.flatMap((p) => p.courses.map((c) => Number(c.course_id ?? 0)))));
  const slugMap = await getCourseSlugs(courseIds);

  return (
    <PurchaseHistoryClient
      purchases={JSON.parse(JSON.stringify(purchases)) as GroupedPurchase[]}
      slugMap={slugMap}
      stats={{
        totalSpent: Math.round(stats.totalSpent),
        enrolledCount: stats.enrolledCount,
        failedCount: stats.failedCount,
      }}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      csrfToken={csrfToken}
      currencySymbol={CURRENCY_DISPLAY_SYMBOL}
      currencyCode={process.env.CURRENCY_CODE ?? "INR"}
    />
  );
}
