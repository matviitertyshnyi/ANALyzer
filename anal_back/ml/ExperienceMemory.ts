import { getDb } from '../database';

export class ExperienceMemory {
  static async saveExperience(experience: {
    modelId: number;
    features: number[];
    action: number;
    reward: number;
    nextFeatures: number[];
    timestamp: Date;
  }) {
    const db = await getDb();
    await db.run(`
      INSERT INTO ml_experiences (
        model_id,
        features,
        action,
        reward,
        next_features,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      experience.modelId,
      JSON.stringify(experience.features),
      experience.action,
      experience.reward,
      JSON.stringify(experience.nextFeatures),
      experience.timestamp
    ]);
  }

  static async getExperienceBatch(modelId: number, batchSize: number = 32) {
    const db = await getDb();
    // Get mix of random and recent experiences
    const experiences = await db.all(`
      SELECT * FROM (
        SELECT * FROM ml_experiences 
        WHERE model_id = ? 
        ORDER BY RANDOM() 
        LIMIT ?
      )
      UNION ALL
      SELECT * FROM (
        SELECT * FROM ml_experiences 
        WHERE model_id = ?
        ORDER BY timestamp DESC 
        LIMIT ?
      )
    `, [modelId, batchSize/2, modelId, batchSize/2]);

    return experiences.map(e => ({
      ...e,
      features: JSON.parse(e.features),
      nextFeatures: JSON.parse(e.next_features)
    }));
  }

  static async pruneOldExperiences(modelId: number, keepDays: number = 30) {
    const db = await getDb();
    await db.run(`
      DELETE FROM ml_experiences 
      WHERE model_id = ? 
      AND timestamp < datetime('now', ?)
    `, [modelId, `-${keepDays} days`]);
  }
}
