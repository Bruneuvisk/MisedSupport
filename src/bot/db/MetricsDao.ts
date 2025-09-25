import { Mongo } from './Mongo.js';

interface MetricsDoc {
  userId: string;
  pingCount: number;
}

/**
 * DAO de métricas simples.
 * - incUserPing(userId): incrementa contador de /ping do usuário e retorna o valor final.
 * - getUserPing(userId): lê o total sem alterar.
 */
export class MetricsDao {
  static col() {
    return Mongo.getDb().collection<MetricsDoc>('metrics');
  }

  /**
   * Incrementa o contador de ping do usuário e retorna o total atualizado.
   * Usa includeResultMetadata:false para receber diretamente o documento (sem wrapper).
   */
  static async incUserPing(userId: string): Promise<number> {
    const col = this.col();

    const doc = await col.findOneAndUpdate(
      { userId },
      { $inc: { pingCount: 1 } },
      {
        upsert: true,
        returnDocument: 'after',
        includeResultMetadata: false, // <- retorna o documento diretamente (WithId<MetricsDoc> | null)
      }
    );

    // Se por alguma condição de corrida vier null, busca de novo:
    const ensured =
      doc ??
      (await col.findOne({ userId })) ??
      // fallback defensivo (não deve acontecer com upsert, mas evita undefined)
      ({ userId, pingCount: 1 } as MetricsDoc);

    return Number(ensured.pingCount ?? 1);
  }

  /**
   * Obtém o total atual de pings do usuário (0 se inexistente).
   */
  static async getUserPing(userId: string): Promise<number> {
    const doc = await this.col().findOne({ userId });
    return Number(doc?.pingCount ?? 0);
  }
}
