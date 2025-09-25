import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { request } from 'undici';

export interface VideoToGifOpts {
  fps?: number;          // quadro por segundo
  scale?: number;        // largura final (mantém proporção). ex: 256, 320, 480
  maxBytes?: number;     // se definido, roda compressão ao final
}

export interface CompressOpts {
  targetBytes?: number;   // padrão 8 * 1024 * 1024 (8 MiB)
  maxPasses?: number;     // tentativas de compressão (padrão 6)
}

const DEFAULT_TMP = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gifsvc-'));
const exists = (p: string) => fs.promises.access(p).then(()=>true).catch(()=>false);

async function download(url: string, outPath: string) {
  const res = await request(url);
  if (res.statusCode! >= 400) throw new Error(`download HTTP ${res.statusCode}`);
  const file = fs.createWriteStream(outPath);
  await new Promise<void>((resolve, reject) => {
    res.body.pipe(file);
    res.body.on('error', reject);
    file.on('finish', resolve);
    file.on('error', reject);
  });
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', d => stderr += d.toString());
    p.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited ${code}\n${stderr}`));
    });
  });
}

export class GifService {
  /**
   * Converte um vídeo para GIF usando ffmpeg (com palette para qualidade decente).
   * Retorna o caminho do arquivo .gif gerado.
   */
  static async videoToGif(inPath: string, outPath: string, opts: VideoToGifOpts = {}): Promise<string> {
    const fps = Math.max(1, Math.min(30, opts.fps ?? 12));
    const scale = Math.max(64, Math.min(720, opts.scale ?? 320));

    const dir = path.dirname(outPath);
    const palette = path.join(dir, `palette-${Date.now()}.png`);

    // 1) gera paleta
    await run('ffmpeg', [
      '-y',
      '-i', inPath,
      '-vf', `fps=${fps},scale=${scale}:-1:flags=lanczos,palettegen=stats_mode=full`,
      palette
    ]);

    // 2) aplica paleta
    await run('ffmpeg', [
      '-y',
      '-i', inPath,
      '-i', palette,
      '-lavfi', `fps=${fps},scale=${scale}:-1:flags=lanczos [x]; [x][1:v] paletteuse=new=1:dither=bayer:bayer_scale=5`,
      '-loop', '0',
      outPath
    ]);

    if (await exists(palette)) fs.unlink(palette, ()=>{});

    // compress opcional
    if (opts.maxBytes && (fs.statSync(outPath).size > opts.maxBytes)) {
      await this.compressGif(outPath, outPath, { targetBytes: opts.maxBytes });
    }

    return outPath;
  }

  /**
   * Comprime um GIF até ficar <= targetBytes.
   * Tenta `gifsicle`; se ausente, usa `ffmpeg` reduzindo scale/fps.
   */
  static async compressGif(inPath: string, outPath: string, opts: CompressOpts = {}): Promise<string> {
    const target = opts.targetBytes ?? 8 * 1024 * 1024; // 8 MiB default
    const maxPasses = Math.max(1, Math.min(10, opts.maxPasses ?? 6));

    // Tentativa 1: gifsicle com ajustes progressivos
    const hasGifsicle = await new Promise<boolean>(resolve => {
      const p = spawn('gifsicle', ['--version']);
      p.on('error', () => resolve(false));
      p.on('close', (code) => resolve(code === 0));
    });

    if (hasGifsicle) {
      let colors = 256;
      let lossy = 30; // começa moderado
      let scale = 1.0;

      for (let pass = 0; pass < maxPasses; pass++) {
        const tmp = inPath + `.tmp${pass}.gif`;
        const args = [
          '--batch',
          '--optimize=3',
          `--colors=${Math.max(32, Math.floor(colors))}`,
          `--lossy=${Math.max(20, Math.floor(lossy))}`,
          inPath,
          '-o', tmp
        ];

        // aplica scale se < 1.0
        if (scale < 1.0) {
          args.splice(1, 0, `--scale=${scale.toFixed(2)}`);
        }

        // executa
        await run('gifsicle', args);
        const size = fs.statSync(tmp).size;

        // move para outPath
        fs.copyFileSync(tmp, outPath);
        fs.unlinkSync(tmp);

        if (size <= target) return outPath;

        // torna mais agressivo para próxima iteração
        if (colors > 64) colors *= 0.8;           // reduz paleta
        if (lossy < 200) lossy += 20;             // aumenta perda
        if (scale > 0.5) scale -= 0.1;            // reduz dimensões
      }

      return outPath; // retorna melhor que conseguiu
    }

    // Fallback: ffmpeg (reduzindo fps/scale progressivamente)
    let fps = 12;
    let scale = 320;

    for (let pass = 0; pass < maxPasses; pass++) {
      const tmp = inPath + `.ff${pass}.gif`;
      await run('ffmpeg', [
        '-y',
        '-i', inPath,
        '-vf', `fps=${fps},scale=${scale}:-1:flags=lanczos`,
        '-loop', '0',
        tmp
      ]);
      const size = fs.statSync(tmp).size;
      fs.copyFileSync(tmp, outPath);
      fs.unlinkSync(tmp);
      if (size <= target) return outPath;

      // próxima rodada mais agressiva
      if (fps > 8) fps -= 2;
      if (scale > 200) scale = Math.floor(scale * 0.85);
    }

    return outPath;
  }

  /** Baixa um attachment/URL e retorna caminho local */
  static async downloadToTmp(url: string, filenameHint?: string) {
    const dir = DEFAULT_TMP();
    const fname = filenameHint ?? `file-${Date.now()}`;
    const out = path.join(dir, fname);
    await download(url, out);
    return out;
  }
}
