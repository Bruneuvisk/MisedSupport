// src/services/ConvertioClient.ts
import axios from 'axios';

type StartResp = { id: string };

// Ajustamos o tipo para refletir a API real
type StatusResp =
  | {
      ok: true;
      id: string;
      step: 'wait' | 'convert' | 'upload' | 'finish';
      step_percent: number;
      minutes?: number;
      outputUrl?: string;  // <- url de download (se já disponível)
      size?: number | string;
    }
  | {
      ok: false;
      code?: number;
      error?: string;
    };

export class ConvertioClient {
  private readonly api = axios.create({
    baseURL: 'https://api.convertio.co',
    timeout: 25_000,
    headers: { 'Content-Type': 'application/json' },
  });

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('CONVERTIO_API_KEY ausente.');
  }

  async startConversion(params: {
    file: string;
    outputformat: string;
    options?: Record<string, any>;
    input?: 'url' | 'raw' | 'base64' | 'upload';
  }): Promise<StartResp> {
    const body = {
      apikey: this.apiKey,
      input: params.input ?? 'url', // explícito, embora o default seja url
      file: params.file,
      outputformat: params.outputformat,
      ...(params.options ? { options: params.options } : {}),
    };
    const { data } = await this.api.post('/convert', body);
    if (data?.status === 'ok' && data?.data?.id) {
      return { id: data.data.id };
    }
    throw new Error(data?.error ?? 'Falha ao iniciar conversão');
  }

  async getStatus(id: string): Promise<StatusResp> {
    const { data } = await this.api.get(`/convert/${id}/status`);
    // Sucesso vem como { status: "ok", data: {...} }
    if (data?.status === 'ok' && data?.data) {
      const d = data.data;
      return {
        ok: true,
        id: d.id,
        step: d.step,                // "wait" | "convert" | "upload" | "finish"
        step_percent: Number(d.step_percent ?? 0),
        minutes: d.minutes ? Number(d.minutes) : undefined,
        outputUrl: d.output?.url,    // <- URL final (quando step === "finish")
        size: d.output?.size,
      };
    }
    // Erro vem como { status: "error", code, error }
    return { ok: false, code: data?.code, error: data?.error ?? 'Falha ao consultar status' };
  }

  async downloadResult(url: string, outputformat: string): Promise<{ buffer: Buffer; filename: string }> {
    const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(res.data);
    const filename = `convertio_result.${outputformat.replace(/[^a-z0-9]+/gi, '')}`;
    return { buffer, filename };
  }

  async cancel(id: string): Promise<void> {
    const { data } = await this.api.delete(`/convert/${id}`);
    if (data?.status !== 'ok') throw new Error(data?.error ?? 'Falha ao cancelar conversão');
  }

  // Atualizado para checar step === "finish"
  async pollUntilFinished(
    id: string,
    opts: { timeoutMs: number; intervalMs: number }
  ): Promise<StatusResp> {
    const { timeoutMs, intervalMs } = opts;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const st = await this.getStatus(id);
      if (!st.ok) return st;
      if (st.step === 'finish') return st;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return this.getStatus(id);
  }
}
