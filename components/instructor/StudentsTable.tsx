"use client";

import { useState } from "react";
import { maskEmail, phpRound } from "@/lib/format";
import { getAvatarUrl } from "@/lib/storage/media-urls";

export type StudentRow = {
  id: number;
  name: string;
  email: string;
  profile_image: string | null;
  courses_enrolled: number;
  avg_progress: number;
  courses_completed: number;
  first_enrollment: string;
  last_enrollment: string;
};

export type StudentCourseDetail = {
  course_id: number;
  course_title: string;
  progress_percentage: number;
  enrolled_at: string;
  completed_at: string | null;
  rating: number | null;
};

/**
 * students.php's expandable student rows. The chevron button toggles the sibling detail row's
 * hidden state and its own aria-expanded / --open class, exactly like the inline script did.
 */
export default function StudentsTable({
  students,
  details,
  formatDate,
}: {
  students: StudentRow[];
  details: Record<number, StudentCourseDetail[]>;
  formatDate: (v: string) => string;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="st-table-card">
      <div className="st-table-scroll">
        <table className="st-table" aria-label="Students list">
          <thead>
            <tr>
              <th className="st-th-student">Student</th>
              <th className="st-th-center">Courses</th>
              <th>Avg. Progress</th>
              <th className="st-th-center">Completions</th>
              <th>First Enrolled</th>
              <th>Last Activity</th>
              <th className="st-th-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const pc = Number(s.avg_progress ?? 0);
              const progClass = pc >= 100 ? "st-prog--done" : pc > 0 ? "st-prog--active" : "st-prog--zero";
              const courses = details[s.id] ?? [];
              const isOpen = expanded.has(s.id);
              const initials = s.name.slice(0, 1).toUpperCase();
              return (
                <>
                  <tr className="st-row st-row--main" key={s.id} data-student-id={s.id}>
                    <td className="st-td-student">
                      <div className="st-student-cell">
                        {s.profile_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getAvatarUrl(s.profile_image)} alt={s.name} className="st-avatar-img" width={40} height={40} />
                        ) : (
                          <span className="st-avatar-initials" aria-hidden="true">{initials}</span>
                        )}
                        <div className="st-student-info">
                          <span className="st-student-name">{s.name}</span>
                          <span className="st-student-email">{maskEmail(s.email)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="st-td-center">
                      <span className="st-count-chip">{s.courses_enrolled}</span>
                    </td>
                    <td>
                      <div className="st-progress-wrap" aria-label={`${phpRound(pc, 1)}% average progress`}>
                        <div className="st-progress-bar">
                          <div className={`st-progress-fill ${progClass}`} style={{ width: `${Math.min(100, Math.max(0, pc))}%` }} />
                        </div>
                        <span className="st-progress-label">{phpRound(pc, 1)}%</span>
                      </div>
                    </td>
                    <td className="st-td-center">
                      {s.courses_completed > 0 ? (
                        <span className="st-badge st-badge--success">{s.courses_completed} done</span>
                      ) : (
                        <span className="st-muted">—</span>
                      )}
                    </td>
                    <td className="st-td-date">{formatDate(s.first_enrollment)}</td>
                    <td className="st-td-date">{formatDate(s.last_enrollment)}</td>
                    <td className="st-td-center">
                      {courses.length > 0 ? (
                        <button
                          type="button"
                          className={`st-expand-btn${isOpen ? " st-expand-btn--open" : ""}`}
                          aria-expanded={isOpen}
                          aria-controls={`st-detail-${s.id}`}
                          aria-label={`Show course details for ${s.name}`}
                          onClick={() => toggle(s.id)}
                        >
                          <svg className="st-chevron" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ) : null}
                    </td>
                  </tr>

                  {courses.length > 0 ? (
                    <tr className="st-row st-row--detail" id={`st-detail-${s.id}`} key={`${s.id}-detail`} hidden={!isOpen}>
                      <td colSpan={7} className="st-td-detail">
                        <div className="st-detail-inner">
                          <div className="st-detail-heading-row">
                            <h3 className="st-detail-heading">
                              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              </svg>
                              Course Breakdown
                              <span className="st-detail-student-name">— {s.name}</span>
                            </h3>
                          </div>
                          <div className="st-detail-scroll">
                            <table className="st-detail-table" aria-label={`Course breakdown for ${s.name}`}>
                              <thead>
                                <tr>
                                  <th>Course</th>
                                  <th>Enrolled</th>
                                  <th>Progress</th>
                                  <th>Status</th>
                                  <th>Rating</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {courses.map((dc) => {
                                  const dPc = dc.progress_percentage;
                                  const dClass = dPc >= 100 ? "st-prog--done" : dPc > 0 ? "st-prog--active" : "st-prog--zero";
                                  return (
                                    <tr key={dc.course_id}>
                                      <td className="st-detail-course-title">{dc.course_title}</td>
                                      <td className="st-detail-date">{formatDate(dc.enrolled_at)}</td>
                                      <td>
                                        <div className="st-progress-wrap st-progress-wrap--sm">
                                          <div className="st-progress-bar">
                                            <div className={`st-progress-fill ${dClass}`} style={{ width: `${Math.min(100, dPc)}%` }} />
                                          </div>
                                          <span className="st-progress-label">{dPc}%</span>
                                        </div>
                                      </td>
                                      <td>
                                        {dc.completed_at ? (
                                          <span className="st-badge st-badge--success">Completed</span>
                                        ) : dPc > 0 ? (
                                          <span className="st-badge st-badge--info">In Progress</span>
                                        ) : (
                                          <span className="st-badge st-badge--neutral">Not Started</span>
                                        )}
                                      </td>
                                      <td>
                                        {dc.rating ? (
                                          <span className="st-rating">
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true">
                                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                            </svg>
                                            {dc.rating}
                                          </span>
                                        ) : (
                                          <span className="st-muted">—</span>
                                        )}
                                      </td>
                                      <td>
                                        <a href={`/instructor/course-analytics?id=${dc.course_id}`} className="st-link-btn">Analytics</a>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}