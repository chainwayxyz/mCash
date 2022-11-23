// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { JsonDB, Config } from 'node-json-db'
import path from 'path';

const jsonDirectory = path.join(process.cwd(), 'json');

const db = new JsonDB(new Config(jsonDirectory + "/db.json", true, true, '/'));

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method === 'POST') {
    const { commitment, nullifier } = req.body
    if (commitment) {
      const commitments = await db.getData('/commitments')
      commitments.push(commitment)
      await db.push('/commitments', commitments)
    }
    if (nullifier) {
      const nullifiers = await db.getData('/nullifiers')
      nullifiers.push(nullifier)
      await db.push('/nullifiers', nullifiers)
    }
    return res.status(200).json(db)
  } else {
    const commitments = await db.getData('/commitments')
    const nullifiers = await db.getData('/nullifiers')
  
    res.status(200).json(
      {
        commitments,
        nullifiers
      }
    )
  }
}
