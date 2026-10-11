import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  countAllUsers,
  countUsers,
  getAllUsers,
  getUserStats,
  type AdminUserFilters,
} from "@/lib/db/admin/users";
import { getAvatarUrl } from "@/lib/storage/media-urls";
import { formatMonthDayYear, phpNumber } from "@/lib/format";
import UsersClient, { type PageToken, type UserRowView } from "./UsersClient";
import "@/styles/css/admin/users.css";

export const metadata: Metadata = pageMetadata({
  title: "Users — Admin",
  description: "Manage Edulari users, roles and account status.",
  path: "/admin/users",
  noindex: true,
});

export const dynamic = "force-dynamic";

const LIMIT = 25;
const ROLE_COLORS: Record<string, string> = { admin: "red", instructor: "orange", student: "blue" };

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
}

function buildPageTokens(
  page: number,
  totalPages: number,
  query: URLSearchParams,
): PageToken[] {
  const href = (p: number) => {
    const q = new URLSearchParams(query);
    q.set("page", String(p));
    return `/admin/users?${q.toString()}`;
  };
  const tokens: PageToken[] = [];
  if (page > 1) tokens.push({ kind: "prev", href: href(page - 1) });

  const range = 2;
  const start = Math.max(1, page - range);
  const end = Math.min(totalPages, page + range);

  if (start > 1) {
    tokens.push({ kind: "page", label: "1", href: href(1), active: page === 1 });
    if (start > 2) tokens.push({ kind: "ellipsis" });
  }
  for (let i = start; i <= end; i++) {
    tokens.push({ kind: "page", label: String(i), href: href(i), active: i === page });
  }
  if (end < totalPages) {
    if (end < totalPages - 1) tokens.push({ kind: "ellipsis" });
    tokens.push({ kind: "page", label: String(totalPages), href: href(totalPages), active: page === totalPages });
  }
  if (page < totalPages) tokens.push({ kind: "next", href: href(page + 1) });
  return tokens;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const filters: AdminUserFilters = {};
  if (sp.role) filters.role = sp.role;
  if (sp.search) filters.search = sp.search;
  if (sp.status !== undefined && sp.status !== "") filters.status = Number(sp.status);

  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * LIMIT;

  const [rows, totalFiltered, totalAll, stats, csrfToken] = await Promise.all([
    getAllUsers(filters, LIMIT, offset),
    countUsers(filters),
    countAllUsers(),
    getUserStats(),
    readCsrfToken(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / LIMIT));

  const view: UserRowView[] = rows.map((u) => {
    const isInstructor = u.role === "instructor";
    const count = isInstructor ? u.course_count : u.enrollment_count;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatarUrl: u.profile_image ? getAvatarUrl(u.profile_image) : null,
      initials: initials(u.name),
      roleColor: ROLE_COLORS[u.role] ?? "gray",
      isSelf: u.id === admin.id,
      isActive: u.is_active,
      isBlocked: !u.is_active && u.block_reason === "admin_blocked",
      activityKind: isInstructor ? "instructor" : "student",
      activityLabel: isInstructor
        ? `${count} course${count === 1 ? "" : "s"}`
        : `${count} enrolled`,
      joined: formatMonthDayYear(u.registration_date),
    };
  });

  const query = new URLSearchParams();
  if (sp.role) query.set("role", sp.role);
  if (sp.search) query.set("search", sp.search);
  if (sp.status !== undefined && sp.status !== "") query.set("status", sp.status);

  return (
    <UsersClient
      rows={view}
      totalAll={phpNumber(totalAll)}
      totalFiltered={phpNumber(totalFiltered)}
      stats={{
        students: phpNumber(stats.students),
        instructors: phpNumber(stats.instructors),
        admins: phpNumber(stats.admins),
        active: phpNumber(stats.active),
        inactive: phpNumber(stats.inactive),
      }}
      page={page}
      totalPages={totalPages}
      rangeFrom={phpNumber(totalFiltered === 0 ? 0 : offset + 1)}
      rangeTo={phpNumber(Math.min(offset + LIMIT, totalFiltered))}
      pageTokens={buildPageTokens(page, totalPages, query)}
      roleFilter={sp.role ?? ""}
      searchFilter={sp.search ?? ""}
      statusFilter={sp.status ?? ""}
      initialMessage={sp.msg ?? ""}
      csrfToken={csrfToken}
    />
  );
}
