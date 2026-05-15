#!/usr/bin/env python3
"""Procedural grayscale surface textures for bump/roughness mapping."""
from __future__ import annotations

import math
import os
import random

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")


def fract(v: float) -> float:
    return v - math.floor(v)


def hash2(x: float, y: float, seed: float) -> float:
    return fract(math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453)


def smoothstep(t: float) -> float:
    return t * t * (3 - 2 * t)


def value_noise(x: float, y: float, seed: float) -> float:
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    a = hash2(ix, iy, seed)
    b = hash2(ix + 1, iy, seed)
    c = hash2(ix, iy + 1, seed)
    d = hash2(ix + 1, iy + 1, seed)
    ux, uy = smoothstep(fx), smoothstep(fy)
    x1 = a + (b - a) * ux
    x2 = c + (d - c) * ux
    return x1 + (x2 - x1) * uy


def fbm(x: float, y: float, seed: float, octaves: int = 5) -> float:
    total, amp, freq, norm = 0.0, 0.5, 1.0, 0.0
    for i in range(octaves):
        total += value_noise(x * freq, y * freq, seed + i * 17.31) * amp
        norm += amp
        amp *= 0.5
        freq *= 2
    return total / norm if norm else 0.0


def sample_herrmann(nx: float, ny: float, seed: float) -> float:
    return fbm(nx * 4.2, ny * 4.2, seed, 4) * 0.7 + fbm(nx * 9, ny * 2, seed + 1, 3) * 0.3


def sample_wertavio(nx: float, ny: float, seed: float) -> float:
    g = abs(math.sin(nx * 28 + seed) * math.cos(ny * 28 + seed))
    return fbm(nx * 7, ny * 7, seed, 4) * 0.55 + g * 0.45


def sample_culturefit(nx: float, ny: float, seed: float) -> float:
    ridge = abs(math.sin((nx + ny) * 18 + seed * 2))
    return fbm(nx * 8, ny * 5, seed, 5) * 0.5 + ridge * 0.5


def sample_homeflower(nx: float, ny: float, seed: float) -> float:
    return fbm(nx * 12, ny * 12, seed, 6) * 0.6 + fbm(nx * 3, ny * 3, seed + 3, 4) * 0.4


def sample_eversmell(nx: float, ny: float, seed: float) -> float:
    strata = abs(math.sin(ny * 32 + seed))
    return fbm(nx * 6, ny * 10, seed, 4) * 0.45 + strata * 0.55


def make_moon_sampler(seed: float):
    rng = random.Random(int(seed * 1000))
    craters = [
        (rng.random(), rng.random(), 0.02 + rng.random() * 0.06)
        for _ in range(18)
    ]

    def sample_moon(nx: float, ny: float, _seed: float) -> float:
        base = fbm(nx * 10, ny * 10, seed, 5)
        for cx, cy, r in craters:
            d = math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2)
            if d < r:
                base = min(base, base * 0.35)
        return base

    return sample_moon


SAMPLERS = {
    "herrmann": sample_herrmann,
    "wertavio": sample_wertavio,
    "culturefit": sample_culturefit,
    "homeflower": sample_homeflower,
    "eversmell": sample_eversmell,
}


def write_surface(path: str, w: int, h: int, seed: float, sampler) -> None:
    img = Image.new("L", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            nx, ny = x / w, y / h
            n = sampler(nx, ny, seed)
            shaped = max(0, min(1, 0.5 + (n - 0.5) * 1.2))
            px[x, y] = int(shaped * 255)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "JPEG", quality=85)


def write_glow(path: str, size: int = 512) -> None:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    cx = cy = size / 2
    max_r = size / 2
    for y in range(size):
        for x in range(size):
            r = math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / max_r
            t = max(0, min(1, r))
            alpha = int((1 - t * t) * 255)
            px[x, y] = (255, 255, 255, alpha)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG")


def main() -> None:
    seeds = {
        "herrmann": 3.17,
        "wertavio": 5.41,
        "culturefit": 7.89,
        "homeflower": 11.23,
        "eversmell": 13.71,
    }
    for slug, seed in seeds.items():
        out = os.path.join(ROOT, "planets", f"{slug}_surface.jpg")
        write_surface(out, 512, 512, seed, SAMPLERS[slug])
        print("wrote", out)
    write_surface(
        os.path.join(ROOT, "moon", "moon_surface.jpg"),
        512,
        256,
        42.0,
        make_moon_sampler(42.0),
    )
    print("wrote moon")
    write_glow(os.path.join(ROOT, "glow", "star_glow.png"))
    print("wrote glow")


if __name__ == "__main__":
    main()
