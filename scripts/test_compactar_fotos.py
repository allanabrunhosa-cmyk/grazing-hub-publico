import importlib.util
from pathlib import Path
import struct
import unittest
import zlib

spec=importlib.util.spec_from_file_location('photos',Path(__file__).with_name('compactar-fotos-sem-perdas.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


def png(level=0, animated=False):
    header=struct.pack('>IIBBBBB',100,100,8,2,0,0,0)
    raw=(b'\0'+b'\x11\x22\x33'*100)*100
    return m.SIGNATURE+m.encode_chunk(b'IHDR',header)+m.encode_chunk(b'tEXt',b'note\0preserve')+(m.encode_chunk(b'acTL',struct.pack('>II',1,0)) if animated else b'')+m.encode_chunk(b'IDAT',zlib.compress(raw,level))+m.encode_chunk(b'IEND',b'')


class PhotoTests(unittest.TestCase):
    def test_smaller_with_identical_scanlines_and_metadata(self):
        original=png();result,status=m.optimize(original)
        self.assertLess(len(result),len(original))
        a=m.chunks(original);b=m.chunks(result)
        self.assertEqual([x for x in a if x[0]!=b'IDAT'],[x for x in b if x[0]!=b'IDAT'])
        self.assertEqual(m.decoded_scanlines(b''.join(v for k,v in a if k==b'IDAT')),m.decoded_scanlines(b''.join(v for k,v in b if k==b'IDAT')))

    def test_idempotent(self):
        once,_=m.optimize(png());twice,_=m.optimize(once);self.assertEqual(once,twice)

    def test_jpeg_preserved(self):
        data=b'\xff\xd8\xffexample';self.assertEqual(m.optimize(data)[0],data)

    def test_animation_preserved(self):
        data=png(animated=True);self.assertEqual(m.optimize(data)[0],data)

    def test_corruption_rejected(self):
        data=bytearray(png());data[25]^=1
        with self.assertRaises(ValueError):m.optimize(bytes(data))

    def test_truncation_rejected(self):
        with self.assertRaises(ValueError):m.optimize(png()[:-1])

    def test_decompression_limit(self):
        previous=m.MAX_DECODED;m.MAX_DECODED=5
        try:
            with self.assertRaises(ValueError):m.optimize(png())
        finally:m.MAX_DECODED=previous


if __name__=='__main__':unittest.main()
