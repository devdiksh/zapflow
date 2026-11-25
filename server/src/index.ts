import mongoose from 'mongoose';

import { createApp } from './app.js';
import { env } from './config.js';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to MongoDB at ${env.MONGODB_URI}`);

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`ZapFlow API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start ZapFlow API:', err);
  process.exit(1);
});
