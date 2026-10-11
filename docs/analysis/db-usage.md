# Database Usage Analysis (db-usage)

Source of truth: `docs/schema/mysql_schema.txt` (43 tables). Old site: `C:\Users\piyus\Desktop\htdocs (7)\htdocs` (`public/` + `private/`).
Method: every `.php` file under old-site `public/` and `private/` was scanned for table-name references; reads (`SELECT`, `dbSelect`, `dbSelectOne`, `FROM`, `JOIN`) and writes (`INSERT`, `REPLACE`, `UPDATE`, `DELETE`, `dbInsert`, `dbExecute` with write SQL) classified per file. Column references checked via qualified `table.column` refs, `INSERT INTO t (cols)` lists, `REPLACE INTO t (cols)` lists and `UPDATE t SET col=` lists.

## 1. Schema inventory

### account_recovery_attempts

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `ip_address` | `varchar(45) NOT NULL` |
| `attempt_count` | `int(11) DEFAULT 0` |
| `first_attempt` | `datetime DEFAULT current_timestamp()` - datetime |
| `is_blocked` | `tinyint(4) DEFAULT 0` |
| `block_expires` | `datetime DEFAULT NULL` - datetime |
| `created_at` | `timestamp NULL DEFAULT current_timestamp()` - datetime |
| `updated_at` | `timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `ip_address` (`ip_address`)`
- `KEY `idx_ip_address` (`ip_address`)`
- `KEY `idx_is_blocked` (`is_blocked`)`

### app_settings

| column | type |
|---|---|
| `setting_key` | `varchar(100) NOT NULL` |
| `setting_value` | `varchar(255) NOT NULL` |
| `updated_at` | `timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`setting_key`)`

### assignments

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `lesson_id` | `int(11) NOT NULL` |
| `instructions` | `text NOT NULL` |
| `max_marks` | `int(11) DEFAULT 100` |
| `passing_marks` | `int(11) DEFAULT 40` |
| `due_days` | `int(11) DEFAULT 7` |
| `allow_late_submission` | `tinyint(4) DEFAULT 0` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `lesson_id` (`lesson_id`)`

### assignment_submissions

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `enrollment_id` | `int(11) NOT NULL` |
| `lesson_id` | `int(11) NOT NULL` |
| `submission_text` | `text DEFAULT NULL` |
| `attachment_file` | `varchar(255) DEFAULT NULL` |
| `submitted_at` | `datetime DEFAULT current_timestamp()` - datetime |
| `marks_obtained` | `int(11) DEFAULT NULL` |
| `feedback` | `text DEFAULT NULL` |
| `status` | `enum('pending','graded','returned') DEFAULT 'pending'` - enum |
| `graded_at` | `datetime DEFAULT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `enrollment_id` (`enrollment_id`)`
- `KEY `lesson_id` (`lesson_id`)`

### bug_reports

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `reference` | `varchar(20) NOT NULL` |
| `reporter_name` | `varchar(120) NOT NULL` |
| `reporter_email` | `varchar(255) NOT NULL` |
| `reporter_role` | `varchar(30) NOT NULL DEFAULT 'Guest'` |
| `reporter_ip` | `varchar(45) NOT NULL DEFAULT ''` |
| `issue_type` | `varchar(30) NOT NULL DEFAULT 'bug'` |
| `page_url` | `varchar(500) NOT NULL DEFAULT ''` |
| `subject` | `varchar(255) NOT NULL` |
| `description` | `text NOT NULL` |
| `steps` | `text DEFAULT NULL` |
| `expected` | `text DEFAULT NULL` |
| `severity` | `tinyint(3) unsigned NOT NULL DEFAULT 3` |
| `severity_label` | `varchar(20) NOT NULL DEFAULT 'Moderate'` |
| `browser` | `varchar(200) NOT NULL DEFAULT ''` |
| `attachment` | `varchar(260) DEFAULT NULL` |
| `status` | `enum('open','in_progress','resolved','wont_fix','duplicate') NOT NULL DEFAULT 'open'` - enum |
| `admin_notes` | `text DEFAULT NULL` |
| `resolved_at` | `datetime DEFAULT NULL` - datetime |
| `created_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |
| `updated_at` | `datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `reference` (`reference`)`
- `KEY `idx_status` (`status`)`
- `KEY `idx_severity` (`severity`)`
- `KEY `idx_reporter_email` (`reporter_email`)`
- `KEY `idx_reporter_ip` (`reporter_ip`)`
- `KEY `idx_created_at` (`created_at`)`
- `KEY `idx_issue_type` (`issue_type`)`

### cart

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `student_id` | `int(11) NOT NULL` |
| `course_id` | `int(11) NOT NULL` |
| `added_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `unique_cart` (`student_id`,`course_id`)`
- `KEY `course_id` (`course_id`)`

### categories

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `name` | `varchar(100) NOT NULL` |
| `slug` | `varchar(100) NOT NULL` |
| `description` | `text DEFAULT NULL` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `slug` (`slug`)`

### certificates

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `certificate_id` | `varchar(32) NOT NULL COMMENT 'Unique public ID like CERT-XXXX-XXXX-XXXX'` |
| `enrollment_id` | `int(11) NOT NULL` |
| `student_id` | `int(11) NOT NULL` |
| `course_id` | `int(11) NOT NULL` |
| `course_name` | `varchar(255) NOT NULL COMMENT 'Snapshot of course title at time of issue'` |
| `student_name` | `varchar(255) NOT NULL COMMENT 'Snapshot of student name at time of issue'` |
| `issued_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `uq_certificate_id` (`certificate_id`)`
- `UNIQUE KEY `uq_enrollment` (`enrollment_id`)`
- `KEY `student_id` (`student_id`)`
- `KEY `course_id` (`course_id`)`

### contact_replies

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `submission_id` | `int(10) unsigned NOT NULL` |
| `admin_id` | `int(10) unsigned NOT NULL COMMENT 'FK → users.id (the admin who replied)'` |
| `reply_message` | `text NOT NULL` |
| `reply_type` | `enum('public','internal') NOT NULL DEFAULT 'public' COMMENT 'public = visible to user; internal = admin note only'` - enum |
| `resolution_status` | `varchar(50) DEFAULT NULL COMMENT 'Status the ticket was moved to with this reply'` |
| `created_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `idx_submission_id` (`submission_id`)`
- `KEY `idx_admin_id` (`admin_id`)`
- `CONSTRAINT `fk_cr_submission` FOREIGN KEY (`submission_id`) REFERENCES `contact_submissions` (`id`) ON DELETE CASCADE`

### contact_submissions

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `ticket_ref` | `varchar(20) NOT NULL COMMENT 'e.g. CT-A1B2C3D4'` |
| `user_id` | `int(10) unsigned DEFAULT NULL COMMENT 'NULL for guests'` |
| `sender_name` | `varchar(100) NOT NULL` |
| `sender_email` | `varchar(200) NOT NULL` |
| `sender_role` | `varchar(50) NOT NULL DEFAULT 'Guest'` |
| `category` | `varchar(50) NOT NULL` |
| `priority` | `enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal'` - enum |
| `subject` | `varchar(200) NOT NULL` |
| `message` | `text NOT NULL` |
| `order_ref` | `varchar(100) DEFAULT NULL` |
| `course_ref` | `varchar(200) DEFAULT NULL` |
| `sender_ip` | `varchar(45) NOT NULL COMMENT 'IPv4 or IPv6'` |
| `status` | `enum('open','in_progress','waiting','resolved','closed') NOT NULL DEFAULT 'open'` - enum |
| `created_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |
| `updated_at` | `datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `ticket_ref` (`ticket_ref`)`
- `KEY `idx_status` (`status`)`
- `KEY `idx_priority` (`priority`)`
- `KEY `idx_category` (`category`)`
- `KEY `idx_sender_email` (`sender_email`(100))`
- `KEY `idx_sender_ip` (`sender_ip`)`
- `KEY `idx_user_id` (`user_id`)`
- `KEY `idx_created_at` (`created_at`)`

### courses

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `instructor_id` | `int(11) NOT NULL` |
| `category_id` | `int(11) DEFAULT NULL` |
| `title` | `varchar(255) NOT NULL` |
| `slug` | `varchar(255) NOT NULL` |
| `description` | `longtext DEFAULT NULL` - longtext/json |
| `short_description` | `text DEFAULT NULL` |
| `thumbnail` | `varchar(255) DEFAULT NULL` |
| `level` | `enum('beginner','intermediate','advanced') DEFAULT 'beginner'` - enum |
| `language` | `varchar(50) DEFAULT 'English'` |
| `duration_hours` | `int(11) DEFAULT 0` |
| `price` | `decimal(10,2) DEFAULT 0.00` |
| `is_published` | `tinyint(4) DEFAULT 0` |
| `is_featured` | `tinyint(4) DEFAULT 0` |
| `certificate_enabled` | `tinyint(4) DEFAULT 1` |
| `passing_percentage` | `int(11) DEFAULT 70` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |
| `updated_at` | `datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |
| `published_at` | `datetime DEFAULT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `slug` (`slug`)`
- `KEY `instructor_id` (`instructor_id`)`
- `KEY `category_id` (`category_id`)`

### course_ai_chats

| column | type |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `course_id` | `int(10) unsigned NOT NULL` |
| `user_id` | `int(10) unsigned NOT NULL` |
| `created_at` | `timestamp NULL DEFAULT current_timestamp()` - datetime |
| `updated_at` | `timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `uniq_course_user` (`course_id`,`user_id`)`

### course_ai_messages

| column | type |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `chat_id` | `bigint(20) unsigned NOT NULL` |
| `course_id` | `int(10) unsigned NOT NULL` |
| `user_id` | `int(10) unsigned NOT NULL` |
| `role` | `enum('user','assistant') NOT NULL` - enum |
| `content` | `mediumtext NOT NULL` |
| `versions` | `longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`versions`))` - longtext/json |
| `active_version` | `int(11) NOT NULL DEFAULT 0` |
| `feedback` | `enum('like','dislike') DEFAULT NULL` - enum |
| `created_at` | `timestamp NULL DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `chat_id` (`chat_id`,`created_at`)`

### course_ai_share_links

| column | type |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `slug` | `varchar(16) NOT NULL` |
| `chat_id` | `bigint(20) unsigned NOT NULL` |
| `user_id` | `int(10) unsigned NOT NULL` |
| `created_at` | `timestamp NULL DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `slug` (`slug`)`
- `KEY `chat_id` (`chat_id`)`

### course_reviews

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `course_id` | `int(11) NOT NULL` |
| `student_id` | `int(11) NOT NULL` |
| `rating` | `int(11) NOT NULL CHECK (`rating` >= 1 and `rating` <= 5)` |
| `review_text` | `text DEFAULT NULL` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `course_id` (`course_id`)`
- `KEY `student_id` (`student_id`)`

### course_sections

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `course_id` | `int(11) NOT NULL` |
| `title` | `varchar(255) NOT NULL` |
| `description` | `text DEFAULT NULL` |
| `sort_order` | `int(11) DEFAULT 0` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `course_id` (`course_id`)`

### email_verification_tokens

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `user_id` | `int(11) NOT NULL` |
| `source_table` | `enum('unverified_users','users') NOT NULL DEFAULT 'unverified_users'` - enum |
| `token` | `varchar(64) NOT NULL` |
| `expires_at` | `datetime NOT NULL` - datetime |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `token` (`token`)`
- `UNIQUE KEY `user_id` (`user_id`)`
- `KEY `expires_at` (`expires_at`)`

### enrollments

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `course_id` | `int(11) NOT NULL` |
| `student_id` | `int(11) NOT NULL` |
| `enrolled_at` | `datetime DEFAULT current_timestamp()` - datetime |
| `completed_at` | `datetime DEFAULT NULL` - datetime |
| `progress_percentage` | `int(11) DEFAULT 0` |
| `final_grade` | `decimal(5,2) DEFAULT NULL` |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `unique_enrollment` (`course_id`,`student_id`)`
- `KEY `student_id` (`student_id`)`

### instructor_applications

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `user_id` | `int(11) NOT NULL` |
| `highest_education` | `varchar(80) NOT NULL DEFAULT ''` |
| `institution` | `varchar(150) NOT NULL DEFAULT ''` |
| `field_of_study` | `varchar(150) NOT NULL DEFAULT ''` |
| `graduation_year` | `year(4) DEFAULT NULL` |
| `certifications` | `text DEFAULT NULL` |
| `professional_exp` | `text NOT NULL` |
| `notable_works` | `text DEFAULT NULL` |
| `primary_subject` | `varchar(100) NOT NULL DEFAULT ''` |
| `secondary_subjects` | `varchar(255) DEFAULT NULL` |
| `skill_level` | `varchar(30) NOT NULL DEFAULT ''` |
| `target_audience` | `varchar(255) NOT NULL DEFAULT ''` |
| `course_ideas` | `text NOT NULL` |
| `sample_content_url` | `varchar(255) DEFAULT NULL` |
| `full_legal_name` | `varchar(150) NOT NULL DEFAULT ''` |
| `pan_number` | `varchar(10) DEFAULT NULL` |
| `bank_account` | `varchar(20) DEFAULT NULL` |
| `ifsc_code` | `varchar(11) DEFAULT NULL` |
| `account_holder` | `varchar(150) DEFAULT NULL` |
| `upi_id` | `varchar(100) DEFAULT NULL` |
| `revenue_share_ack` | `tinyint(4) NOT NULL DEFAULT 0` |
| `terms_agreed` | `tinyint(4) NOT NULL DEFAULT 0` |
| `content_policy` | `tinyint(4) NOT NULL DEFAULT 0` |
| `govt_id_file` | `varchar(255) DEFAULT NULL` |
| `marksheet_file` | `varchar(255) DEFAULT NULL` |
| `docs_scheduled_delete` | `datetime DEFAULT NULL` - datetime |
| `docs_delete_after` | `datetime DEFAULT NULL` - datetime |
| `status` | `enum('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft'` - enum |
| `rejection_reason` | `text DEFAULT NULL` |
| `submitted_at` | `datetime DEFAULT current_timestamp()` - datetime |
| `reviewed_at` | `datetime DEFAULT NULL` - datetime |
| `updated_at` | `datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |
| `test_score` | `tinyint(3) unsigned NOT NULL DEFAULT 0` |
| `test_time_taken_seconds` | `int(11) DEFAULT NULL` |
| `test_attempt_started_at` | `datetime DEFAULT NULL` - datetime |
| `last_completed_step` | `tinyint(3) unsigned NOT NULL DEFAULT 1` |
| `reg_step` | `tinyint(3) unsigned NOT NULL DEFAULT 1` |
| `profile_headline` | `varchar(120) DEFAULT NULL` |
| `profile_bio` | `text DEFAULT NULL` |
| `profile_website` | `varchar(255) DEFAULT NULL` |
| `profile_linkedin` | `varchar(255) DEFAULT NULL` |
| `profile_twitter` | `varchar(255) DEFAULT NULL` |
| `profile_years_exp` | `tinyint(3) unsigned DEFAULT 0` |
| `profile_teach_style` | `varchar(50) DEFAULT NULL` |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `user_id` (`user_id`)`
- `KEY `status` (`status`)`

### instructor_payouts

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `instructor_id` | `int(10) unsigned NOT NULL` |
| `amount` | `decimal(10,2) NOT NULL` |
| `currency` | `varchar(10) NOT NULL DEFAULT 'INR'` |
| `status` | `enum('pending','paid','cancelled') NOT NULL DEFAULT 'pending'` - enum |
| `payment_method` | `varchar(100) DEFAULT NULL` |
| `reference_no` | `varchar(255) DEFAULT NULL` |
| `note` | `text DEFAULT NULL` |
| `created_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |
| `paid_at` | `datetime DEFAULT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `idx_instructor` (`instructor_id`)`
- `KEY `idx_status` (`status`)`

### instructor_profiles

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `user_id` | `int(11) NOT NULL` |
| `headline` | `varchar(120) NOT NULL DEFAULT ''` |
| `bio` | `text NOT NULL` |
| `website` | `varchar(255) DEFAULT NULL` |
| `linkedin_url` | `varchar(255) DEFAULT NULL` |
| `twitter_url` | `varchar(255) DEFAULT NULL` |
| `years_exp` | `tinyint(3) NOT NULL DEFAULT 0` |
| `teaching_style` | `varchar(50) DEFAULT NULL` |
| `avatar_url` | `varchar(255) DEFAULT NULL` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |
| `updated_at` | `datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `user_id` (`user_id`)`

### instructor_ratings

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `instructor_id` | `int(11) NOT NULL` |
| `student_id` | `int(11) NOT NULL` |
| `rating` | `tinyint(1) NOT NULL CHECK (`rating` between 1 and 5)` - tinyint(1) flag |
| `note` | `varchar(200) DEFAULT NULL` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |
| `updated_at` | `datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `uq_student_instructor` (`student_id`,`instructor_id`)`
- `KEY `idx_instructor` (`instructor_id`)`
- `KEY `idx_student` (`student_id`)`

### lessons

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `section_id` | `int(11) NOT NULL` |
| `course_id` | `int(11) NOT NULL` |
| `title` | `varchar(255) NOT NULL` |
| `content_type` | `enum('video','text','pdf','quiz','assignment') NOT NULL` - enum |
| `content_text` | `longtext DEFAULT NULL` - longtext/json |
| `video_url` | `varchar(500) DEFAULT NULL` |
| `video_duration` | `int(11) DEFAULT 0` |
| `pdf_file` | `varchar(255) DEFAULT NULL` |
| `is_free_preview` | `tinyint(4) DEFAULT 0` |
| `sort_order` | `int(11) DEFAULT 0` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |
| `updated_at` | `datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `section_id` (`section_id`)`
- `KEY `course_id` (`course_id`)`

### lesson_progress

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `enrollment_id` | `int(11) NOT NULL` |
| `lesson_id` | `int(11) NOT NULL` |
| `completed_at` | `datetime DEFAULT NULL` - datetime |
| `time_spent_seconds` | `int(11) DEFAULT 0` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `unique_progress` (`enrollment_id`,`lesson_id`)`
- `KEY `lesson_id` (`lesson_id`)`

### login_attempts

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `identifier` | `varchar(255) NOT NULL` |
| `type` | `enum('email','ip') NOT NULL` - enum |
| `attempt_count` | `int(11) DEFAULT 0` |
| `last_attempt` | `datetime DEFAULT NULL` - datetime |
| `is_blocked` | `tinyint(4) DEFAULT 0` |
| `block_expires` | `datetime DEFAULT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`

### notification_messages

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `type` | `varchar(50) NOT NULL` |
| `title` | `varchar(255) NOT NULL` |
| `body` | `text NOT NULL` |
| `audience` | `varchar(20) NOT NULL DEFAULT 'all'` |
| `target_user_id` | `int(11) DEFAULT NULL` |
| `sent_by` | `int(11) DEFAULT NULL` |
| `created_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `idx_audience` (`audience`)`
- `KEY `idx_target` (`target_user_id`)`
- `KEY `idx_created` (`created_at`)`

### notification_reads

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `message_id` | `int(11) NOT NULL` |
| `user_id` | `int(11) NOT NULL` |
| `is_read` | `tinyint(1) NOT NULL DEFAULT 0` - tinyint(1) flag |
| `deleted_at` | `datetime DEFAULT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `uq_msg_user` (`message_id`,`user_id`)`
- `KEY `idx_user_read` (`user_id`,`is_read`)`

### password_resets

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `user_id` | `int(11) NOT NULL` |
| `token` | `varchar(64) NOT NULL` |
| `expires_at` | `datetime NOT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `user_id` (`user_id`)`

### password_reset_attempts

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `identifier` | `varchar(255) NOT NULL` |
| `type` | `enum('email','ip') NOT NULL` - enum |
| `attempt_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `idx_identifier_type` (`identifier`,`type`)`
- `KEY `idx_attempt_at` (`attempt_at`)`

### purchase_history

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `student_id` | `int(11) NOT NULL` |
| `razorpay_order_id` | `varchar(100) NOT NULL` |
| `razorpay_payment_id` | `varchar(100) NOT NULL` |
| `amount_paise` | `int(11) unsigned NOT NULL` |
| `currency` | `varchar(10) NOT NULL DEFAULT 'INR'` |
| `status` | `enum('paid','enrollment_failed','enrolled','refunded') NOT NULL DEFAULT 'paid'` - enum |
| `enrolled_count` | `tinyint(3) unsigned NOT NULL DEFAULT 0` |
| `courses_json` | `longtext NOT NULL` - longtext/json |
| `ip_address` | `varchar(45) DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT current_timestamp()` - datetime |
| `updated_at` | `timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `uq_payment` (`razorpay_payment_id`)`
- `KEY `idx_student` (`student_id`)`
- `KEY `idx_order` (`razorpay_order_id`)`
- `KEY `idx_status` (`status`)`

### quiz_answers

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `attempt_id` | `int(11) NOT NULL` |
| `question_id` | `int(11) NOT NULL` |
| `selected_option_id` | `int(11) DEFAULT NULL` |
| `is_correct` | `tinyint(4) DEFAULT 0` |
| `points_earned` | `int(11) DEFAULT 0` |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `attempt_id` (`attempt_id`)`
- `KEY `question_id` (`question_id`)`

### quiz_attempts

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `enrollment_id` | `int(11) NOT NULL` |
| `lesson_id` | `int(11) NOT NULL` |
| `score` | `int(11) DEFAULT 0` |
| `total_points` | `int(11) DEFAULT 0` |
| `percentage` | `decimal(5,2) DEFAULT 0.00` |
| `passed` | `tinyint(4) DEFAULT 0` |
| `started_at` | `datetime DEFAULT current_timestamp()` - datetime |
| `completed_at` | `datetime DEFAULT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `enrollment_id` (`enrollment_id`)`
- `KEY `lesson_id` (`lesson_id`)`

### quiz_options

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `question_id` | `int(11) NOT NULL` |
| `option_text` | `text NOT NULL` |
| `is_correct` | `tinyint(4) DEFAULT 0` |
| `sort_order` | `int(11) DEFAULT 0` |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `question_id` (`question_id`)`

### quiz_questions

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `lesson_id` | `int(11) NOT NULL` |
| `question` | `text NOT NULL` |
| `question_type` | `enum('multiple_choice','true_false','short_answer') DEFAULT 'multiple_choice'` - enum |
| `points` | `int(11) DEFAULT 1` |
| `sort_order` | `int(11) DEFAULT 0` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `lesson_id` (`lesson_id`)`

### razorpay_orders

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `student_id` | `int(11) NOT NULL` |
| `razorpay_order_id` | `varchar(64) NOT NULL` |
| `amount_paise` | `int(11) NOT NULL` |
| `currency` | `varchar(10) NOT NULL DEFAULT 'INR'` |
| `courses_json` | `text NOT NULL` |
| `status` | `enum('created','enrolled','enrollment_failed','abandoned','failed','cancelled') NOT NULL DEFAULT 'created'` - enum |
| `failure_reason` | `varchar(255) DEFAULT NULL` |
| `created_at` | `timestamp NULL DEFAULT current_timestamp()` - datetime |
| `updated_at` | `timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `razorpay_order_id` (`razorpay_order_id`)`
- `KEY `idx_status_created` (`status`,`created_at`)`

### registration_blocks

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `ip_address` | `varchar(45) NOT NULL` |
| `attempt_count` | `tinyint(3) unsigned NOT NULL DEFAULT 1` |
| `first_attempt` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |
| `block_expires` | `datetime DEFAULT NULL` - datetime |
| `is_blocked` | `tinyint(1) NOT NULL DEFAULT 0` - tinyint(1) flag |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `uq_reg_ip` (`ip_address`)`

### student_profiles

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `user_id` | `int(10) unsigned NOT NULL` |
| `highest_education` | `enum('high_school','diploma','bachelors','masters','phd','other') DEFAULT NULL` - enum |
| `college_name` | `varchar(255) DEFAULT NULL` |
| `field_of_study` | `varchar(255) DEFAULT NULL` |
| `courses_interested` | `varchar(1000) DEFAULT NULL COMMENT 'Comma-separated category names / free text'` |
| `skills` | `varchar(1000) DEFAULT NULL COMMENT 'Comma-separated skill tags'` |
| `learning_goal` | `enum('career_change','skill_upgrade','personal_interest','academic','other') DEFAULT NULL` - enum |
| `experience_level` | `enum('beginner','intermediate','advanced') DEFAULT NULL` - enum |
| `bio` | `text DEFAULT NULL` |
| `phone` | `varchar(20) DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT current_timestamp()` - datetime |
| `updated_at` | `timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `uq_user_profile` (`user_id`)`

### study_plan

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `student_id` | `int(10) unsigned NOT NULL` |
| `course_id` | `int(10) unsigned NOT NULL` |
| `lesson_id` | `int(10) unsigned DEFAULT NULL` |
| `planned_date` | `date NOT NULL` |
| `planned_time` | `time DEFAULT NULL` |
| `duration_min` | `smallint(6) DEFAULT 30 COMMENT 'Planned study minutes'` |
| `note` | `varchar(255) DEFAULT NULL` |
| `is_done` | `tinyint(1) NOT NULL DEFAULT 0` - tinyint(1) flag |
| `created_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |
| `updated_at` | `datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `idx_student_date` (`student_id`,`planned_date`)`
- `KEY `idx_course` (`course_id`)`
- `KEY `idx_lesson` (`lesson_id`)`

### test_failures

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `user_id` | `int(10) unsigned NOT NULL` |
| `ip_address` | `varchar(45) NOT NULL` |
| `context` | `varchar(64) NOT NULL DEFAULT 'instructor_registration'` |
| `failed_at` | `datetime NOT NULL` - datetime |
| `retry_after` | `datetime NOT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `KEY `idx_user` (`user_id`)`
- `KEY `idx_ip` (`ip_address`)`

### test_tokens

| column | type |
|---|---|
| `id` | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `user_id` | `int(10) unsigned NOT NULL` |
| `token` | `varchar(64) NOT NULL` |
| `expires_at` | `datetime NOT NULL` - datetime |
| `used` | `tinyint(1) NOT NULL DEFAULT 0` - tinyint(1) flag |
| `started_at` | `datetime DEFAULT NULL` - datetime |
| `questions_data` | `longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`questions_data`))` - longtext/json |
| `answers_data` | `longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`answers_data`))` - longtext/json |
| `started_ip` | `varchar(45) DEFAULT NULL` |
| `last_autosave_at` | `datetime DEFAULT NULL` - datetime |
| `test_data` | `longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`test_data`))` - longtext/json |
| `answers_updated_at` | `datetime DEFAULT NULL` - datetime |
| `on_pass_action` | `varchar(64) NOT NULL DEFAULT 'instructor_registration'` |
| `redirect_pass` | `varchar(255) NOT NULL DEFAULT '/instructor-register-success'` |
| `redirect_fail` | `varchar(255) NOT NULL DEFAULT '/instructor-register'` |
| `created_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `token` (`token`)`
- `KEY `idx_token` (`token`)`
- `KEY `idx_user` (`user_id`)`

### users

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `name` | `varchar(255) NOT NULL` |
| `email` | `varchar(255) NOT NULL` |
| `password` | `varchar(255) DEFAULT NULL` |
| `oauth_provider` | `varchar(20) DEFAULT NULL COMMENT 'google \| github \| null for password users'` |
| `oauth_id` | `varchar(255) DEFAULT NULL COMMENT 'Unique user ID returned by the OAuth provider'` |
| `avatar_url` | `varchar(512) DEFAULT NULL COMMENT 'Profile picture URL from OAuth provider'` |
| `registration_date` | `datetime DEFAULT NULL` - datetime |
| `last_login` | `datetime DEFAULT NULL` - datetime |
| `email_verified` | `tinyint(4) DEFAULT 1` |
| `is_recovery_mode` | `tinyint(1) DEFAULT 0` - tinyint(1) flag |
| `ip_address` | `varchar(45) DEFAULT NULL` |
| `profile_completed` | `tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 = onboarding not done, 1 = done'` - tinyint(1) flag |
| `role` | `varchar(20) NOT NULL DEFAULT 'student'` |
| `bio` | `text DEFAULT NULL` |
| `profile_image` | `varchar(255) DEFAULT NULL` |
| `is_active` | `tinyint(4) DEFAULT 1` |
| `block_reason` | `varchar(50) DEFAULT NULL` |
| `block_note` | `varchar(255) DEFAULT NULL` |
| `password_changed_at` | `datetime DEFAULT NULL` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `email` (`email`)`
- `UNIQUE KEY `idx_oauth_provider_id` (`oauth_provider`,`oauth_id`)`
- `KEY `idx_is_recovery_mode` (`is_recovery_mode`)`

### user_sessions

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `user_id` | `int(11) NOT NULL` |
| `session_token` | `varchar(64) NOT NULL` |
| `ip_address` | `varchar(45) NOT NULL DEFAULT ''` |
| `device_info` | `varchar(255) NOT NULL DEFAULT ''` |
| `created_at` | `datetime NOT NULL DEFAULT current_timestamp()` - datetime |
| `last_active` | `datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` - datetime |
| `is_active` | `tinyint(1) NOT NULL DEFAULT 1` - tinyint(1) flag |
| `expires_at` | `datetime DEFAULT NULL` - datetime |
| `kicked_reason` | `varchar(50) DEFAULT NULL` |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `unique_token` (`session_token`)`
- `KEY `idx_user_id` (`user_id`)`
- `KEY `idx_token` (`session_token`)`

### wishlists

| column | type |
|---|---|
| `id` | `int(11) NOT NULL AUTO_INCREMENT` |
| `student_id` | `int(11) NOT NULL` |
| `course_id` | `int(11) NOT NULL` |
| `created_at` | `datetime DEFAULT current_timestamp()` - datetime |

Keys/indexes:

- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `unique_wishlist` (`student_id`,`course_id`)`
- `KEY `course_id` (`course_id`)`

## 2. Table usage in code (reads / writes)

### account_recovery_attempts

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`

### app_settings

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\payment_reconciliation.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\payment_reconciliation.php`

### assignments

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\assignments.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\grades.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\assignments.php`

### assignment_submissions

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\grades.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

### bug_reports

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\bug-report-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\bug-reports.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\report-bug.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\track-report.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\bug-report-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\report-bug.php`

### cart

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\browse-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\cart.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\verify-payment.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\wishlist.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

### categories

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\categories.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\browse-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\categories.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\index.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-4.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\sitemap.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\dashboard.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\grades.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\onboarding.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\profile.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\categories.php`

### certificates

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\certificates.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\certificates.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\certificates.php`

### contact_replies

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\contact-submission-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\contact-submissions.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\track-contact.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\contact-submission-detail.php`

### contact_submissions

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\contact-submission-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\contact-submissions.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\contact.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\track-contact.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\contact-submission-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\contact.php`

### courses

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\analytics.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\certificates.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\sections.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\categories.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\enrollments.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\reviews.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\browse-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\categories.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\index.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\earnings.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\edit-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\reviews.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\students.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\sitemap.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\certificates.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\course_ai_chat_api.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\dashboard.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\grades.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\purchase-history.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\verify-certificate.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\wishlist.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\categories.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\edit-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\edit-course.php`

### course_ai_chats

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course-ai-shared.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\course_ai_chat_api.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\course_ai_chat_api.php`

### course_ai_messages

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course-ai-shared.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\course_ai_chat_api.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\course_ai_chat_api.php`

### course_ai_share_links

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course-ai-shared.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\course_ai_chat_api.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\course_ai_chat_api.php`

### course_reviews

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\analytics.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\edit-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\reviews.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\browse-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\categories.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\index.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\reviews.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\students.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\dashboard.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

### course_sections

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\lessons.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\sections.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\edit-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule-api.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\sections.php`

### email_verification_tokens

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\account-activation.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-1.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\account-activation.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-1.php`

### enrollments

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\analytics.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\certificates.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\edit-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\enrollments.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\browse-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\categories.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\index.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\earnings.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\edit-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\students.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\dashboard.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\grades.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\my-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule-api.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\wishlist.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

### instructor_applications

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\api\test_token.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\instructor_registration.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\instructor-application-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\instructor-applications.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\serve-doc.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-8.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\test\index.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\api\test_token.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\instructor_registration.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\test\index.php`

### instructor_payouts

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`

### instructor_profiles

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\instructor_registration.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\instructor-application-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\instructor-applications.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\sitemap.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\instructor_registration.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\profile.php`

### instructor_ratings

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\reviews.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`

### lessons

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\analytics.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\lessons.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\edit-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\browse-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\index.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\media.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\dashboard.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\grades.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule-api.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\lessons.php`

### lesson_progress

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\dashboard.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\my-courses.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

### login_attempts

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`

### notification_messages

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\notifications.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\notifications.php`

### notification_reads

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\notifications.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\notifications.php`

### password_resets

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\password_reset.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\password_reset.php`

### password_reset_attempts

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\password_reset.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\password_reset.php`

### purchase_history

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\check-payment-status.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\purchase-history.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

### quiz_answers

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

### quiz_attempts

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\analytics.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\grades.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

### quiz_options

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\quizzes.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\quizzes.php`

### quiz_questions

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\quizzes.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\course-content.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\quizzes.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\course-content.php`

### razorpay_orders

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\payment_reconciliation.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\mark-order-status.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\razorpay-webhook.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\check-payment-status.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\purchase-history.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\payment_reconciliation.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\create-order.php`

### registration_blocks

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`

### student_profiles

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\onboarding.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\onboarding.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\profile.php`

### study_plan

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule-api.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\schedule-api.php`

### test_failures

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\api\test_token.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\api\test_token.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`

### test_tokens

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\api\test_token.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-8.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\api\test_token.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\token_cleanup.php`

### users

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\email\email_senders.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\analytics.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\instructor_registration.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\notifications.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\password_reset.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\account-activation.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\contact-submission-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\create-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\edit-course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\enrollments.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\instructor-application-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\instructor-applications.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\reviews.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\send-notifications.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\settings.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\user-detail.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\users.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\browse-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\categories.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\index.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-1.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-2.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-3.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-4.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-5.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-6.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-7.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-8.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\earnings.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\reviews.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\students.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\password-reset-after-verify.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\register-success.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\security.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\sitemap.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\dashboard.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\grades.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\onboarding.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\track-contact.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\verify-certificate.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\verify-email.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\instructor_registration.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\password_reset.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\account-activation.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\settings.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\users.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor-register\step-1.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\instructor\profile.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\password-reset-after-verify.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\security.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\onboarding.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\student\profile.php`

### user_sessions

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\security.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\auth.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\password_reset.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\password-reset-after-verify.php`

### wishlists

**Readers (SELECT/dbSelectOne/FROM/JOIN):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\browse-courses.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\cart.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\course.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\index.php`

**Writers (INSERT/UPDATE/DELETE/REPLACE/dbInsert/dbExecute):**

- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php`
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\student.php`

## 3. Column references in code that do NOT exist in the schema

Checked via qualified `table.column` refs, INSERT/REPLACE column lists and UPDATE SET assignments.

- `users.phone` - set via `UPDATE users SET phone = ? WHERE id = ?` in `public/instructor/profile.php`; the `users` table (mysql_schema.txt:585) has no `phone` column (`phone` is defined on `student_profiles`, mysql_schema.txt:529). BUG to note: this UPDATE silently targets a non-existent column (MySQL would error in strict mode; on MyISAM it fails). Map as: port intended behavior and store on `student_profiles.phone` or add the column - see Open questions.
- No other confirmed INSERT/UPDATE/REPLACE column mismatches found by this scan (aliased SELECT columns are not resolvable statically).

## 4. Tables referenced in code but MISSING from mysql_schema.txt

Candidates from scanning `FROM/INTO/JOIN/UPDATE` tokens were inspected individually; all were aliases, prose, HTML classes, or SQL keywords - **no real table is missing** from `mysql_schema.txt`.

## 5. File-backed state that must migrate to the database

| file | current purpose | move to |
|---|---|---|
| `private/data/banners.json` (currently `[]`/2 bytes) + `private/banner-templates/*.php` (icon-message.php, seasonal-promo.php, simple-text.php) | site banner definitions; `private/functions/banners.php` reads/writes this path | new `site_banners` table (per AGENTS.md §9) |
| `.maintenance` (ROOT_PATH) | maintenance-mode flag; checked in `private/functions/maintenance.php` (`file_exists`) | `app_settings` row (e.g. key `maintenance_mode`) |
| `private/.cleanup_last_run` | throttle timestamp for abandoned order reconciliation (`private/functions/instructor_registration.php`) | `cron_state` table (key `cleanup_last_run`) |
| `private/.token_cleanup_last_run` | throttle for token cleanup (`private/functions/token_cleanup.php`, 6 h interval) | `cron_state` table (key `token_cleanup_last_run`) |
| `private/.purge_last_run` | throttle for purge of expired docs/applications (5 h interval, `private/functions/instructor_registration.php`) | `cron_state` table (key `purge_last_run`) |
| `private/logs/maintenance.log` | maintenance job log | `maintenance_logs` table |
| `private/logs/php_errors.log` | PHP error log | console/Vercel logs |
| `private/logs/security.log` | security events | `security_events` table + console |

## Open questions

1. `public/instructor/profile.php` UPDATEs `users.phone` but the schema has no such column - was this intended for `users` (add column) or `student_profiles.phone`?
2. Aliased column references (`u.email`, `c.title`) cannot be statically validated without full query parsing; a runtime parity check against the live MySQL DB is still advisable.
3. `information_schema` appears in `public/admin/settings.php` (introspection query) - confirm it is intentional and portable to Postgres (no `information_schema` parity issue: Postgres has it, but column/table names differ; the query must be rewritten).
4. `dbSelect`/`dbExecute` calls built with dynamic column lists (e.g. quiz UPDATE builders in `private/functions/quizzes.php`) bypass static INSERT-list checks; review those call sites manually during the port.
5. `test` schema tables (`test_failures`, `test_tokens`) exist but the `public/test/` flow uses `$_SESSION["test_data"]`-style session state - confirm whether session state needs a DB table (AGENTS.md says file state moves to DB; session/DB boundary needs a decision).
