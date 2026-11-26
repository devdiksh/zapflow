import { Router, type Request } from 'express';
import { isValidObjectId } from 'mongoose';

import { HttpError } from '../lib/http-error.js';
import { currentUserId } from '../middleware/require-auth.js';
import { Zap, toZapDto } from '../models/zap.js';
import { connectTrigger, disconnectTrigger } from '../services/zap-triggers.js';
import { parseBody, zapCreateSchema, zapUpdateSchema } from '../validation/zap.js';

/**
 * CRUD for the signed-in user's Zaps. Every query is scoped by ownerId.
 *
 * Webhook lifecycle: a Zap that is (or becomes) enabled gets its repo's
 * webhook BEFORE we save, so "on" always means "will run". Releasing a
 * webhook happens AFTER we save, so the "is anyone else still using this
 * repo?" check sees the new state.
 */
export const zapsRouter = Router();

/** Loads a Zap the current user owns, or 404s (also for other users' Zaps: don't leak existence). */
async function findOwnedZap(req: Request<{ id: string }>) {
  const { id } = req.params;
  const zap = isValidObjectId(id) ? await Zap.findOne({ _id: id, ownerId: currentUserId(req) }) : null;
  if (!zap) {
    throw new HttpError(404, 'Zap not found');
  }
  return zap;
}

zapsRouter.get('/', async (req, res) => {
  const zaps = await Zap.find({ ownerId: currentUserId(req) }).sort({ updatedAt: -1 });
  res.json(zaps.map(toZapDto));
});

zapsRouter.post('/', async (req, res) => {
  const userId = currentUserId(req);
  const input = parseBody(zapCreateSchema, req.body);

  const webhookId = input.enabled ? await connectTrigger(userId, input.trigger) : undefined;
  const zap = await Zap.create({ ...input, ownerId: userId, webhookId });

  res.status(201).json(toZapDto(zap));
});

zapsRouter.get('/:id', async (req, res) => {
  const zap = await findOwnedZap(req);
  res.json(toZapDto(zap));
});

zapsRouter.patch('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const zap = await findOwnedZap(req);
  const changes = parseBody(zapUpdateSchema, req.body);

  const before = { enabled: zap.enabled, trigger: zap.trigger };
  const after = { enabled: changes.enabled ?? zap.enabled, trigger: changes.trigger ?? zap.trigger };
  const repoChanged = before.trigger.config.repo !== after.trigger.config.repo;

  // Turning on, or moving to another repo while on: the new repo needs our webhook first.
  if (after.enabled && (!before.enabled || repoChanged)) {
    zap.webhookId = await connectTrigger(userId, after.trigger);
  }

  zap.set(changes);
  if (!after.enabled) {
    zap.webhookId = undefined;
  }
  await zap.save();

  // Turned off, or moved away from the old repo: let go of the old repo's webhook.
  if (before.enabled && (!after.enabled || repoChanged)) {
    await disconnectTrigger(userId, before.trigger);
  }

  res.json(toZapDto(zap));
});

zapsRouter.delete('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const zap = await findOwnedZap(req);

  await zap.deleteOne();
  if (zap.enabled) {
    await disconnectTrigger(userId, zap.trigger);
  }

  res.status(204).end();
});
