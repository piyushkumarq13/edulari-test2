/**
 * Seed Script for E2E Test Users
 * 
 * Creates test users that can be used in E2E tests.
 * Run with: npm run seed:e2e-users
 * 
 * This creates users specifically designed for automated testing
 */

import { sql } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/passwords';

interface CreateUserOptions {
  name: string;
  email: string;
  password?: string;
  role?: 'student' | 'instructor' | 'admin';
  verified?: boolean;
}

async function createUser(options: CreateUserOptions) {
  const {
    name,
    email,
    password = 'TestPassword123!',
    role = 'student',
    verified = true,
  } = options;

  const hashedPassword = hashPassword(password);

  try {
    const result = await sql`
      INSERT INTO users (name, email, password, role, email_verified, is_active, profile_completed, registration_date)
      VALUES (${name}, ${email}, ${hashedPassword}, ${role}, ${verified}, true, true, now())
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password = EXCLUDED.password,
        role = COALESCE(EXCLUDED.role, users.role),
        email_verified = COALESCE(EXCLUDED.email_verified, users.email_verified)
      RETURNING id, email, role, created_at
    `;

    console.log(`✅ User created/updated: ${result[0].email} (role: ${result[0].role})`);
    return result[0];
  } catch (error) {
    console.error(`❌ Error creating user ${email}:`, error);
    throw error;
  }
}

async function seedTestUsers() {
  console.log('🌱 Seeding E2E test users...\n');

  const testUsers: CreateUserOptions[] = [
    {
      name: 'Student Test User',
      email: process.env.E2E_STUDENT_EMAIL || 'e2e-student@test.com',
      password: process.env.E2E_STUDENT_PASSWORD || 'TestPassword123!',
      role: 'student',
      verified: true,
    },
    {
      name: 'Instructor Test User',
      email: process.env.E2E_INSTRUCTOR_EMAIL || 'e2e-instructor@test.com',
      password: process.env.E2E_INSTRUCTOR_PASSWORD || 'TestPassword123!',
      role: 'instructor',
      verified: true,
    },
    {
      name: 'Admin Test User',
      email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@test.com',
      password: process.env.E2E_ADMIN_PASSWORD || 'TestPassword123!',
      role: 'admin',
      verified: true,
    },
  ];

  try {
    // Begin transaction
    await sql.begin(async (sql) => {
      for (const user of testUsers) {
        await createUser(user);
      }
    });

    console.log('\n✨ E2E test users seeded successfully!');
    console.log('\n📋 Test Credentials (Environment Variables):');
    console.log(`STUDENT_USER=${testUsers[0].email}`);
    console.log(`STUDENT_PASS=${testUsers[0].password}`);
    console.log(`INSTRUCTOR_USER=${testUsers[1].email}`);
    console.log(`INSTRUCTOR_PASS=${testUsers[1].password}`);
    console.log(`ADMIN_USER=${testUsers[2].email}`);
    console.log(`ADMIN_PASS=${testUsers[2].password}`);
    console.log('\n💡 Add these to your .env.local file to run authenticated E2E tests.\n');

  } catch (error) {
    console.error('\n💥 Failed to seed test users:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedTestUsers().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { seedTestUsers };
