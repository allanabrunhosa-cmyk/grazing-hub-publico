#!/usr/bin/env python3
"""Recompressão PNG reversível; não altera banco/uploads nem substitui originais."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

SIGNATURE = b'\x89PNG\r\n\x1a\n'
MAX_INPUT = 8 * 1024 * 1024
MAX_DECODED = 128 * 1024 * 1024


def chunks(data):
    if not data.startswith(SIGNATURE) or len(data) > MAX_INPUT:
        raise ValueError('PNG inválido ou acima do limite de 8 MiB')
    result = []
    pos = 8
    ended = False
    while pos < len(data):
        if len(data) - pos < 12:
            raise ValueError('PNG truncado')
        length = struct.unpack('>I', data[pos:pos+4])[0]
        end = pos + length + 12
        if end > len(data):
            raise ValueError('Chunk truncado')
        kind = data[pos+4:pos+8]
        body = data[pos+8:end-4]
        crc = struct.unpack('>I', data[end-4:end])[0]
        if zlib.crc32(kind + body) & 0xffffffff != crc:
            raise ValueError('CRC inválido')
        result.append((kind, body))
        pos = end
        if kind == b'IEND':
            ended = True
            break
    if not ended or pos != len(data) or not result or result[0][0] != b'IHDR' or len(result[0][1]) != 13:
        raise ValueError('Estrutura PNG inválida')
    return result


def decoded_scanlines(compressed):
    decoder = zlib.decompressobj()
    raw = decoder.decompress(compressed, MAX_DECODED + 1)
    if len(raw) > MAX_DECODED or decoder.unconsumed_tail or not decoder.eof or decoder.unused_data:
        raise ValueError('Fluxo PNG inválido ou maior que o limite descompactado')
    return raw


def encode_chunk(kind, body):
    return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)


def optimize(data):
    if not data.startswith(SIGNATURE):
        return data, 'preservado: formato sem otimizador sem perdas disponível'
    items = chunks(data)
    if any(k in (b'acTL', b'fcTL', b'fdAT') for k, _ in items):
        return data, 'preservado: PNG animado'
    indices = [i for i, (k, _) in enumerate(items) if k == b'IDAT']
    if not indices or indices != list(range(indices[0], indices[-1]+1)):
        raise ValueError('IDAT ausente ou não contíguo')
    raw = decoded_scanlines(b''.join(v for k, v in items if k == b'IDAT'))
    compressed = zlib.compress(raw, level=9)
    result = SIGNATURE
    for i, (kind, body) in enumerate(items):
        if kind != b'IDAT':
            result += encode_chunk(kind, body)
        elif i == indices[0]:
            result += encode_chunk(b'IDAT', compressed)
    verified = chunks(result)
    if [(k,v) for k,v in verified if k != b'IDAT'] != [(k,v) for k,v in items if k != b'IDAT']:
        raise ValueError('Metadados alterados')
    if decoded_scanlines(b''.join(v for k,v in verified if k == b'IDAT')) != raw:
        raise ValueError('Pixels/scanlines alterados')
    if len(result) >= len(data):
        return data, 'preservado: já otimizado'
    return result, 'PNG recompresso; scanlines e metadados idênticos'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--output-dir', type=Path, help='Cria cópias; nunca substitui originais')
    args = parser.parse_args()
    saved = 0
    for path in args.files:
        original = path.read_bytes()
        result, status = optimize(original)
        gain = len(original)-len(result)
        if args.output_dir and gain:
            args.output_dir.mkdir(parents=True, exist_ok=True)
            destination = args.output_dir / (hashlib.sha256(original).hexdigest() + '.png')
            with destination.open('xb') as file:
                file.write(result)
        print(json.dumps(dict(original_bytes=len(original), optimized_bytes=len(result), saved_bytes=gain,
                              status=status, original_sha256=hashlib.sha256(original).hexdigest(),
                              optimized_sha256=hashlib.sha256(result).hexdigest()), ensure_ascii=False))
        saved += gain
    print(json.dumps(dict(total_potential_saved_bytes=saved, database_changed=False, originals_replaced=False)))


if __name__ == '__main__':
    main()
