#!/usr/bin/env python3
"""Build transparent VP9 and animated-WebP smoke assets from an MP4.

The media toolchain is pinned to Remotion CLI 4.0.494. Image processing was
verified with NumPy 2.4.6 and Pillow 12.3.0; the APIs used are compatible with
NumPy 1.24+ and Pillow 10.0+.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


FRAME_COUNT = 26
OUTPUT_SIZE = (512, 512)
FPS = 24
WEBP_FRAME_DURATION_MS = round(1000 / FPS)
REMOTION_CLI_VERSION = "4.0.494"
ALPHA_CLEAR_DISTANCE = 4.0
ALPHA_OPAQUE_DISTANCE = 26.0
ALPHA_BLUR_RADIUS = 1.0


def remotion_command(tool: str) -> list[str]:
    """Return the requested Remotion-bundled media tool command."""
    npx = shutil.which("npx")
    if npx is None:
        raise RuntimeError("npx was not found on PATH")
    return [
        npx,
        "--yes",
        f"--package=@remotion/cli@{REMOTION_CLI_VERSION}",
        "remotion",
        tool,
    ]


def run(command: list[str]) -> None:
    print("Running:", subprocess.list2cmdline(command), flush=True)
    subprocess.run(command, check=True)


def validate_distinct_paths(input_path: Path, output_path: Path) -> None:
    """Reject replacing the source through an equal, linked, or aliased path."""
    if input_path == output_path or (
        output_path.exists() and os.path.samefile(input_path, output_path)
    ):
        raise ValueError("Input and output paths must refer to different files")


def publish_atomically(encoded_path: Path, output_path: Path) -> None:
    """Stage beside the destination, then atomically replace it."""
    descriptor, stage_name = tempfile.mkstemp(
        prefix=f".{output_path.name}.", suffix=".tmp", dir=output_path.parent
    )
    os.close(descriptor)
    stage_path = Path(stage_name)
    try:
        shutil.copyfile(encoded_path, stage_path)
        os.replace(stage_path, output_path)
    finally:
        stage_path.unlink(missing_ok=True)


def read_rgb(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        return np.asarray(image.convert("RGB"), dtype=np.uint8)


def make_rgba(source_rgb: np.ndarray, background_rgb: np.ndarray) -> Image.Image:
    delta = source_rgb.astype(np.float32) - background_rgb
    distance = np.sqrt(np.sum(delta * delta, axis=2))

    normalized = np.clip(
        (distance - ALPHA_CLEAR_DISTANCE)
        / (ALPHA_OPAQUE_DISTANCE - ALPHA_CLEAR_DISTANCE),
        0.0,
        1.0,
    )
    # Smoothstep gives a gradual matte without changing the smoke's source RGB.
    normalized = normalized * normalized * (3.0 - 2.0 * normalized)
    alpha = np.rint(normalized * 255.0).astype(np.uint8)
    alpha_image = Image.fromarray(alpha, mode="L").filter(
        ImageFilter.GaussianBlur(radius=ALPHA_BLUR_RADIUS)
    )

    rgb_image = Image.fromarray(source_rgb, mode="RGB")
    rgb_image.putalpha(alpha_image)
    return rgb_image.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)


def build(input_path: Path, output_path: Path) -> None:
    input_path = input_path.expanduser().resolve(strict=True)
    output_path = output_path.expanduser().resolve()
    if output_path.suffix.lower() != ".webm":
        raise ValueError("The video output path must use the .webm extension")
    webp_output_path = output_path.with_suffix(".webp")
    validate_distinct_paths(input_path, output_path)
    validate_distinct_paths(input_path, webp_output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    ffmpeg = remotion_command("ffmpeg")
    with tempfile.TemporaryDirectory(prefix="transparent-smoke-") as temp_name:
        temp_root = Path(temp_name)
        source_frames = temp_root / "source"
        rgba_frames = temp_root / "rgba"
        source_frames.mkdir()
        rgba_frames.mkdir()

        run(
            ffmpeg
            + [
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(input_path),
                "-map",
                "0:v:0",
                "-fps_mode",
                "passthrough",
                str(source_frames / "frame-%06d.png"),
            ]
        )

        extracted = sorted(source_frames.glob("frame-*.png"))
        if len(extracted) < 4:
            raise RuntimeError(
                f"Expected at least four source frames, extracted {len(extracted)}"
            )

        first_four = np.stack([read_rgb(path) for path in extracted[:4]], axis=0)
        background = np.median(first_four, axis=0).astype(np.float32)
        selected_indices = np.rint(
            np.linspace(0, len(extracted) - 1, FRAME_COUNT)
        ).astype(int)

        webp_frames: list[Image.Image] = []
        for output_index, source_index in enumerate(selected_indices):
            rgba = make_rgba(read_rgb(extracted[source_index]), background)
            rgba.save(rgba_frames / f"frame-{output_index:04d}.png")
            webp_frames.append(rgba)

        temporary_output = temp_root / "placement-smoke.webm"
        run(
            ffmpeg
            + [
                "-hide_banner",
                "-loglevel",
                "error",
                "-framerate",
                str(FPS),
                "-start_number",
                "0",
                "-i",
                str(rgba_frames / "frame-%04d.png"),
                "-frames:v",
                str(FRAME_COUNT),
                "-c:v",
                "libvpx-vp9",
                "-pix_fmt",
                "yuva420p",
                "-auto-alt-ref",
                "0",
                "-an",
                "-y",
                str(temporary_output),
            ]
        )
        temporary_webp = temp_root / "placement-smoke.webp"
        webp_frames[0].save(
            temporary_webp,
            save_all=True,
            append_images=webp_frames[1:],
            duration=WEBP_FRAME_DURATION_MS,
            loop=0,
            lossless=False,
            quality=78,
            method=3,
            exact=True,
        )
        publish_atomically(temporary_output, output_path)
        publish_atomically(temporary_webp, webp_output_path)

    print(f"Wrote {output_path}")
    print(f"Wrote {webp_output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_mp4", type=Path)
    parser.add_argument("output_webm", type=Path)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    build(arguments.input_mp4, arguments.output_webm)
