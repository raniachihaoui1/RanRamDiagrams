"""ComfyUI client abstraction.

The rest of the app depends only on this interface, so swapping the mock for a
real ComfyUI instance (COMFY_MODE=real) requires no changes upstream.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

# async callback(progress 0..1, status_label)
ProgressCallback = Callable[[float, str], Awaitable[None]]


@dataclass
class GenParams:
    mode: str = "txt2img"  # txt2img | img2img
    prompt: str = ""
    negative: str = ""
    model: str | None = None
    loras: list[str] = field(default_factory=list)
    width: int = 1024
    height: int = 1024
    count: int = 1
    seed: int | None = None
    reference_image_path: str | None = None
    reference_image_id: str | None = None
    reference_weight: float = 0.5


class ComfyClient(ABC):
    """A backend that turns GenParams into one or more PNG images."""

    name: str = "base"

    @abstractmethod
    async def generate(
        self, params: GenParams, on_progress: ProgressCallback
    ) -> list[bytes]:
        """Run generation, reporting progress, and return PNG bytes per image."""
        raise NotImplementedError
