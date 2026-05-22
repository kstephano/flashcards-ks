import 'dotenv/config';
import { db } from '../lib/db';
import { users, userSettings, projects, sections } from '../lib/db/schema';

async function seed() {
  const [user] = await db.insert(users)
    .values({ email: 'kstephano@gmail.com' })
    .onConflictDoNothing()
    .returning();

  if (user) {
    await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
    const [project] = await db.insert(projects)
      .values({ userId: user.id, name: 'Demo Project', description: 'Example project' })
      .returning();
    await db.insert(sections)
      .values({ projectId: project.id, name: 'Section 1', orderIndex: 0 });
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
