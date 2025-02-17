import { resetDatabase } from '../database.js';

console.log('🔄 Starting database reset...');

async function main() {
  try {
    await resetDatabase();
    console.log('✅ Database reset completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
