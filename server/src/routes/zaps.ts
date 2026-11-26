import { Router, type Request } from 'express';
import { isValidObjectId } from 'mongoose';

import { HttpError } from '../lib/http-error.js';
import { currentUserId } from '../middleware/require-auth.js';
import { Zap, toZapDto } from '../models/zap.js';
import { parseBody, zapCreateSchema, zapUpdateSchema } from '../validation/zap.js';

/** CRUD for the signed-in user's Zaps. Every query is scoped by ownerId. */
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
  const input = parseBody(zapCreateSchema, req.body);
  const zap = await Zap.create({ ...input, ownerId: currentUserId(req) });
  res.status(201).json(toZapDto(zap));
});

zapsRouter.get('/:id', async (req, res) => {
  const zap = await findOwnedZap(req);
  res.json(toZapDto(zap));
});

zapsRouter.patch('/:id', async (req, res) => {
  const zap = await findOwnedZap(req);
  const changes = parseBody(zapUpdateSchema, req.body);
  zap.set(changes);
  await zap.save();
  res.json(toZapDto(zap));
});

zapsRouter.delete('/:id', async (req, res) => {
  const zap = await findOwnedZap(req);
  await zap.deleteOne();
  res.status(204).end();
});
