import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { notFound } from "next/navigation";
import "@/styles/css/instructor-profile.css";
import { sql } from "@/lib/db/client";
import { getAvatarUrl } from "@/lib/storage/media-urls";
import { siteUrl } from "@/lib/format";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const rows = await sql<{ name: string; headline: string | null }[]>`
    SELECT u.name, ip.headline
    FROM users u
    LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
    WHERE u.id = ${Number(slug)} AND u.role = 'instructor'
  `;
  if (rows.length === 0) return pageMetadata({ title: "Instructor Not Found", description: "This instructor could not be found.", noindex: true });
  return pageMetadata({
    title: `${rows[0].name} — Edulari`,
    description: rows[0].headline ?? `Courses by ${rows[0].name} on Edulari.`,
    path: `/instructor-profile/${slug}`,
    type: "profile",
  });
}

export default async function InstructorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = Number(slug);
  const users = await sql<{ id: number; name: string; profile_image: string | null; bio: string | null; registration_date: Date }[]>`
    SELECT id, name, profile_image, bio, registration_date FROM users WHERE id = ${id} AND role = 'instructor'
  `;
  if (users.length === 0) notFound();
  const user = users[0];

  const profiles = await sql<{ headline: string | null; bio: string | null; website: string | null; linkedin_url: string | null; twitter_url: string | null; years_exp: number; teaching_style: string | null }[]>`
    SELECT headline, bio, website, linkedin_url, twitter_url, years_exp, teaching_style FROM instructor_profiles WHERE user_id = ${id}
  `;
  const profile = profiles[0];

  const stats = await sql<{ total_courses: string; published_courses: string; total_students: string; avg_rating: string | null }[]>`
    SELECT
      (SELECT COUNT(*)::text FROM courses WHERE instructor_id = ${id}) AS total_courses,
      (SELECT COUNT(*)::text FROM courses WHERE instructor_id = ${id} AND is_published = true) AS published_courses,
      (SELECT COUNT(DISTINCT student_id)::text FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.instructor_id = ${id}) AS total_students,
      (SELECT AVG(rating)::text FROM instructor_ratings WHERE instructor_id = ${id}) AS avg_rating
  `;
  const s = stats[0] ?? { total_courses: "0", published_courses: "0", total_students: "0", avg_rating: null };

  const courses = await sql<{ id: number; title: string; slug: string; thumbnail: string | null; level: string; price: number; avg_rating: number | null; student_count: number }[]>`
    SELECT c.id, c.title, c.slug, c.thumbnail, c.level, c.price,
           (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) as avg_rating,
           (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as student_count
    FROM courses c WHERE c.instructor_id = ${id} AND c.is_published = true ORDER BY c.created_at DESC
  `;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl("/") },
      { "@type": "ListItem", position: 2, name: user.name, item: siteUrl(`/instructor-profile/${slug}`) },
    ],
  };

  const avatar = getAvatarUrl(user.profile_image);

  return (
    <main className="ip-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <section className="ip-hero">
        <div className="ip-hero-inner">
          <div className="ip-avatar">
            {avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatar} alt={user.name} />
            ) : (
              <span>{user.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="ip-hero-text">
            <h1 className="ip-name">{user.name}</h1>
            <p className="ip-headline">{profile?.headline ?? "Expert Instructor"}</p>
            <div className="ip-stats">
              <div className="ip-stat"><span className="ip-stat-num">{Number(s.published_courses).toLocaleString()}</span><span className="ip-stat-lbl">Courses</span></div>
              <div className="ip-stat"><span className="ip-stat-num">{Number(s.total_students).toLocaleString()}</span><span className="ip-stat-lbl">Students</span></div>
              <div className="ip-stat"><span className="ip-stat-num">{s.avg_rating ? Math.round(Number(s.avg_rating) * 10) / 10 : "—"}</span><span className="ip-stat-lbl">Rating</span></div>
              {profile?.years_exp ? <div className="ip-stat"><span className="ip-stat-num">{profile.years_exp}</span><span className="ip-stat-lbl">Years exp</span></div> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="ip-layout">
        <div className="ip-main">
          {profile?.bio || user.bio ? (
            <section className="ip-section" id="about">
              <h2 className="ip-section-title">About</h2>
              <div className="ip-bio">{profile?.bio ?? user.bio}</div>
            </section>
          ) : null}

          <section className="ip-section" id="courses">
            <h2 className="ip-section-title">Courses by {user.name}</h2>
            {courses.length === 0 ? (
              <div className="ip-empty"><p>No published courses yet.</p></div>
            ) : (
              <div className="bc-courses bc-courses--grid">
                {courses.map((c) => (
                  <article key={c.id} className="bc-card">
                    <a href={`/course/${c.slug}`} className="bc-card-img-link" tabIndex={-1} aria-hidden="true">
                      <div className="bc-card-img">
                        {c.thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={c.thumbnail} alt={c.title} loading="lazy" />
                        ) : (
                          <div className="bc-img-placeholder"><svg viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" /></svg></div>
                        )}
                        <div className="bc-img-overlay">
                          <div className="bc-badges-tl">{c.price === 0 && <span className="bc-badge bc-badge--free">Free</span>}</div>
                          <span className={`bc-badge bc-badge--level bc-badge--${c.level}`}>{c.level.charAt(0).toUpperCase() + c.level.slice(1)}</span>
                        </div>
                      </div>
                    </a>
                    <div className="bc-card-body">
                      <h3 className="bc-card-title"><a href={`/course/${c.slug}`}>{c.title}</a></h3>
                      <div className="bc-card-rating"><span className="bc-rating-num">{c.avg_rating ? Math.round(c.avg_rating * 10) / 10 : "—"}</span></div>
                      <div className="bc-card-meta"><span className="bc-meta">{c.student_count} students</span></div>
                    </div>
                    <div className="bc-card-footer">
                      <div className="bc-price-wrap">{c.price === 0 ? <span className="bc-price bc-price--free">Free</span> : <span className="bc-price">₹{c.price}</span>}</div>
                      <div className="bc-card-btns"><a href={`/course/${c.slug}`} className="bc-btn bc-btn--ghost">Details</a></div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="ip-sidebar">
          <section className="ip-card">
            <h3 className="ip-card-title">Details</h3>
            <ul className="ip-details">
              <li><span>Teaching style</span><strong>{profile?.teaching_style ?? "—"}</strong></li>
              <li><span>Experience</span><strong>{profile?.years_exp ?? 0} years</strong></li>
              {profile?.website ? <li><span>Website</span><a href={profile.website} rel="noopener noreferrer" target="_blank">{profile.website.replace(/^https?:\/\//, "")}</a></li> : null}
              {profile?.linkedin_url ? <li><span>LinkedIn</span><a href={profile.linkedin_url} rel="noopener noreferrer" target="_blank">Profile</a></li> : null}
              {profile?.twitter_url ? <li><span>Twitter</span><a href={profile.twitter_url} rel="noopener noreferrer" target="_blank">Profile</a></li> : null}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
