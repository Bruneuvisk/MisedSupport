import { Db } from "mongodb";
import { colPontoConfig, colPontoSession, colPontoTotal } from "./model.js";


export async function ensurePontoIndexes(db: Db) {
    await colPontoConfig(db).createIndexes([{ key: { guildId: 1 }, unique: true }]);
    await colPontoSession(db).createIndexes([{ key: { guildId: 1, userId: 1 }, unique: true }]);
    await colPontoTotal(db).createIndexes([
    { key: { guildId: 1, year: 1, month: 1, dayOfYear: 1 } },
    { key: { guildId: 1, userId: 1, year: 1, month: 1 } },
]);
}