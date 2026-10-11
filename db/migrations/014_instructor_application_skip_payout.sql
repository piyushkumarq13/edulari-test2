-- Phase 7: persist the payout "skip" choice.
--
-- The PHP step-5 form posts skip_payout and writes it to $_SESSION['instructor_reg_data']['legal'],
-- but saveInstructorRegistrationData() has no column for it, so the step-6 review - which
-- branches on `if (!empty($legal['skip_payout']))` to print "To be added later" - could never see
-- it and always fell through to the bank-line branch. Storing it lets the review render the
-- branch the applicant actually chose.
ALTER TABLE instructor_applications ADD COLUMN IF NOT EXISTS skip_payout boolean NOT NULL DEFAULT false;