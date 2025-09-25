// src/db/Mongo.ts
import { MongoClient, Db } from "mongodb";

export class Mongo {
  private static client: MongoClient | null = null;
  private static db: Db | null = null;

  static async connect(
    uri = process.env.MONGO_URI,
    name = process.env.MONGO_DB
  ) {
    if (!uri) throw new Error("Defina MONGO_URI no .env");
    if (!name) throw new Error("Defina MONGO_DB no .env");
    if (this.client) return; // idempotente

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(name);
    console.log("[Mongo] conectado");
  }

  static getDb(): Db {
    if (!this.db) throw new Error("Mongo não conectado");
    return this.db;
  }
}
